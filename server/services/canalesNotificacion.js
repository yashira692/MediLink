import nodemailer from 'nodemailer'

const CODIGO_PAIS_PERU = process.env.WHATSAPP_COUNTRY_CODE || '51'
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0'
let transportadorCorreo = null

function canalActivo(canal) {
  if (canal === 'correo') return process.env.NOTIFICATION_EMAIL_ENABLED !== 'false'
  if (canal === 'whatsapp') return process.env.NOTIFICATION_WHATSAPP_ENABLED !== 'false'

  return true
}

function limpiarTelefono(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '')

  if (digitos.length === 9) return `${CODIGO_PAIS_PERU}${digitos}`
  if (digitos.startsWith(CODIGO_PAIS_PERU) && digitos.length === 11) return digitos

  return digitos
}

function crearEnlaceCorreo(correo, asunto, mensaje) {
  const parametros = new URLSearchParams({
    subject: asunto,
    body: mensaje,
  })

  return `mailto:${correo}?${parametros.toString()}`
}

function crearEnlaceWhatsApp(telefono, mensaje) {
  const telefonoNormalizado = limpiarTelefono(telefono)
  const texto = encodeURIComponent(mensaje)

  return telefonoNormalizado
    ? `https://wa.me/${telefonoNormalizado}?text=${texto}`
    : null
}

function whatsappConfigurado() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID,
  )
}

function correoConfigurado() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
}

function obtenerTransportadorCorreo() {
  if (transportadorCorreo) return transportadorCorreo

  transportadorCorreo = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  return transportadorCorreo
}

async function enviarCorreo(destino, asunto, mensaje) {
  if (!correoConfigurado()) {
    return {
      estado: 'preparado',
      error: 'SMTP no configurado en .env',
    }
  }

  await obtenerTransportadorCorreo().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: destino,
    subject: asunto,
    text: mensaje,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0b2d52; line-height: 1.5;">
        <h2 style="color: #2f7fc1;">MediLink</h2>
        <p>${mensaje}</p>
        <p style="font-size: 13px; color: #5f718f;">Este mensaje fue generado automáticamente por MediLink.</p>
      </div>
    `,
  })

  return { estado: 'enviado', error: null }
}

async function enviarWhatsApp(destino, mensaje) {
  if (!whatsappConfigurado()) {
    return {
      estado: 'preparado',
      error: 'WhatsApp Business API no configurado en .env',
    }
  }

  const respuesta = await fetch(
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destino,
        type: 'text',
        text: {
          preview_url: false,
          body: mensaje,
        },
      }),
    },
  )

  if (!respuesta.ok) {
    const detalle = await respuesta.text()
    throw new Error(detalle.slice(0, 450))
  }

  return { estado: 'enviado', error: null }
}

async function prepararEnvio(registro, asunto, mensaje) {
  if (registro.canal === 'correo') {
    try {
      const resultado = await enviarCorreo(registro.destino, asunto, mensaje)

      return {
        ...registro,
        estado: resultado.estado,
        error: resultado.error,
        fechaEnvio: resultado.estado === 'enviado' ? new Date() : null,
      }
    } catch (error) {
      return {
        ...registro,
        estado: 'fallido',
        error: error.message,
        fechaEnvio: null,
      }
    }
  }

  if (registro.canal !== 'whatsapp') {
    return {
      ...registro,
      estado: 'preparado',
      error: null,
      fechaEnvio: null,
    }
  }

  try {
    const resultado = await enviarWhatsApp(registro.destino, mensaje)

    return {
      ...registro,
      estado: resultado.estado,
      error: resultado.error,
      fechaEnvio: resultado.estado === 'enviado' ? new Date() : null,
    }
  } catch (error) {
    return {
      ...registro,
      estado: 'fallido',
      error: error.message,
      fechaEnvio: null,
    }
  }
}

export async function registrarEnviosNotificacion(
  connection,
  { idNotificacion, correo, telefono, asunto, mensaje, canales = ['correo', 'whatsapp'] },
) {
  const registros = []

  if (canales.includes('correo') && canalActivo('correo') && correo) {
    registros.push({
      canal: 'correo',
      destino: correo,
      enlace: crearEnlaceCorreo(correo, asunto, mensaje),
    })
  }

  if (canales.includes('whatsapp') && canalActivo('whatsapp') && telefono) {
    const enlace = crearEnlaceWhatsApp(telefono, mensaje)
    if (enlace) {
      registros.push({
        canal: 'whatsapp',
        destino: limpiarTelefono(telefono),
        enlace,
      })
    }
  }

  for (const registro of registros) {
    const envio = await prepararEnvio(registro, asunto, mensaje)
    await connection.execute(
      `INSERT INTO notificacion_envios
        (id_notificacion, canal, destino, asunto, mensaje, enlace, estado, fecha_envio, error_envio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idNotificacion,
        envio.canal,
        envio.destino,
        asunto,
        mensaje,
        envio.enlace,
        envio.estado,
        envio.fechaEnvio,
        envio.error,
      ],
    )
  }

  return registros.length
}

export async function crearNotificacionConCanales(
  connection,
  {
    idPaciente,
    idCita = null,
    tipo = 'sistema',
    claveEvento = null,
    mensaje,
    correo,
    telefono,
    asunto = 'Notificacion de MediLink',
    canales = ['correo', 'whatsapp'],
  },
) {
  const [resultado] = await connection.execute(
    `INSERT IGNORE INTO notificaciones
      (id_paciente, id_cita, tipo, clave_evento, mensaje)
     VALUES (?, ?, ?, ?, ?)`,
    [idPaciente, idCita, tipo, claveEvento, mensaje],
  )

  if (resultado.affectedRows === 0) return null

  await registrarEnviosNotificacion(connection, {
    idNotificacion: resultado.insertId,
    correo,
    telefono,
    asunto,
    mensaje,
    canales,
  })

  return resultado.insertId
}
