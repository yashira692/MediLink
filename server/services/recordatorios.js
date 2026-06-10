import pool from '../config/db.js'

export async function generarRecordatorios(idPaciente = null) {
  const filtroPaciente = idPaciente ? 'AND c.id_paciente = ?' : ''
  const parametros = idPaciente ? [idPaciente] : []
  const [resultado] = await pool.execute(
    `INSERT IGNORE INTO notificaciones
      (id_paciente, id_cita, tipo, clave_evento, mensaje)
     SELECT
      c.id_paciente,
      c.id_cita,
      'cita',
      CONCAT(
        'recordatorio-24h:',
        c.id_cita, ':',
        DATE_FORMAT(c.fecha, '%Y-%m-%d'), ':',
        TIME_FORMAT(c.hora, '%H:%i')
      ),
      CONCAT(
        'Recordatorio: tienes una cita con ',
        u.nombres, ' ', u.apellidos,
        ' (', e.nombre, ') el ',
        DATE_FORMAT(c.fecha, '%d/%m/%Y'),
        ' a las ', TIME_FORMAT(c.hora, '%H:%i'), '.'
      )
     FROM citas c
     INNER JOIN medicos m ON m.id_medico = c.id_medico
     INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
     INNER JOIN especialidades e ON e.id_especialidad = m.id_especialidad
     WHERE c.estado IN ('pendiente', 'confirmada', 'reprogramada')
       ${filtroPaciente}
       AND TIMESTAMPDIFF(
         MINUTE,
         NOW(),
         TIMESTAMP(c.fecha, c.hora)
       ) BETWEEN 0 AND 1440`,
    parametros,
  )

  return resultado.affectedRows
}
