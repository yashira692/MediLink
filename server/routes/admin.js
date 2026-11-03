import bcrypt from 'bcryptjs'
import { Router } from 'express'
import pool from '../config/db.js'
import { autenticar, soloAdministradores } from '../middleware/auth.js'
import { registrarAcceso } from '../services/bitacora.js'
import { cambiarPassword } from '../services/cuenta.js'
import { enviarReporteExcel, enviarReportePdf } from '../utils/reportes.js'
import { fechaValida, passwordSegura } from '../utils/validacion.js'

const router = Router()
const DIAS_ATENCION = [1, 2, 3, 4, 5, 6]

router.use(autenticar, soloAdministradores)

function limpiarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : ''
}

function datosMedico(cuerpo) {
  return {
    nombres: limpiarTexto(cuerpo.nombres),
    apellidos: limpiarTexto(cuerpo.apellidos),
    dni: limpiarTexto(cuerpo.dni),
    correo: limpiarTexto(cuerpo.correo).toLowerCase(),
    telefono: limpiarTexto(cuerpo.telefono),
    cmp: limpiarTexto(cuerpo.cmp),
    idEspecialidad: Number(cuerpo.idEspecialidad),
  }
}

function errorDatosMedico(medico) {
  if (
    !medico.nombres ||
    !medico.apellidos ||
    !medico.cmp ||
    !medico.idEspecialidad
  ) {
    return 'Completa todos los datos del médico.'
  }
  if (medico.nombres.length > 100 || medico.apellidos.length > 100) {
    return 'Los nombres y apellidos no pueden superar los 100 caracteres.'
  }
  if (!/^\d{8}$/.test(medico.dni)) return 'El DNI debe tener 8 dígitos.'
  if (!/^\d{9}$/.test(medico.telefono)) return 'El teléfono debe tener 9 dígitos.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(medico.correo) || medico.correo.length > 150) {
    return 'Ingresa un correo válido.'
  }
  if (medico.cmp.length > 20) return 'El CMP no puede superar los 20 caracteres.'

  return null
}

async function especialidadActiva(connection, idEspecialidad) {
  const [especialidades] = await connection.execute(
    'SELECT id_especialidad FROM especialidades WHERE id_especialidad = ? AND estado = 1',
    [idEspecialidad],
  )

  return especialidades.length > 0
}

function filtrosReporte(consulta) {
  const { desde, hasta } = consulta
  const idMedico = Number(consulta.idMedico) || null
  const idEspecialidad = Number(consulta.idEspecialidad) || null

  if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta) return null

  return { desde, hasta, idMedico, idEspecialidad }
}

async function obtenerReporte({ desde, hasta, idMedico, idEspecialidad }) {
  const condiciones = ['c.fecha BETWEEN ? AND ?']
  const parametros = [desde, hasta]

  if (idMedico) {
    condiciones.push('c.id_medico = ?')
    parametros.push(idMedico)
  }
  if (idEspecialidad) {
    condiciones.push('m.id_especialidad = ?')
    parametros.push(idEspecialidad)
  }

  const [filas] = await pool.execute(
    `SELECT
      c.id_cita AS id,
      DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
      TIME_FORMAT(c.hora, '%H:%i') AS hora,
      CONCAT(up.nombres, ' ', up.apellidos) AS paciente,
      CONCAT(um.nombres, ' ', um.apellidos) AS medico,
      e.nombre AS especialidad,
      c.estado
     FROM citas c
     INNER JOIN pacientes p ON p.id_paciente = c.id_paciente
     INNER JOIN usuarios up ON up.id_usuario = p.id_usuario
     INNER JOIN medicos m ON m.id_medico = c.id_medico
     INNER JOIN usuarios um ON um.id_usuario = m.id_usuario
     INNER JOIN especialidades e ON e.id_especialidad = m.id_especialidad
     WHERE ${condiciones.join(' AND ')}
     ORDER BY c.fecha, c.hora`,
    parametros,
  )
  const contar = (estados) =>
    filas.filter((fila) => estados.includes(fila.estado)).length

  return {
    filas,
    resumen: {
      total: filas.length,
      atendidas: contar(['completada']),
      canceladas: contar(['cancelada', 'rechazada']),
      activas: contar(['pendiente', 'confirmada', 'reprogramada']),
      vencidas: contar(['vencida']),
    },
  }
}

router.get('/perfil', async (req, res, next) => {
  try {
    const [[administrador]] = await pool.execute(
      `SELECT
        id_usuario AS idUsuario,
        nombres,
        apellidos,
        correo,
        rol
       FROM usuarios WHERE id_usuario = ? LIMIT 1`,
      [req.usuario.idUsuario],
    )

    return res.json({ administrador })
  } catch (error) {
    return next(error)
  }
})

router.put('/password', (req, res, next) =>
  cambiarPassword(req, res, next, () =>
    registrarAcceso(pool, req, { accion: 'cambiar_password' }),
  ),
)

router.get('/dashboard', async (req, res, next) => {
  try {
    const [[{ mesActual }]] = await pool.execute(
      "SELECT DATE_FORMAT(CURDATE(), '%Y-%m') AS mesActual",
    )
    const mes = req.query.mes || mesActual

    if (!/^\d{4}-\d{2}$/.test(mes) || !fechaValida(`${mes}-01`)) {
      return res.status(400).json({ mensaje: 'Selecciona un mes válido.' })
    }

    const inicio = `${mes}-01`
    const [[totales]] = await pool.execute(
      `SELECT
        COUNT(*) AS citas,
        COALESCE(SUM(estado = 'completada'), 0) AS atendidas,
        COALESCE(SUM(estado IN ('cancelada', 'rechazada')), 0) AS canceladas,
        COALESCE(SUM(estado IN ('pendiente', 'confirmada', 'reprogramada')), 0) AS activas,
        COALESCE(SUM(estado = 'vencida'), 0) AS vencidas
       FROM citas
       WHERE fecha BETWEEN ? AND LAST_DAY(?)`,
      [inicio, inicio],
    )
    const [especialidades] = await pool.execute(
      `SELECT
        e.id_especialidad AS id,
        e.nombre,
        COUNT(c.id_cita) AS citas
       FROM especialidades e
       LEFT JOIN medicos m ON m.id_especialidad = e.id_especialidad
       LEFT JOIN citas c ON c.id_medico = m.id_medico
         AND c.fecha BETWEEN ? AND LAST_DAY(?)
       WHERE e.estado = 1
       GROUP BY e.id_especialidad, e.nombre
       ORDER BY citas DESC, e.nombre`,
      [inicio, inicio],
    )
    const [[{ pacientes }]] = await pool.execute(
      `SELECT COUNT(*) AS pacientes
       FROM pacientes p
       INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE u.estado = 1`,
    )
    const [[{ medicos }]] = await pool.execute(
      `SELECT COUNT(*) AS medicos
       FROM medicos m
       INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
       WHERE u.estado = 1`,
    )

    return res.json({
      mes,
      citas: Number(totales.citas),
      atendidas: Number(totales.atendidas),
      canceladas: Number(totales.canceladas),
      activas: Number(totales.activas),
      vencidas: Number(totales.vencidas),
      pacientes: Number(pacientes),
      medicos: Number(medicos),
      especialidades: especialidades.map((item) => ({
        ...item,
        citas: Number(item.citas),
      })),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/especialidades', async (_req, res, next) => {
  try {
    const [especialidades] = await pool.execute(
      `SELECT
        e.id_especialidad AS id,
        e.nombre,
        e.descripcion,
        e.estado,
        COUNT(u.id_usuario) AS medicosActivos
       FROM especialidades e
       LEFT JOIN medicos m ON m.id_especialidad = e.id_especialidad
       LEFT JOIN usuarios u ON u.id_usuario = m.id_usuario AND u.estado = 1
       GROUP BY e.id_especialidad, e.nombre, e.descripcion, e.estado
       ORDER BY e.nombre`,
    )

    return res.json({ especialidades })
  } catch (error) {
    return next(error)
  }
})

router.post('/especialidades', async (req, res, next) => {
  const nombre = limpiarTexto(req.body.nombre)
  const descripcion = limpiarTexto(req.body.descripcion) || null

  if (!nombre || nombre.length > 100 || descripcion?.length > 255) {
    return res.status(400).json({
      mensaje: 'Indica un nombre de hasta 100 caracteres y una descripción de hasta 255.',
    })
  }

  try {
    const [resultado] = await pool.execute(
      'INSERT INTO especialidades (nombre, descripcion) VALUES (?, ?)',
      [nombre, descripcion],
    )

    return res.status(201).json({
      mensaje: 'Especialidad registrada correctamente.',
      id: resultado.insertId,
    })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Esa especialidad ya existe.' })
    }
    return next(error)
  }
})

router.put('/especialidades/:id', async (req, res, next) => {
  const nombre = limpiarTexto(req.body.nombre)
  const descripcion = limpiarTexto(req.body.descripcion) || null

  if (!nombre || nombre.length > 100 || descripcion?.length > 255) {
    return res.status(400).json({
      mensaje: 'Indica un nombre de hasta 100 caracteres y una descripción de hasta 255.',
    })
  }

  try {
    const [resultado] = await pool.execute(
      'UPDATE especialidades SET nombre = ?, descripcion = ? WHERE id_especialidad = ?',
      [nombre, descripcion, Number(req.params.id)],
    )

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Especialidad no encontrada.' })
    }

    return res.json({ mensaje: 'Especialidad actualizada correctamente.' })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Esa especialidad ya existe.' })
    }
    return next(error)
  }
})

router.patch('/especialidades/:id/estado', async (req, res, next) => {
  const idEspecialidad = Number(req.params.id)
  const activo = req.body.activo === true

  try {
    if (!activo) {
      const [[{ medicosActivos }]] = await pool.execute(
        `SELECT COUNT(*) AS medicosActivos
         FROM medicos m
         INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
         WHERE m.id_especialidad = ? AND u.estado = 1`,
        [idEspecialidad],
      )

      if (medicosActivos > 0) {
        return res.status(409).json({
          mensaje: `No se puede desactivar: tiene ${medicosActivos} médico(s) activo(s).`,
        })
      }
    }

    const [resultado] = await pool.execute(
      'UPDATE especialidades SET estado = ? WHERE id_especialidad = ?',
      [activo ? 1 : 0, idEspecialidad],
    )

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Especialidad no encontrada.' })
    }

    return res.json({
      mensaje: activo
        ? 'Especialidad activada correctamente.'
        : 'Especialidad desactivada correctamente.',
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/medicos', async (_req, res, next) => {
  try {
    const [medicos] = await pool.execute(
      `SELECT
        m.id_medico AS id,
        u.nombres,
        u.apellidos,
        u.dni,
        u.correo,
        u.telefono,
        u.estado,
        m.cmp,
        m.id_especialidad AS idEspecialidad,
        e.nombre AS especialidad
       FROM medicos m
       INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
       INNER JOIN especialidades e ON e.id_especialidad = m.id_especialidad
       ORDER BY u.apellidos, u.nombres`,
    )

    return res.json({ medicos })
  } catch (error) {
    return next(error)
  }
})

router.post('/medicos', async (req, res, next) => {
  const medico = datosMedico(req.body)
  const error = errorDatosMedico(medico)

  if (error) return res.status(400).json({ mensaje: error })

  if (!passwordSegura(req.body.password)) {
    return res.status(400).json({
      mensaje:
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
    })
  }

  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    if (!(await especialidadActiva(connection, medico.idEspecialidad))) {
      await connection.rollback()
      return res.status(400).json({ mensaje: 'Selecciona una especialidad activa.' })
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12)
    const [usuario] = await connection.execute(
      `INSERT INTO usuarios
        (nombres, apellidos, dni, correo, telefono, password_hash, rol)
       VALUES (?, ?, ?, ?, ?, ?, 'medico')`,
      [
        medico.nombres,
        medico.apellidos,
        medico.dni,
        medico.correo,
        medico.telefono,
        passwordHash,
      ],
    )
    const [nuevoMedico] = await connection.execute(
      'INSERT INTO medicos (id_usuario, id_especialidad, cmp) VALUES (?, ?, ?)',
      [usuario.insertId, medico.idEspecialidad, medico.cmp],
    )

    for (const dia of DIAS_ATENCION) {
      await connection.execute(
        `INSERT INTO disponibilidad_medica
          (id_medico, dia_semana, hora_inicio, hora_fin, duracion_minutos)
         VALUES (?, ?, '08:00:00', '17:00:00', 30)`,
        [nuevoMedico.insertId, dia],
      )
    }

    await connection.commit()

    return res.status(201).json({
      mensaje: 'Médico registrado correctamente.',
      id: nuevoMedico.insertId,
    })
  } catch (errorConsulta) {
    if (connection) await connection.rollback()
    if (errorConsulta.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'El DNI, correo o CMP ya está registrado.' })
    }
    return next(errorConsulta)
  } finally {
    connection?.release()
  }
})

router.put('/medicos/:id', async (req, res, next) => {
  const medico = datosMedico(req.body)
  const error = errorDatosMedico(medico)

  if (error) return res.status(400).json({ mensaje: error })

  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const [[actual]] = await connection.execute(
      `SELECT id_usuario AS idUsuario, id_especialidad AS idEspecialidad
       FROM medicos WHERE id_medico = ? LIMIT 1`,
      [Number(req.params.id)],
    )

    if (!actual) {
      await connection.rollback()
      return res.status(404).json({ mensaje: 'Médico no encontrado.' })
    }

    if (
      actual.idEspecialidad !== medico.idEspecialidad &&
      !(await especialidadActiva(connection, medico.idEspecialidad))
    ) {
      await connection.rollback()
      return res.status(400).json({ mensaje: 'Selecciona una especialidad activa.' })
    }

    await connection.execute(
      `UPDATE usuarios
       SET nombres = ?, apellidos = ?, dni = ?, correo = ?, telefono = ?
       WHERE id_usuario = ?`,
      [
        medico.nombres,
        medico.apellidos,
        medico.dni,
        medico.correo,
        medico.telefono,
        actual.idUsuario,
      ],
    )
    await connection.execute(
      'UPDATE medicos SET id_especialidad = ?, cmp = ? WHERE id_medico = ?',
      [medico.idEspecialidad, medico.cmp, Number(req.params.id)],
    )
    await connection.commit()

    return res.json({ mensaje: 'Médico actualizado correctamente.' })
  } catch (errorConsulta) {
    if (connection) await connection.rollback()
    if (errorConsulta.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'El DNI, correo o CMP ya está registrado.' })
    }
    return next(errorConsulta)
  } finally {
    connection?.release()
  }
})

router.patch('/medicos/:id/estado', async (req, res, next) => {
  const idMedico = Number(req.params.id)
  const activo = req.body.activo === true

  try {
    if (!activo) {
      const [[{ citasActivas }]] = await pool.execute(
        `SELECT COUNT(*) AS citasActivas
         FROM citas
         WHERE id_medico = ? AND fecha >= CURDATE()
           AND estado IN ('pendiente', 'confirmada', 'reprogramada')`,
        [idMedico],
      )

      if (citasActivas > 0) {
        return res.status(409).json({
          mensaje: `No se puede desactivar: tiene ${citasActivas} cita(s) activa(s) por atender.`,
        })
      }
    }

    const [resultado] = await pool.execute(
      `UPDATE usuarios u
       INNER JOIN medicos m ON m.id_usuario = u.id_usuario
       SET u.estado = ?
       WHERE m.id_medico = ?`,
      [activo ? 1 : 0, idMedico],
    )

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Médico no encontrado.' })
    }

    return res.json({
      mensaje: activo
        ? 'Médico activado correctamente.'
        : 'Médico desactivado correctamente.',
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/reportes', async (req, res, next) => {
  const filtros = filtrosReporte(req.query)

  if (!filtros) {
    return res.status(400).json({ mensaje: 'Indica un período válido.' })
  }

  try {
    await registrarAcceso(pool, req, {
      accion: 'ver_reporte',
      detalle: `${filtros.desde} al ${filtros.hasta}`,
    })

    return res.json(await obtenerReporte(filtros))
  } catch (error) {
    return next(error)
  }
})

router.get('/reportes/exportar', async (req, res, next) => {
  const filtros = filtrosReporte(req.query)
  const { formato } = req.query

  if (!filtros) {
    return res.status(400).json({ mensaje: 'Indica un período válido.' })
  }

  if (!['pdf', 'excel'].includes(formato)) {
    return res.status(400).json({ mensaje: 'Selecciona PDF o Excel.' })
  }

  try {
    const reporte = await obtenerReporte(filtros)
    const [[medico]] = await pool.execute(
      `SELECT CONCAT(u.nombres, ' ', u.apellidos) AS nombre
       FROM medicos m
       INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
       WHERE m.id_medico = ?`,
      [filtros.idMedico || 0],
    )
    const [[especialidad]] = await pool.execute(
      'SELECT nombre FROM especialidades WHERE id_especialidad = ?',
      [filtros.idEspecialidad || 0],
    )
    const datos = {
      ...reporte,
      filtros: {
        desde: filtros.desde,
        hasta: filtros.hasta,
        medico: medico?.nombre,
        especialidad: especialidad?.nombre,
      },
    }
    const nombreBase = `reporte-citas-${filtros.desde}-a-${filtros.hasta}`

    await registrarAcceso(pool, req, {
      accion: 'exportar_reporte',
      detalle: `${formato}: ${filtros.desde} al ${filtros.hasta}`,
    })

    if (formato === 'pdf') {
      res.attachment(`${nombreBase}.pdf`)
      return enviarReportePdf(res, datos)
    }

    res.attachment(`${nombreBase}.xlsx`)
    return await enviarReporteExcel(res, datos)
  } catch (error) {
    return next(error)
  }
})

router.get('/bitacora', async (req, res, next) => {
  const { desde, hasta } = req.query

  if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta) {
    return res.status(400).json({ mensaje: 'Indica un período válido.' })
  }

  try {
    const [registros] = await pool.execute(
      `SELECT
        b.id_bitacora AS id,
        DATE_FORMAT(b.fecha, '%Y-%m-%dT%H:%i:%s') AS fecha,
        b.usuario,
        b.rol,
        b.accion,
        b.detalle,
        b.ip,
        CONCAT(u.nombres, ' ', u.apellidos) AS paciente
       FROM bitacora_accesos b
       LEFT JOIN pacientes p ON p.id_paciente = b.id_paciente
       LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE b.fecha BETWEEN ? AND ?
       ORDER BY b.id_bitacora DESC
       LIMIT 500`,
      [`${desde} 00:00:00`, `${hasta} 23:59:59`],
    )

    return res.json({ registros })
  } catch (error) {
    return next(error)
  }
})

export default router
