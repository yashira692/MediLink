import 'dotenv/config'
import mysql from 'mysql2/promise'

const apiUrl = `http://localhost:${process.env.PORT || 3001}/api`
const correo = `seguridad.${Date.now()}@medilink.test`
const passwordInicial = 'Inicial2026'
const passwordCambiada = 'Cambiada2026'
const passwordFinal = 'Final2026'
let token
let idUsuario

async function solicitud(ruta, opciones = {}, aceptarError = false) {
  const respuesta = await fetch(`${apiUrl}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const datos = await respuesta.json()
  if (!respuesta.ok && !aceptarError) throw new Error(datos.mensaje)
  return { respuesta, datos }
}

async function login(password) {
  const { datos } = await solicitud('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo, password }),
  })
  token = datos.token
}

const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

try {
  const registroDebil = await solicitud(
    '/auth/registro',
    {
      method: 'POST',
      body: JSON.stringify({
        nombres: 'Paciente',
        apellidos: 'Seguridad',
        dni: String(Date.now()).slice(-8),
        correo,
        telefono: '922222222',
        password: 'debil',
      }),
    },
    true,
  )
  if (registroDebil.respuesta.status !== 400) {
    throw new Error('La contraseña débil no fue rechazada.')
  }

  const registro = await solicitud('/auth/registro', {
    method: 'POST',
    body: JSON.stringify({
      nombres: 'Paciente',
      apellidos: 'Seguridad',
      dni: String(Date.now() + 1).slice(-8),
      correo,
      telefono: '922222222',
      password: passwordInicial,
      aceptaPrivacidad: true,
    }),
  })
  token = registro.datos.token
  idUsuario = registro.datos.paciente.idUsuario
  const tokenAnterior = token

  await solicitud('/paciente/password', {
    method: 'PUT',
    body: JSON.stringify({
      passwordActual: passwordInicial,
      nuevaPassword: passwordCambiada,
    }),
  })

  token = tokenAnterior
  const sesionAnterior = await solicitud(
    '/paciente/perfil',
    {},
    true,
  )
  if (sesionAnterior.respuesta.status !== 401) {
    throw new Error('La sesión anterior no fue invalidada.')
  }

  token = null
  await login(passwordCambiada)

  await solicitud('/paciente/perfil', {
    method: 'PUT',
    body: JSON.stringify({
      correo: `otro.${correo}`,
      telefono: '900555666',
    }),
  })
  const perfil = await solicitud('/paciente/perfil')
  if (perfil.datos.paciente.correo !== correo) {
    throw new Error('El paciente pudo cambiar su correo.')
  }
  if (perfil.datos.paciente.telefono !== '900555666') {
    throw new Error('No se guardó el teléfono del paciente.')
  }
  if (!perfil.datos.paciente.consentimientoFecha) {
    throw new Error('No se guardó el consentimiento del registro.')
  }

  const sinConsentimiento = await solicitud(
    '/auth/registro',
    {
      method: 'POST',
      body: JSON.stringify({
        nombres: 'Sin',
        apellidos: 'Consentimiento',
        dni: String(Date.now() + 7).slice(-8),
        correo: `sin.${correo}`,
        telefono: '900555667',
        password: passwordInicial,
      }),
    },
    true,
  )
  if (sinConsentimiento.respuesta.status !== 400) {
    throw new Error('Se permitió registrarse sin aceptar el aviso.')
  }

  await db.execute(
    'UPDATE pacientes SET consentimiento_fecha = NULL WHERE id_usuario = ?',
    [idUsuario],
  )
  const pendiente = await solicitud('/paciente/perfil')
  if (pendiente.datos.paciente.consentimientoFecha) {
    throw new Error('El consentimiento pendiente no se detectó.')
  }
  const aceptado = await solicitud('/paciente/consentimiento', { method: 'POST' })
  if (!aceptado.datos.consentimientoFecha) {
    throw new Error('No se registró el consentimiento pendiente.')
  }

  const salud = await fetch(`${apiUrl}/salud`)
  if (salud.headers.get('x-content-type-options') !== 'nosniff') {
    throw new Error('Faltan las cabeceras de seguridad.')
  }
  if (salud.headers.has('x-powered-by')) {
    throw new Error('El servidor expone su tecnología.')
  }

  const recuperacion = await solicitud('/auth/solicitar-recuperacion', {
    method: 'POST',
    body: JSON.stringify({ correo }),
  })
  const enlace = recuperacion.datos.enlaceDesarrollo
  const resetToken = new URL(enlace).searchParams.get('resetToken')

  if (!resetToken) throw new Error('No se generó el token de recuperación.')

  token = null
  await solicitud('/auth/restablecer-password', {
    method: 'POST',
    body: JSON.stringify({
      token: resetToken,
      nuevaPassword: passwordFinal,
    }),
  })

  const reutilizacion = await solicitud(
    '/auth/restablecer-password',
    {
      method: 'POST',
      body: JSON.stringify({
        token: resetToken,
        nuevaPassword: 'OtraFinal2026',
      }),
    },
    true,
  )
  if (reutilizacion.respuesta.status !== 400) {
    throw new Error('El token de recuperación pudo reutilizarse.')
  }

  await login(passwordFinal)

  token = null
  let ultimoEstado
  for (let intento = 0; intento < 6; intento += 1) {
    const fallo = await solicitud(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ correo, password: 'Incorrecta2026' }),
      },
      true,
    )
    ultimoEstado = fallo.respuesta.status
  }
  if (ultimoEstado !== 429) {
    throw new Error('No se activó el límite de intentos de acceso.')
  }

  console.log(
    'Cambio, recuperación, token único, invalidación y bloqueo: correctos.',
  )
} finally {
  if (idUsuario) {
    await db.execute('DELETE FROM usuarios WHERE id_usuario = ?', [idUsuario])
  }
  await db.end()
}
