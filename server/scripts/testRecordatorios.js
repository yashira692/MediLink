import 'dotenv/config'
import mysql from 'mysql2/promise'

const apiUrl = `http://localhost:${process.env.PORT || 3001}/api`
const correo = `recordatorio.${Date.now()}@medilink.test`
let token
let idUsuario
let idPaciente
let idCita

async function solicitud(ruta, opciones = {}) {
  const respuesta = await fetch(`${apiUrl}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const datos = await respuesta.json()
  if (!respuesta.ok) throw new Error(datos.mensaje)
  return datos
}

const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

try {
  const registro = await solicitud('/auth/registro', {
    method: 'POST',
    body: JSON.stringify({
      nombres: 'Paciente',
      apellidos: 'Recordatorio',
      dni: String(Date.now()).slice(-8),
      correo,
      telefono: '900111222',
      password: 'Recordatorio2026',
    }),
  })
  token = registro.token
  idUsuario = registro.paciente.idUsuario
  idPaciente = registro.paciente.idPaciente

  const [[medico]] = await db.execute(
    'SELECT id_medico FROM medicos ORDER BY id_medico LIMIT 1',
  )
  const [[momento]] = await db.execute(
    `SELECT
      DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 2 HOUR), '%Y-%m-%d') AS fecha,
      DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 2 HOUR), '%H:%i:00') AS hora`,
  )
  const [cita] = await db.execute(
    `INSERT INTO citas
      (id_paciente, id_medico, fecha, hora, motivo, estado)
     VALUES (?, ?, ?, ?, 'Prueba de recordatorio', 'confirmada')`,
    [idPaciente, medico.id_medico, momento.fecha, momento.hora],
  )
  idCita = cita.insertId

  const primeraGeneracion = await solicitud(
    '/notificaciones/generar-recordatorios',
    { method: 'POST' },
  )
  const segundaGeneracion = await solicitud(
    '/notificaciones/generar-recordatorios',
    { method: 'POST' },
  )
  const [recordatorios] = await db.execute(
    `SELECT id_notificacion
     FROM notificaciones
     WHERE id_cita = ? AND clave_evento LIKE 'recordatorio-24h:%'`,
    [idCita],
  )

  if (primeraGeneracion.creados !== 1 || segundaGeneracion.creados !== 0) {
    throw new Error('La generación de recordatorios no es idempotente.')
  }
  if (recordatorios.length !== 1) {
    throw new Error('Se generó una cantidad incorrecta de recordatorios.')
  }

  await solicitud(`/citas/${idCita}/cancelar`, {
    method: 'PATCH',
    body: JSON.stringify({ motivo: 'Fin de prueba automática' }),
  })
  const [recordatoriosRestantes] = await db.execute(
    `SELECT id_notificacion
     FROM notificaciones
     WHERE id_cita = ? AND clave_evento LIKE 'recordatorio-24h:%'`,
    [idCita],
  )

  if (recordatoriosRestantes.length !== 0) {
    throw new Error('El recordatorio no fue retirado al cancelar la cita.')
  }

  console.log(
    'Recordatorio 24h, prevención de duplicados y cancelación: correctos.',
  )
} finally {
  if (idPaciente) {
    await db.execute('DELETE FROM notificaciones WHERE id_paciente = ?', [
      idPaciente,
    ])
    await db.execute('DELETE FROM citas WHERE id_paciente = ?', [idPaciente])
  }
  if (idUsuario) {
    await db.execute('DELETE FROM usuarios WHERE id_usuario = ?', [idUsuario])
  }
  await db.end()
}
