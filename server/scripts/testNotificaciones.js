import 'dotenv/config'
import mysql from 'mysql2/promise'

const apiUrl = `http://localhost:${process.env.PORT || 3001}/api`
const correo = `notificaciones.${Date.now()}@medilink.test`
let token
let idPaciente
let idUsuario

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
      apellidos: 'Notificaciones',
      dni: String(Date.now()).slice(-8),
      correo,
      telefono: '966666666',
      password: 'Prueba2026!',
    }),
  })
  token = registro.token
  idPaciente = registro.paciente.idPaciente
  idUsuario = registro.paciente.idUsuario

  await db.execute(
    `INSERT INTO notificaciones (id_paciente, tipo, mensaje)
     VALUES (?, 'cita', 'Notificación adicional de prueba.')`,
    [idPaciente],
  )

  let listado = await solicitud('/notificaciones')
  if (listado.notificaciones.length !== 2 || listado.noLeidas !== 2) {
    throw new Error('El listado inicial de notificaciones no es correcto.')
  }

  await solicitud(`/notificaciones/${listado.notificaciones[0].id}/leer`, {
    method: 'PATCH',
  })
  listado = await solicitud('/notificaciones')
  if (listado.noLeidas !== 1) {
    throw new Error('La lectura individual no actualizó el contador.')
  }

  await solicitud('/notificaciones/leer-todas', { method: 'PATCH' })
  listado = await solicitud('/notificaciones')
  if (listado.noLeidas !== 0) {
    throw new Error('La lectura total no actualizó el contador.')
  }

  console.log('Listado, contador y marcado de notificaciones: correctos.')
} finally {
  if (idPaciente) {
    await db.execute('DELETE FROM notificaciones WHERE id_paciente = ?', [
      idPaciente,
    ])
  }
  if (idUsuario) {
    await db.execute('DELETE FROM usuarios WHERE id_usuario = ?', [idUsuario])
  }
  await db.end()
}
