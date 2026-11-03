import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pool from '../config/db.js'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)

export const storageRoot = path.resolve(
  projectRoot,
  'storage',
  'medical-documents',
)

export async function obtenerHistorialPaciente(idPaciente) {
  const [consultas] = await pool.execute(
    `SELECT
      h.id_historial AS id,
      DATE_FORMAT(h.fecha_consulta, '%Y-%m-%d') AS fecha,
      h.descripcion,
      h.diagnostico,
      h.observaciones,
      CONCAT(u.nombres, ' ', u.apellidos) AS medico,
      e.nombre AS especialidad,
      (
        SELECT d.id_documento
        FROM documentos_medicos d
        WHERE d.id_historial = h.id_historial AND d.tipo = 'informe'
        ORDER BY d.id_documento DESC LIMIT 1
      ) AS idDocumento
     FROM historial_medico h
     INNER JOIN medicos m ON m.id_medico = h.id_medico
     INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
     INNER JOIN especialidades e ON e.id_especialidad = m.id_especialidad
     WHERE h.id_paciente = ?
     ORDER BY h.fecha_consulta DESC`,
    [idPaciente],
  )

  const [recetas] = await pool.execute(
    `SELECT
      r.id_receta AS id,
      DATE_FORMAT(r.fecha_emision, '%Y-%m-%d') AS fecha,
      r.indicaciones_generales AS indicacionesGenerales,
      CONCAT(u.nombres, ' ', u.apellidos) AS medico,
      e.nombre AS especialidad,
      (
        SELECT d.id_documento
        FROM documentos_medicos d
        WHERE d.id_receta = r.id_receta AND d.tipo = 'receta'
        ORDER BY d.id_documento DESC LIMIT 1
      ) AS idDocumento
     FROM recetas r
     INNER JOIN historial_medico h ON h.id_historial = r.id_historial
     INNER JOIN medicos m ON m.id_medico = h.id_medico
     INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
     INNER JOIN especialidades e ON e.id_especialidad = m.id_especialidad
     WHERE h.id_paciente = ?
     ORDER BY r.fecha_emision DESC`,
    [idPaciente],
  )
  const idsRecetas = recetas.map((receta) => receta.id)
  let detalles = []

  if (idsRecetas.length > 0) {
    const placeholders = idsRecetas.map(() => '?').join(', ')
    const [filasDetalle] = await pool.execute(
      `SELECT
        id_receta AS idReceta,
        medicamento,
        dosis,
        frecuencia,
        duracion,
        indicacion
       FROM detalle_receta
       WHERE id_receta IN (${placeholders})
       ORDER BY id_detalle`,
      idsRecetas,
    )
    detalles = filasDetalle
  }

  const recetasConDetalle = recetas.map((receta) => ({
    ...receta,
    medicamentos: detalles.filter(
      (detalle) => detalle.idReceta === receta.id,
    ),
  }))

  const [resultados] = await pool.execute(
    `SELECT
      r.id_resultado AS id,
      r.nombre_examen AS nombreExamen,
      r.resultado,
      DATE_FORMAT(r.fecha_resultado, '%Y-%m-%d') AS fecha,
      r.estado,
      (
        SELECT d.id_documento
        FROM documentos_medicos d
        WHERE d.id_resultado = r.id_resultado AND d.tipo = 'resultado'
        ORDER BY d.id_documento DESC LIMIT 1
      ) AS idDocumento
     FROM resultados_laboratorio r
     WHERE r.id_paciente = ?
     ORDER BY r.fecha_resultado DESC`,
    [idPaciente],
  )

  return {
    consultas,
    recetas: recetasConDetalle,
    resultados,
  }
}

export function enviarDocumento(res, documento) {
  if (documento.contenido) {
    // En UTF-8 explícito: res.send corrompe las tildes y la ñ de res.attachment.
    res.set(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(documento.nombre_original)}`,
    )
    res.type(documento.mime_type)
    return res.send(documento.contenido)
  }

  // Documentos antiguos que siguen en el disco de una instalación local.
  if (!documento.ruta_relativa) {
    return res.status(404).json({ mensaje: 'El archivo ya no está disponible.' })
  }

  const ruta = path.resolve(storageRoot, documento.ruta_relativa)
  const rutaPermitida = `${storageRoot}${path.sep}`

  if (!ruta.startsWith(rutaPermitida)) {
    return res.status(400).json({ mensaje: 'Ruta de documento no válida.' })
  }

  if (!fs.existsSync(ruta)) {
    return res.status(404).json({ mensaje: 'El archivo ya no está disponible.' })
  }

  res.type(documento.mime_type)
  return res.download(ruta, documento.nombre_original)
}
