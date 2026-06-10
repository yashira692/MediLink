import 'dotenv/config'
import mysql from 'mysql2/promise'

const apiUrl = `http://localhost:${process.env.PORT || 3001}/api`
const correo = `prueba.citas.${Date.now()}@medilink.test`
let token

function siguienteDiaLaborable(desde = new Date()) {
  const fecha = new Date(desde)
  fecha.setDate(fecha.getDate() + 1)
  while (fecha.getDay() === 0) fecha.setDate(fecha.getDate() + 1)
  return fecha.toISOString().slice(0, 10)
}

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
      apellidos: 'Prueba',
      dni: String(Date.now()).slice(-8),
      correo,
      telefono: '999999999',
      password: 'Prueba2026!',
    }),
  })
  token = registro.token

  const catalogo = await solicitud('/citas/catalogo')
  const medico = catalogo.medicos[0]
  const fecha = siguienteDiaLaborable()
  const { horarios } = await solicitud(
    `/citas/horarios?idMedico=${medico.id}&fecha=${fecha}`,
  )

  if (horarios.length === 0) throw new Error('No se encontraron horarios de prueba.')

  await solicitud('/citas', {
    method: 'POST',
    body: JSON.stringify({
      idMedico: medico.id,
      fecha,
      hora: horarios[0],
      motivo: 'Prueba automática del flujo de citas',
    }),
  })

  const listado = await solicitud('/citas')
  const cita = listado.citas[0]
  const fechaReprogramada = siguienteDiaLaborable(
    new Date(`${fecha}T12:00:00`),
  )
  const { horarios: horariosReprogramacion } = await solicitud(
    `/citas/horarios?idMedico=${medico.id}&fecha=${fechaReprogramada}`,
  )

  await solicitud(`/citas/${cita.id}/reprogramar`, {
    method: 'PUT',
    body: JSON.stringify({
      fecha: fechaReprogramada,
      hora: horariosReprogramacion[0],
    }),
  })

  await solicitud(`/citas/${cita.id}/cancelar`, {
    method: 'PATCH',
    body: JSON.stringify({ motivo: 'Fin de prueba automática' }),
  })

  console.log(
    'Prueba de catálogo, horarios, reserva, listado, reprogramación y cancelación: correcta.',
  )
} finally {
  const [usuarios] = await db.execute(
    `SELECT u.id_usuario, p.id_paciente
     FROM usuarios u
     LEFT JOIN pacientes p ON p.id_usuario = u.id_usuario
     WHERE u.correo = ?`,
    [correo],
  )
  if (usuarios[0]) {
    await db.execute('DELETE FROM notificaciones WHERE id_paciente = ?', [
      usuarios[0].id_paciente,
    ])
    await db.execute('DELETE FROM citas WHERE id_paciente = ?', [
      usuarios[0].id_paciente,
    ])
    await db.execute('DELETE FROM usuarios WHERE id_usuario = ?', [
      usuarios[0].id_usuario,
    ])
  }
  await db.end()
}
