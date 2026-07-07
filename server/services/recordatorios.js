import pool from '../config/db.js'
import { crearNotificacionConCanales } from './canalesNotificacion.js'

export async function generarRecordatorios(idPaciente = null) {
  const filtroPaciente = idPaciente ? 'AND c.id_paciente = ?' : ''
  const parametros = idPaciente ? [idPaciente] : []
  const [citas] = await pool.execute(
    `SELECT
      c.id_paciente AS idPaciente,
      c.id_cita AS idCita,
      up.correo,
      up.telefono,
      CONCAT(
        'recordatorio-cita:',
        c.id_cita, ':',
        DATE_FORMAT(c.fecha, '%Y-%m-%d'), ':',
        TIME_FORMAT(c.hora, '%H:%i')
      ) AS claveEvento,
      CONCAT(
        'Recordatorio: tienes una cita con ',
        um.nombres, ' ', um.apellidos,
        ' (', e.nombre, ') el ',
        DATE_FORMAT(c.fecha, '%d/%m/%Y'),
        ' a las ', TIME_FORMAT(c.hora, '%H:%i'), '.'
      ) AS mensaje
     FROM citas c
     INNER JOIN medicos m ON m.id_medico = c.id_medico
     INNER JOIN usuarios um ON um.id_usuario = m.id_usuario
     INNER JOIN pacientes p ON p.id_paciente = c.id_paciente
     INNER JOIN usuarios up ON up.id_usuario = p.id_usuario
     INNER JOIN especialidades e ON e.id_especialidad = m.id_especialidad
     WHERE c.estado IN ('pendiente', 'confirmada', 'reprogramada')
       ${filtroPaciente}
       AND TIMESTAMPDIFF(
         MINUTE,
         NOW(),
         TIMESTAMP(c.fecha, c.hora)
       ) BETWEEN 0 AND 30`,
    parametros,
  )

  let creados = 0

  for (const cita of citas) {
    const idNotificacion = await crearNotificacionConCanales(pool, {
      idPaciente: cita.idPaciente,
      idCita: cita.idCita,
      tipo: 'cita',
      claveEvento: cita.claveEvento,
      mensaje: cita.mensaje,
      correo: cita.correo,
      telefono: cita.telefono,
      asunto: 'Recordatorio de cita en MediLink',
    })

    if (idNotificacion) creados += 1
  }

  return creados
}
