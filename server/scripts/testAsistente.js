import 'dotenv/config'
import mysql from 'mysql2/promise'

const apiUrl = `http://localhost:${process.env.PORT || 3001}/api`
const correo = `asistente.${Date.now()}@medilink.test`
let token
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

async function preguntar(pregunta) {
  const datos = await solicitud('/asistente/consultar', {
    method: 'POST',
    body: JSON.stringify({ pregunta }),
  })
  return datos.consulta
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
      apellidos: 'Asistente',
      dni: String(Date.now()).slice(-8),
      correo,
      telefono: '944444444',
      password: 'Prueba2026!',
    }),
  })
  token = registro.token
  idUsuario = registro.paciente.idUsuario

  const cita = await preguntar('¿Cómo puedo reservar una cita?')
  const especialidades = await preguntar('¿Qué especialidades hay?')
  const diagnostico = await preguntar('¿Qué enfermedad tengo?')
  const emergencia = await preguntar('Tengo dolor fuerte en el pecho')

  if (cita.intent !== 'reservar_cita') {
    throw new Error('No se detectó la intención de reserva.')
  }
  if (!['dialogflow', 'local'].includes(cita.proveedor)) {
    throw new Error('No se registró el proveedor de la respuesta.')
  }
  if (!especialidades.respuesta) {
    throw new Error('La consulta de especialidades no generó respuesta.')
  }
  if (diagnostico.intent !== 'limite_clinico') {
    throw new Error('No se aplicó el límite de diagnóstico.')
  }
  if (diagnostico.proveedor !== 'local') {
    throw new Error('El límite clínico debe aplicarse localmente.')
  }
  if (emergencia.intent !== 'emergencia') {
    throw new Error('No se detectó la orientación de emergencia.')
  }
  if (emergencia.proveedor !== 'local') {
    throw new Error('La emergencia debe protegerse localmente.')
  }

  let historial = await solicitud('/asistente/historial')
  if (historial.consultas.length !== 4) {
    throw new Error('La conversación no se guardó correctamente.')
  }

  await solicitud('/asistente/historial', { method: 'DELETE' })
  historial = await solicitud('/asistente/historial')
  if (historial.consultas.length !== 0) {
    throw new Error('La conversación no se eliminó correctamente.')
  }

  console.log(
    'Asistente, límites médicos, persistencia y limpieza: correctos.',
  )
} finally {
  if (idUsuario) {
    await db.execute('DELETE FROM usuarios WHERE id_usuario = ?', [idUsuario])
  }
  await db.end()
}
