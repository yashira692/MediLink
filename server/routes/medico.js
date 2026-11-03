import crypto from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import pool from '../config/db.js'
import { autenticar, soloMedicos } from '../middleware/auth.js'
import { registrarAcceso } from '../services/bitacora.js'
import { crearNotificacionConCanales } from '../services/canalesNotificacion.js'
import { cambiarPassword } from '../services/cuenta.js'
import {
  fechaHoraFutura,
  obtenerDisponibilidad,
} from '../services/disponibilidad.js'
import {
  enviarDocumento,
  obtenerHistorialPaciente,
} from '../services/historial.js'
import { crearPdfMedico } from '../utils/pdf.js'
import { fechaValida } from '../utils/validacion.js'

const router = Router()
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/
const MAX_MEDICAMENTOS = 20
const MAX_TAMANO_PDF = 10 * 1024 * 1024
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TAMANO_PDF, files: 1 },
}).single('archivo')

router.use(autenticar, soloMedicos)

function recibirArchivo(req, res, next) {
  subida(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ mensaje: 'El PDF no puede superar los 10 MB.' })
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ mensaje: 'No se pudo leer el archivo enviado.' })
    }

    return next(error)
  })
}

function nombreOriginalSeguro(nombre) {
  // multer entrega el nombre en latin1 aunque el navegador lo envíe en UTF-8.
  const limpio = Buffer.from(nombre, 'latin1')
    .toString('utf8')
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .trim()
    .slice(0, 200)

  if (!limpio) return 'documento.pdf'
  return limpio.toLowerCase().endsWith('.pdf') ? limpio : `${limpio}.pdf`
}

function limpiarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : ''
}

function fechaLegible(fecha) {
  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${fecha}T00:00:00Z`))
}

async function obtenerCitaDelMedico(connection, idCita, idMedico) {
  const [[cita]] = await connection.execute(
    `SELECT
      c.id_cita AS id,
      c.id_paciente AS idPaciente,
      c.estado,
      DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
      TIME_FORMAT(c.hora, '%H:%i:%s') AS hora,
      c.motivo,
      c.fecha > CURDATE() AS esFutura,
      u.correo,
      u.telefono,
      CONCAT(u.nombres, ' ', u.apellidos) AS paciente
     FROM citas c
     INNER JOIN pacientes p ON p.id_paciente = c.id_paciente
     INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
     WHERE c.id_cita = ? AND c.id_medico = ?
     LIMIT 1
     FOR UPDATE`,
    [idCita, idMedico],
  )

  return cita
}

async function atiendeAlPaciente(idMedico, idPaciente) {
  const [citas] = await pool.execute(
    'SELECT id_cita FROM citas WHERE id_medico = ? AND id_paciente = ? LIMIT 1',
    [idMedico, idPaciente],
  )

  return citas.length > 0
}

function validarMedicamentos(medicamentos) {
  if (medicamentos === undefined) return []
  if (!Array.isArray(medicamentos) || medicamentos.length > MAX_MEDICAMENTOS) {
    return null
  }

  const limpios = medicamentos.map((item) => ({
    medicamento: limpiarTexto(item?.medicamento),
    dosis: limpiarTexto(item?.dosis),
    frecuencia: limpiarTexto(item?.frecuencia),
    duracion: limpiarTexto(item?.duracion),
    indicacion: limpiarTexto(item?.indicacion) || null,
  }))
  const validos = limpios.every(
    (item) =>
      item.medicamento &&
      item.medicamento.length <= 150 &&
      item.dosis &&
      item.dosis.length <= 100 &&
      item.frecuencia &&
      item.frecuencia.length <= 100 &&
      item.duracion &&
      item.duracion.length <= 100,
  )

  return validos ? limpios : null
}

async function registrarDocumento(connection, datos, contenido) {
  await connection.execute(
    `INSERT INTO documentos_medicos
      (id_paciente, id_historial, id_receta, id_resultado, tipo,
       nombre_original, nombre_archivo, contenido, mime_type, tamano_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'application/pdf', ?)`,
    [
      datos.idPaciente,
      datos.idHistorial ?? null,
      datos.idReceta ?? null,
      datos.idResultado ?? null,
      datos.tipo,
      datos.nombreOriginal,
      datos.nombreArchivo,
      contenido,
      contenido.length,
    ],
  )
}

async function guardarDocumento(connection, datos) {
  const contenido = await crearPdfMedico({
    titulo: datos.titulo,
    paciente: datos.paciente,
    medico: datos.medico,
    fecha: datos.fecha,
    secciones: datos.secciones,
  })

  await registrarDocumento(connection, datos, contenido)
}

router.get('/perfil', async (req, res, next) => {
  try {
    const [[medico]] = await pool.execute(
      `SELECT
        u.id_usuario AS idUsuario,
        m.id_medico AS idMedico,
        u.nombres,
        u.apellidos,
        u.correo,
        m.cmp,
        e.nombre AS especialidad,
        u.rol
       FROM medicos m
       INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
       INNER JOIN especialidades e ON e.id_especialidad = m.id_especialidad
       WHERE m.id_medico = ?
       LIMIT 1`,
      [req.usuario.idMedico],
    )

    if (!medico) {
      return res.status(404).json({ mensaje: 'Médico no encontrado.' })
    }

    return res.json({ medico })
  } catch (error) {
    return next(error)
  }
})

router.put('/password', (req, res, next) =>
  cambiarPassword(req, res, next, () =>
    registrarAcceso(pool, req, { accion: 'cambiar_password' }),
  ),
)

router.get('/citas', async (req, res, next) => {
  const { desde, hasta } = req.query

  if (!FORMATO_FECHA.test(desde || '') || !FORMATO_FECHA.test(hasta || '')) {
    return res.status(400).json({ mensaje: 'Indica un rango de fechas válido.' })
  }

  try {
    const [citas] = await pool.execute(
      `SELECT
        c.id_cita AS id,
        c.id_paciente AS idPaciente,
        DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
        TIME_FORMAT(c.hora, '%H:%i') AS hora,
        c.motivo,
        c.estado,
        c.motivo_cancelacion AS motivoCancelacion,
        CONCAT(u.nombres, ' ', u.apellidos) AS paciente,
        u.dni,
        u.telefono
       FROM citas c
       INNER JOIN pacientes p ON p.id_paciente = c.id_paciente
       INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE c.id_medico = ? AND c.fecha BETWEEN ? AND ?
       ORDER BY c.fecha, c.hora`,
      [req.usuario.idMedico, desde, hasta],
    )

    return res.json({ citas })
  } catch (error) {
    return next(error)
  }
})

router.get('/horarios', async (req, res, next) => {
  const fecha = req.query.fecha

  if (!FORMATO_FECHA.test(fecha || '')) {
    return res.status(400).json({ mensaje: 'Selecciona una fecha.' })
  }

  try {
    const horarios = await obtenerDisponibilidad(
      pool,
      req.usuario.idMedico,
      fecha,
    )
    return res.json({ horarios })
  } catch (error) {
    return next(error)
  }
})

router.patch('/citas/:id/aprobar', async (req, res, next) => {
  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const cita = await obtenerCitaDelMedico(
      connection,
      Number(req.params.id),
      req.usuario.idMedico,
    )

    if (!cita || !['pendiente', 'reprogramada'].includes(cita.estado)) {
      await connection.rollback()
      return res.status(404).json({ mensaje: 'La cita no puede ser aprobada.' })
    }

    await connection.execute(
      "UPDATE citas SET estado = 'confirmada' WHERE id_cita = ?",
      [cita.id],
    )
    await crearNotificacionConCanales(connection, {
      idPaciente: cita.idPaciente,
      idCita: cita.id,
      tipo: 'cita',
      mensaje: `Tu cita del ${cita.fecha} a las ${cita.hora.slice(0, 5)} fue confirmada por el médico.`,
      correo: cita.correo,
      telefono: cita.telefono,
      asunto: 'Cita confirmada en MediLink',
    })
    await registrarAcceso(connection, req, {
      accion: 'aprobar_cita',
      idPaciente: cita.idPaciente,
      detalle: `Cita ${cita.id}`,
    })
    await connection.commit()

    return res.json({ mensaje: 'Cita confirmada correctamente.' })
  } catch (error) {
    if (connection) await connection.rollback()
    return next(error)
  } finally {
    connection?.release()
  }
})

router.patch('/citas/:id/cancelar', async (req, res, next) => {
  const motivo = limpiarTexto(req.body?.motivo) || 'Cancelada por el médico'
  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const cita = await obtenerCitaDelMedico(
      connection,
      Number(req.params.id),
      req.usuario.idMedico,
    )

    if (
      !cita ||
      !['pendiente', 'confirmada', 'reprogramada'].includes(cita.estado)
    ) {
      await connection.rollback()
      return res.status(404).json({ mensaje: 'La cita no puede ser cancelada.' })
    }

    await connection.execute(
      `UPDATE citas
       SET estado = 'cancelada', motivo_cancelacion = ?
       WHERE id_cita = ?`,
      [motivo.slice(0, 500), cita.id],
    )
    await connection.execute(
      `DELETE FROM notificaciones
       WHERE id_cita = ? AND clave_evento LIKE 'recordatorio-cita:%'`,
      [cita.id],
    )
    await crearNotificacionConCanales(connection, {
      idPaciente: cita.idPaciente,
      idCita: cita.id,
      tipo: 'cita',
      mensaje: `El médico canceló tu cita del ${cita.fecha} a las ${cita.hora.slice(0, 5)}.`,
      correo: cita.correo,
      telefono: cita.telefono,
      asunto: 'Cita cancelada en MediLink',
    })
    await registrarAcceso(connection, req, {
      accion: 'cancelar_cita',
      idPaciente: cita.idPaciente,
      detalle: `Cita ${cita.id}`,
    })
    await connection.commit()

    return res.json({ mensaje: 'Cita cancelada correctamente.' })
  } catch (error) {
    if (connection) await connection.rollback()
    return next(error)
  } finally {
    connection?.release()
  }
})

router.put('/citas/:id/reprogramar', async (req, res, next) => {
  const { fecha, hora } = req.body

  if (!FORMATO_FECHA.test(fecha || '') || !fechaHoraFutura(fecha, hora)) {
    return res.status(400).json({ mensaje: 'Selecciona una fecha y hora futura.' })
  }

  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const cita = await obtenerCitaDelMedico(
      connection,
      Number(req.params.id),
      req.usuario.idMedico,
    )

    if (
      !cita ||
      !['pendiente', 'confirmada', 'reprogramada'].includes(cita.estado)
    ) {
      await connection.rollback()
      return res.status(404).json({ mensaje: 'La cita no puede ser reprogramada.' })
    }

    const horarios = await obtenerDisponibilidad(
      connection,
      req.usuario.idMedico,
      fecha,
    )

    if (!horarios.includes(hora)) {
      await connection.rollback()
      return res.status(409).json({ mensaje: 'Ese horario no está disponible.' })
    }

    await connection.execute(
      `DELETE FROM notificaciones
       WHERE id_cita = ? AND clave_evento LIKE 'recordatorio-cita:%'`,
      [cita.id],
    )
    await connection.execute(
      `UPDATE citas
       SET fecha = ?, hora = ?, estado = 'reprogramada'
       WHERE id_cita = ?`,
      [fecha, hora, cita.id],
    )
    await crearNotificacionConCanales(connection, {
      idPaciente: cita.idPaciente,
      idCita: cita.id,
      tipo: 'cita',
      mensaje: `El médico reprogramó tu cita para el ${fecha} a las ${hora}.`,
      correo: cita.correo,
      telefono: cita.telefono,
      asunto: 'Cita reprogramada en MediLink',
    })
    await registrarAcceso(connection, req, {
      accion: 'reprogramar_cita',
      idPaciente: cita.idPaciente,
      detalle: `Cita ${cita.id}`,
    })
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

router.post('/citas/:id/consulta', async (req, res, next) => {
  const descripcion = limpiarTexto(req.body.descripcion) || null
  const diagnostico = limpiarTexto(req.body.diagnostico)
  const observaciones = limpiarTexto(req.body.observaciones) || null
  const indicacionesGenerales =
    limpiarTexto(req.body.indicacionesGenerales) || null
  const medicamentos = validarMedicamentos(req.body.medicamentos)

  if (!diagnostico) {
    return res.status(400).json({ mensaje: 'Registra el diagnóstico de la consulta.' })
  }

  if (!medicamentos) {
    return res.status(400).json({
      mensaje: 'Completa medicamento, dosis, frecuencia y duración de la receta.',
    })
  }

  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const cita = await obtenerCitaDelMedico(
      connection,
      Number(req.params.id),
      req.usuario.idMedico,
    )

    if (!cita) {
      await connection.rollback()
      return res.status(404).json({ mensaje: 'Cita no encontrada.' })
    }

    if (!['confirmada', 'reprogramada', 'vencida'].includes(cita.estado)) {
      await connection.rollback()
      return res.status(409).json({
        mensaje: 'Solo se puede atender una cita confirmada, reprogramada o vencida.',
      })
    }

    if (cita.esFutura) {
      await connection.rollback()
      return res.status(409).json({
        mensaje: 'La consulta se registra el día de la cita o después.',
      })
    }

    const [[medico]] = await connection.execute(
      `SELECT CONCAT(u.nombres, ' ', u.apellidos) AS nombre
       FROM medicos m
       INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
       WHERE m.id_medico = ?`,
      [req.usuario.idMedico],
    )
    const [historial] = await connection.execute(
      `INSERT INTO historial_medico
        (id_paciente, id_medico, id_cita, fecha_consulta, descripcion,
         diagnostico, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cita.idPaciente,
        req.usuario.idMedico,
        cita.id,
        `${cita.fecha} ${cita.hora}`,
        descripcion || cita.motivo,
        diagnostico,
        observaciones,
      ],
    )
    const idHistorial = historial.insertId
    const fecha = fechaLegible(cita.fecha)

    await connection.execute(
      "UPDATE citas SET estado = 'completada' WHERE id_cita = ?",
      [cita.id],
    )
    await guardarDocumento(connection, {
      idPaciente: cita.idPaciente,
      idHistorial,
      idReceta: null,
      tipo: 'informe',
      nombreOriginal: 'informe-consulta.pdf',
      nombreArchivo: `paciente-${cita.idPaciente}-informe-${idHistorial}.pdf`,
      titulo: 'Informe de consulta médica',
      paciente: cita.paciente,
      medico: medico.nombre,
      fecha,
      secciones: [
        { titulo: 'Descripción', contenido: descripcion || cita.motivo },
        { titulo: 'Diagnóstico', contenido: diagnostico },
        ...(observaciones
          ? [{ titulo: 'Observaciones', contenido: observaciones }]
          : []),
      ],
    })

    let idReceta = null

    if (medicamentos.length > 0) {
      const [receta] = await connection.execute(
        `INSERT INTO recetas (id_historial, indicaciones_generales)
         VALUES (?, ?)`,
        [idHistorial, indicacionesGenerales],
      )
      idReceta = receta.insertId

      for (const item of medicamentos) {
        await connection.execute(
          `INSERT INTO detalle_receta
            (id_receta, medicamento, dosis, frecuencia, duracion, indicacion)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            idReceta,
            item.medicamento,
            item.dosis,
            item.frecuencia,
            item.duracion,
            item.indicacion,
          ],
        )
      }

      await guardarDocumento(connection, {
        idPaciente: cita.idPaciente,
        idHistorial,
        idReceta,
        tipo: 'receta',
        nombreOriginal: 'receta-digital.pdf',
        nombreArchivo: `paciente-${cita.idPaciente}-receta-${idReceta}.pdf`,
        titulo: 'Receta digital',
        paciente: cita.paciente,
        medico: medico.nombre,
        fecha,
        secciones: [
          ...medicamentos.map((item) => ({
            titulo: `${item.medicamento} ${item.dosis}`,
            contenido: [
              `${item.frecuencia} durante ${item.duracion}.`,
              item.indicacion,
            ]
              .filter(Boolean)
              .join(' '),
          })),
          ...(indicacionesGenerales
            ? [{ titulo: 'Indicaciones generales', contenido: indicacionesGenerales }]
            : []),
        ],
      })
    }

    await crearNotificacionConCanales(connection, {
      idPaciente: cita.idPaciente,
      idCita: cita.id,
      tipo: idReceta ? 'receta' : 'cita',
      mensaje: idReceta
        ? 'Tu consulta y tu receta digital ya están disponibles en tu historial médico.'
        : 'Tu consulta ya está disponible en tu historial médico.',
      correo: cita.correo,
      telefono: cita.telefono,
      asunto: 'Consulta registrada en MediLink',
    })
    await registrarAcceso(connection, req, {
      accion: 'registrar_consulta',
      idPaciente: cita.idPaciente,
      detalle: `Cita ${cita.id}`,
    })
    await connection.commit()

    return res.status(201).json({
      mensaje: 'Consulta registrada correctamente.',
      idHistorial,
      idReceta,
    })
  } catch (error) {
    if (connection) await connection.rollback()
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Esta cita ya tiene una consulta registrada.' })
    }
    return next(error)
  } finally {
    connection?.release()
  }
})

router.get('/pacientes', async (req, res, next) => {
  try {
    const [pacientes] = await pool.execute(
      `SELECT
        p.id_paciente AS id,
        CONCAT(u.nombres, ' ', u.apellidos) AS nombre,
        u.dni,
        u.telefono,
        DATE_FORMAT(MAX(c.fecha), '%Y-%m-%d') AS ultimaCita
       FROM citas c
       INNER JOIN pacientes p ON p.id_paciente = c.id_paciente
       INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE c.id_medico = ?
       GROUP BY p.id_paciente, u.nombres, u.apellidos, u.dni, u.telefono
       ORDER BY u.apellidos, u.nombres`,
      [req.usuario.idMedico],
    )

    return res.json({ pacientes })
  } catch (error) {
    return next(error)
  }
})

router.get('/pacientes/:id/historial', async (req, res, next) => {
  const idPaciente = Number(req.params.id)

  try {
    if (!(await atiendeAlPaciente(req.usuario.idMedico, idPaciente))) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado.' })
    }

    const [[paciente]] = await pool.execute(
      `SELECT
        p.id_paciente AS id,
        CONCAT(u.nombres, ' ', u.apellidos) AS nombre,
        u.dni,
        u.telefono,
        DATE_FORMAT(p.fecha_nacimiento, '%Y-%m-%d') AS fechaNacimiento
       FROM pacientes p
       INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.id_paciente = ?`,
      [idPaciente],
    )

    await registrarAcceso(pool, req, { accion: 'ver_historial', idPaciente })

    return res.json({
      paciente,
      ...(await obtenerHistorialPaciente(idPaciente)),
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/pacientes/:id/documentos', recibirArchivo, async (req, res, next) => {
  const idPaciente = Number(req.params.id)
  const tipo = req.body?.tipo
  const archivo = req.file

  if (!Number.isInteger(idPaciente)) {
    return res.status(404).json({ mensaje: 'Paciente no encontrado.' })
  }

  if (!['resultado', 'informe', 'receta'].includes(tipo)) {
    return res.status(400).json({ mensaje: 'Selecciona el tipo de documento.' })
  }

  if (!archivo) {
    return res.status(400).json({ mensaje: 'Selecciona un archivo PDF.' })
  }

  if (archivo.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return res.status(400).json({ mensaje: 'El archivo debe ser un PDF válido.' })
  }

  const nombreExamen = limpiarTexto(req.body.nombreExamen)
  const fechaResultado = req.body.fechaResultado
  const resumen = limpiarTexto(req.body.resumen) || null

  if (
    tipo === 'resultado' &&
    (!nombreExamen || nombreExamen.length > 150 || !fechaValida(fechaResultado))
  ) {
    return res.status(400).json({ mensaje: 'Indica el nombre del examen y su fecha.' })
  }

  const nombreArchivo =
    `paciente-${idPaciente}-${tipo}-subido-${crypto.randomUUID()}.pdf`
  let connection

  try {
    if (!(await atiendeAlPaciente(req.usuario.idMedico, idPaciente))) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado.' })
    }

    connection = await pool.getConnection()
    await connection.beginTransaction()

    const datos = {
      idPaciente,
      tipo,
      nombreArchivo,
      nombreOriginal: nombreOriginalSeguro(archivo.originalname),
    }
    let mensaje
    let tipoNotificacion

    if (tipo === 'resultado') {
      const [[{ esFutura }]] = await connection.execute(
        'SELECT ? > CURDATE() AS esFutura',
        [fechaResultado],
      )

      if (esFutura) {
        await connection.rollback()
        return res.status(400).json({ mensaje: 'La fecha del examen no puede ser futura.' })
      }

      const [resultado] = await connection.execute(
        `INSERT INTO resultados_laboratorio
          (id_paciente, nombre_examen, resultado, fecha_resultado, estado)
         VALUES (?, ?, ?, ?, 'disponible')`,
        [idPaciente, nombreExamen, resumen, fechaResultado],
      )
      datos.idResultado = resultado.insertId
      mensaje = `Tu resultado de ${nombreExamen} ya está disponible en tu historial médico.`
      tipoNotificacion = 'resultado'
    }

    if (tipo === 'informe') {
      const [[consulta]] = await connection.execute(
        `SELECT id_historial AS id FROM historial_medico
         WHERE id_historial = ? AND id_paciente = ? AND id_medico = ?
         LIMIT 1`,
        [Number(req.body.idHistorial) || 0, idPaciente, req.usuario.idMedico],
      )

      if (!consulta) {
        await connection.rollback()
        return res.status(404).json({ mensaje: 'Selecciona una consulta registrada por ti.' })
      }

      datos.idHistorial = consulta.id
      mensaje = 'Tu médico agregó un informe a tu historial médico.'
      tipoNotificacion = 'sistema'
    }

    if (tipo === 'receta') {
      const [[receta]] = await connection.execute(
        `SELECT r.id_receta AS id, r.id_historial AS idHistorial
         FROM recetas r
         INNER JOIN historial_medico h ON h.id_historial = r.id_historial
         WHERE r.id_receta = ? AND h.id_paciente = ? AND h.id_medico = ?
         LIMIT 1`,
        [Number(req.body.idReceta) || 0, idPaciente, req.usuario.idMedico],
      )

      if (!receta) {
        await connection.rollback()
        return res.status(404).json({ mensaje: 'Selecciona una receta emitida por ti.' })
      }

      datos.idReceta = receta.id
      datos.idHistorial = receta.idHistorial
      mensaje = 'Tu médico agregó un documento a tu receta digital.'
      tipoNotificacion = 'receta'
    }

    await registrarDocumento(connection, datos, archivo.buffer)

    const [[contacto]] = await connection.execute(
      `SELECT u.correo, u.telefono
       FROM pacientes p
       INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.id_paciente = ?`,
      [idPaciente],
    )
    await crearNotificacionConCanales(connection, {
      idPaciente,
      tipo: tipoNotificacion,
      mensaje,
      correo: contacto.correo,
      telefono: contacto.telefono,
      asunto: 'Nuevo documento en MediLink',
    })
    await registrarAcceso(connection, req, {
      accion: 'subir_documento',
      idPaciente,
      detalle: `Tipo: ${tipo}`,
    })
    await connection.commit()

    return res.status(201).json({ mensaje: 'Documento subido correctamente.' })
  } catch (error) {
    if (connection) await connection.rollback()
    return next(error)
  } finally {
    connection?.release()
  }
})

router.get('/documentos/:id/descargar', async (req, res, next) => {
  try {
    const [documentos] = await pool.execute(
      `SELECT
        d.id_paciente,
        d.tipo,
        d.nombre_original,
        d.ruta_relativa,
        d.contenido,
        d.mime_type
       FROM documentos_medicos d
       WHERE d.id_documento = ?
         AND EXISTS (
           SELECT 1 FROM citas c
           WHERE c.id_paciente = d.id_paciente AND c.id_medico = ?
         )
       LIMIT 1`,
      [Number(req.params.id), req.usuario.idMedico],
    )
    const documento = documentos[0]

    if (!documento) {
      return res.status(404).json({ mensaje: 'Documento no encontrado.' })
    }

    await registrarAcceso(pool, req, {
      accion: 'descargar_documento',
      idPaciente: documento.id_paciente,
      detalle: `Documento ${Number(req.params.id)} (${documento.tipo})`,
    })

    return enviarDocumento(res, documento)
  } catch (error) {
    return next(error)
  }
})

export default router
