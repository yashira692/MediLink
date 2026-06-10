import { Router } from 'express'
import pool from '../config/db.js'
import { autenticar, soloPacientes } from '../middleware/auth.js'

const router = Router()
const ESTADOS_ACTIVOS = ['pendiente', 'confirmada', 'reprogramada']

router.use(autenticar, soloPacientes)

function fechaHoraFutura(fecha, hora) {
  const fechaCita = new Date(`${fecha}T${hora}`)
  return !Number.isNaN(fechaCita.getTime()) && fechaCita > new Date()
}

function horaAMinutos(hora) {
  const [horas, minutos] = hora.slice(0, 5).split(':').map(Number)
  return horas * 60 + minutos
}

function minutosAHora(total) {
  const horas = String(Math.floor(total / 60)).padStart(2, '0')
  const minutos = String(total % 60).padStart(2, '0')
  return `${horas}:${minutos}`
}

async function obtenerDisponibilidad(connection, idMedico, fecha) {
  const diaSemanaJs = new Date(`${fecha}T12:00:00`).getDay()
  const diaSemana = diaSemanaJs === 0 ? 7 : diaSemanaJs
  const [jornadas] = await connection.execute(
    `SELECT hora_inicio, hora_fin, duracion_minutos
     FROM disponibilidad_medica
     WHERE id_medico = ? AND dia_semana = ? AND estado = 1`,
    [idMedico, diaSemana],
  )
  const [ocupadas] = await connection.execute(
    `SELECT TIME_FORMAT(hora, '%H:%i') AS hora
     FROM citas
     WHERE id_medico = ? AND fecha = ? AND estado IN (?, ?, ?)`,
    [idMedico, fecha, ...ESTADOS_ACTIVOS],
  )
  const horasOcupadas = new Set(ocupadas.map((cita) => cita.hora))
  const horarios = []

  for (const jornada of jornadas) {
    const inicio = horaAMinutos(jornada.hora_inicio)
    const fin = horaAMinutos(jornada.hora_fin)

    for (
      let minuto = inicio;
      minuto + jornada.duracion_minutos <= fin;
      minuto += jornada.duracion_minutos
    ) {
      const hora = minutosAHora(minuto)
      if (!horasOcupadas.has(hora) && fechaHoraFutura(fecha, hora)) {
        horarios.push(hora)
      }
    }
  }

  return horarios
}

router.get('/catalogo', async (_req, res, next) => {
  try {
    const [especialidades] = await pool.execute(
      `SELECT id_especialidad AS id, nombre
       FROM especialidades WHERE estado = 1 ORDER BY nombre`,
    )
    const [medicos] = await pool.execute(
      `SELECT
        m.id_medico AS id,
        m.id_especialidad AS idEspecialidad,
        CONCAT(u.nombres, ' ', u.apellidos) AS nombre,
        e.nombre AS especialidad,
        m.cmp
       FROM medicos m
       INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
       INNER JOIN especialidades e ON e.id_especialidad = m.id_especialidad
       WHERE u.estado = 1 AND e.estado = 1
       ORDER BY u.apellidos, u.nombres`,
    )

    return res.json({ especialidades, medicos })
  } catch (error) {
    return next(error)
  }
})

router.get('/horarios', async (req, res, next) => {
  const idMedico = Number(req.query.idMedico)
  const fecha = req.query.fecha

  if (!idMedico || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) {
    return res.status(400).json({ mensaje: 'Selecciona médico y fecha.' })
  }

  try {
    const horarios = await obtenerDisponibilidad(pool, idMedico, fecha)
    return res.json({ horarios })
  } catch (error) {
    return next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const [citas] = await pool.execute(
      `SELECT
        c.id_cita AS id,
        c.id_medico AS idMedico,
        DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
        TIME_FORMAT(c.hora, '%H:%i') AS hora,
        c.motivo,
        c.estado,
        CONCAT(u.nombres, ' ', u.apellidos) AS medico,
        e.nombre AS especialidad
       FROM citas c
       INNER JOIN medicos m ON m.id_medico = c.id_medico
       INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
       INNER JOIN especialidades e ON e.id_especialidad = m.id_especialidad
       WHERE c.id_paciente = ?
       ORDER BY c.fecha DESC, c.hora DESC`,
      [req.usuario.idPaciente],
    )

    return res.json({ citas })
  } catch (error) {
    return next(error)
  }
})

router.post('/', async (req, res, next) => {
  const idMedico = Number(req.body.idMedico)
  const fecha = req.body.fecha
  const hora = req.body.hora
  const motivo = req.body.motivo?.trim()

  if (!idMedico || !fecha || !hora || !motivo) {
    return res.status(400).json({ mensaje: 'Completa todos los datos de la cita.' })
  }

  if (!fechaHoraFutura(fecha, hora)) {
    return res.status(400).json({ mensaje: 'Selecciona una fecha y hora futura.' })
  }

  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const horarios = await obtenerDisponibilidad(connection, idMedico, fecha)

    if (!horarios.includes(hora)) {
      await connection.rollback()
      return res.status(409).json({ mensaje: 'Ese horario ya no está disponible.' })
    }

    const [resultado] = await connection.execute(
      `INSERT INTO citas (id_paciente, id_medico, fecha, hora, motivo)
       VALUES (?, ?, ?, ?, ?)`,
      [req.usuario.idPaciente, idMedico, fecha, hora, motivo],
    )
    await connection.execute(
      `INSERT INTO notificaciones (id_paciente, tipo, mensaje)
       VALUES (?, 'cita', ?)`,
      [
        req.usuario.idPaciente,
        `Tu solicitud de cita para el ${fecha} a las ${hora} fue registrada.`,
      ],
    )
    await connection.commit()

    return res.status(201).json({
      mensaje: 'Cita reservada correctamente.',
      idCita: resultado.insertId,
    })
  } catch (error) {
    if (connection) await connection.rollback()
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ese horario ya fue reservado.' })
    }
    return next(error)
  } finally {
    connection?.release()
  }
})

router.patch('/:id/cancelar', async (req, res, next) => {
  const idCita = Number(req.params.id)
  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const [resultado] = await connection.execute(
      `UPDATE citas
       SET estado = 'cancelada', motivo_cancelacion = ?
       WHERE id_cita = ? AND id_paciente = ?
         AND estado IN ('pendiente', 'confirmada', 'reprogramada')`,
      [req.body.motivo?.trim() || 'Cancelada por el paciente', idCita, req.usuario.idPaciente],
    )

    if (resultado.affectedRows === 0) {
      await connection.rollback()
      return res.status(404).json({ mensaje: 'La cita no puede ser cancelada.' })
    }

    await connection.execute(
      `DELETE FROM notificaciones
       WHERE id_cita = ? AND clave_evento LIKE 'recordatorio-24h:%'`,
      [idCita],
    )
    await connection.execute(
      `INSERT INTO notificaciones (id_paciente, tipo, mensaje)
       VALUES (?, 'cita', 'Tu cita fue cancelada correctamente.')`,
      [req.usuario.idPaciente],
    )
    await connection.commit()

    return res.json({ mensaje: 'Cita cancelada correctamente.' })
  } catch (error) {
    if (connection) await connection.rollback()
    return next(error)
  } finally {
    connection?.release()
  }
})

router.put('/:id/reprogramar', async (req, res, next) => {
  const idCita = Number(req.params.id)
  const fecha = req.body.fecha
  const hora = req.body.hora

  if (!fechaHoraFutura(fecha, hora)) {
    return res.status(400).json({ mensaje: 'Selecciona una fecha y hora futura.' })
  }

  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const [[cita]] = await connection.execute(
      `SELECT id_medico
       FROM citas
       WHERE id_cita = ? AND id_paciente = ?
         AND estado IN ('pendiente', 'confirmada', 'reprogramada')
       FOR UPDATE`,
      [idCita, req.usuario.idPaciente],
    )

    if (!cita) {
      await connection.rollback()
      return res.status(404).json({ mensaje: 'La cita no puede ser reprogramada.' })
    }

    const horarios = await obtenerDisponibilidad(
      connection,
      cita.id_medico,
      fecha,
    )

    if (!horarios.includes(hora)) {
      await connection.rollback()
      return res.status(409).json({ mensaje: 'Ese horario no está disponible.' })
    }

    await connection.execute(
      `DELETE FROM notificaciones
       WHERE id_cita = ? AND clave_evento LIKE 'recordatorio-24h:%'`,
      [idCita],
    )
    await connection.execute(
      `UPDATE citas
       SET fecha = ?, hora = ?, estado = 'reprogramada'
       WHERE id_cita = ?`,
      [fecha, hora, idCita],
    )
    await connection.execute(
      `INSERT INTO notificaciones (id_paciente, tipo, mensaje)
       VALUES (?, 'cita', ?)`,
      [
        req.usuario.idPaciente,
        `Tu cita fue reprogramada para el ${fecha} a las ${hora}.`,
      ],
    )
    await connection.commit()

    return res.json({ mensaje: 'Cita reprogramada correctamente.' })
  } catch (error) {
    if (connection) await connection.rollback()
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ese horario ya fue reservado.' })
    }
    return next(error)
  } finally {
    connection?.release()
  }
})

export default router
