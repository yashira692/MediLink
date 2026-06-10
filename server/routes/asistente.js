import { Router } from 'express'
import pool from '../config/db.js'
import { autenticar, soloPacientes } from '../middleware/auth.js'
import {
  detectarIntentDialogflow,
  dialogflowHabilitado,
} from '../services/dialogflow.js'

const router = Router()

router.use(autenticar, soloPacientes)

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function contiene(texto, expresiones) {
  return expresiones.some((expresion) => texto.includes(expresion))
}

async function generarRespuestaLocal(pregunta) {
  const texto = normalizar(pregunta)

  if (
    contiene(texto, [
      'emergencia',
      'no puedo respirar',
      'dolor fuerte en el pecho',
      'me desmayo',
      'sangrado abundante',
      'convulsion',
      'quiero hacerme dano',
      'quiero suicidarme',
    ])
  ) {
    return {
      intent: 'emergencia',
      respuesta:
        'Esto podría requerir atención urgente. Acude inmediatamente al centro de emergencia más cercano o comunícate con los servicios de emergencia de tu localidad. No esperes una respuesta del sistema ni intentes tratarte únicamente con esta orientación.',
    }
  }

  if (
    contiene(texto, [
      'diagnostico',
      'que enfermedad tengo',
      'que tengo',
      'recetame',
      'que medicamento tomo',
      'dosis debo tomar',
    ])
  ) {
    return {
      intent: 'limite_clinico',
      respuesta:
        'No puedo diagnosticar enfermedades, indicar medicamentos ni definir dosis. Para una evaluación segura debes reservar una cita con un profesional. Si los síntomas son intensos o empeoran rápidamente, busca atención urgente.',
    }
  }

  if (contiene(texto, ['cancelar', 'anular']) && texto.includes('cita')) {
    return {
      intent: 'cancelar_cita',
      respuesta:
        'Entra a “Mis citas”, busca la cita activa y pulsa “Cancelar”. El horario quedará liberado y recibirás una notificación de confirmación.',
    }
  }

  if (
    contiene(texto, ['reprogramar', 'cambiar', 'mover']) &&
    texto.includes('cita')
  ) {
    return {
      intent: 'reprogramar_cita',
      respuesta:
        'En “Mis citas” pulsa “Reprogramar”, selecciona una nueva fecha y elige uno de los horarios disponibles del médico.',
    }
  }

  if (contiene(texto, ['reservar', 'agendar', 'sacar cita', 'nueva cita'])) {
    return {
      intent: 'reservar_cita',
      respuesta:
        'Ve a “Reservar cita”, elige una especialidad, un médico, una fecha futura, un horario disponible y escribe el motivo de consulta.',
    }
  }

  if (contiene(texto, ['mis citas', 'ver cita', 'estado de mi cita'])) {
    return {
      intent: 'consultar_citas',
      respuesta:
        'Puedes revisar el estado, fecha, hora y médico de tus atenciones desde la sección “Mis citas”.',
    }
  }

  if (contiene(texto, ['receta', 'medicamento'])) {
    return {
      intent: 'consultar_recetas',
      respuesta:
        'Tus recetas están en “Historial médico” → “Recetas digitales”. Allí puedes revisar las indicaciones registradas por el médico y descargar el PDF.',
    }
  }

  if (
    contiene(texto, [
      'resultado',
      'laboratorio',
      'analisis',
      'examen de sangre',
    ])
  ) {
    return {
      intent: 'consultar_resultados',
      respuesta:
        'Ve a “Historial médico” → “Resultados de laboratorio”. Cuando un resultado esté disponible podrás visualizar su resumen y descargar el PDF.',
    }
  }

  if (contiene(texto, ['historial', 'diagnosticos anteriores', 'consultas anteriores'])) {
    return {
      intent: 'consultar_historial',
      respuesta:
        'En “Historial médico” encontrarás tus consultas completadas, diagnósticos, observaciones, recetas y resultados.',
    }
  }

  if (contiene(texto, ['notificacion', 'campana', 'aviso'])) {
    return {
      intent: 'notificaciones',
      respuesta:
        'Pulsa la campana de la parte superior para ver tus avisos. Puedes marcar uno o todos como leídos.',
    }
  }

  if (
    contiene(texto, [
      'cambiar mis datos',
      'editar perfil',
      'mi perfil',
      'cambiar correo',
      'cambiar telefono',
    ])
  ) {
    return {
      intent: 'perfil',
      respuesta:
        'Pulsa tus iniciales en la parte superior y entra a “Mi perfil”. Allí puedes actualizar tus datos personales.',
    }
  }

  if (contiene(texto, ['especialidad', 'especialidades', 'medicos disponibles'])) {
    const [especialidades] = await pool.execute(
      `SELECT nombre FROM especialidades
       WHERE estado = 1 ORDER BY nombre`,
    )
    const nombres = especialidades.map((item) => item.nombre).join(', ')

    return {
      intent: 'especialidades',
      respuesta: `Las especialidades disponibles actualmente son: ${nombres}. El asistente puede explicar su orientación general, pero no elegir una especialidad basándose únicamente en síntomas.`,
    }
  }

  if (
    contiene(texto, [
      'piel',
      'sarpullido',
      'lunar',
      'cabello',
      'acne',
    ])
  ) {
    return {
      intent: 'orientacion_dermatologia',
      respuesta:
        'Dermatología atiende problemas de piel, cabello y uñas. Esta orientación no confirma que sea la especialidad adecuada; si tienes dudas, puedes comenzar con Medicina General.',
    }
  }

  if (
    contiene(texto, [
      'corazon',
      'presion',
      'palpitaciones',
      'cardiovascular',
    ])
  ) {
    return {
      intent: 'orientacion_cardiologia',
      respuesta:
        'Cardiología se enfoca en el corazón y el sistema cardiovascular. Si presentas dolor intenso en el pecho, falta de aire o desmayo, busca atención urgente.',
    }
  }

  if (contiene(texto, ['nino', 'nina', 'bebe', 'adolescente', 'pediatria'])) {
    return {
      intent: 'orientacion_pediatria',
      respuesta:
        'Pediatría brinda atención a bebés, niños y adolescentes. Para síntomas urgentes o graves, acude directamente a un servicio de emergencia.',
    }
  }

  if (
    contiene(texto, [
      'sintoma',
      'dolor',
      'fiebre',
      'mareo',
      'tos',
      'malestar',
    ])
  ) {
    return {
      intent: 'orientacion_general',
      respuesta:
        'No puedo interpretar síntomas ni realizar un diagnóstico. Medicina General suele ser el punto inicial para una evaluación y, si corresponde, el profesional te derivará a otra especialidad.',
    }
  }

  if (contiene(texto, ['hola', 'buenos dias', 'buenas tardes', 'buenas noches'])) {
    return {
      intent: 'saludo',
      respuesta:
        'Hola. Puedo ayudarte a usar MediLink: reservar o cambiar citas, encontrar recetas y resultados, revisar notificaciones y conocer las especialidades disponibles.',
    }
  }

  return {
    intent: 'ayuda_general',
    respuesta:
      'Puedo orientarte sobre citas, especialidades, perfil, notificaciones, recetas, resultados y uso del sistema. No realizo diagnósticos ni indico tratamientos médicos.',
    proveedor: 'local',
    confianza: null,
  }
}

async function generarRespuesta(pregunta, idUsuario) {
  const respuestaLocal = await generarRespuestaLocal(pregunta)

  if (['emergencia', 'limite_clinico'].includes(respuestaLocal.intent)) {
    return {
      ...respuestaLocal,
      proveedor: 'local',
      confianza: null,
    }
  }

  try {
    const respuestaDialogflow = await detectarIntentDialogflow({
      pregunta,
      idUsuario,
    })

    if (respuestaDialogflow) return respuestaDialogflow
  } catch (error) {
    console.warn('Dialogflow no respondió; se usará el motor local:', error.message)
  }

  return {
    ...respuestaLocal,
    proveedor: 'local',
    confianza: null,
  }
}

router.get('/estado', (_req, res) => {
  res.json({
    dialogflow: dialogflowHabilitado(),
    respaldoLocal: true,
  })
})

router.get('/historial', async (req, res, next) => {
  try {
    const [consultas] = await pool.execute(
      `SELECT
        id_chatbot AS id,
        pregunta,
        respuesta,
        intent_detectado AS intent,
        proveedor,
        confianza,
        DATE_FORMAT(fecha_consulta, '%Y-%m-%dT%H:%i:%s') AS fecha
       FROM chatbot_consultas
       WHERE id_usuario = ?
       ORDER BY fecha_consulta ASC, id_chatbot ASC
       LIMIT 100`,
      [req.usuario.idUsuario],
    )

    return res.json({ consultas })
  } catch (error) {
    return next(error)
  }
})

router.post('/consultar', async (req, res, next) => {
  const pregunta = req.body.pregunta?.trim()

  if (!pregunta) {
    return res.status(400).json({ mensaje: 'Escribe una pregunta.' })
  }

  if (pregunta.length > 500) {
    return res.status(400).json({
      mensaje: 'La pregunta no puede superar los 500 caracteres.',
    })
  }

  try {
    const resultado = await generarRespuesta(
      pregunta,
      req.usuario.idUsuario,
    )
    const [consulta] = await pool.execute(
      `INSERT INTO chatbot_consultas
        (id_usuario, pregunta, respuesta, intent_detectado, proveedor, confianza)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.usuario.idUsuario,
        pregunta,
        resultado.respuesta,
        resultado.intent,
        resultado.proveedor,
        resultado.confianza,
      ],
    )

    return res.status(201).json({
      consulta: {
        id: consulta.insertId,
        pregunta,
        respuesta: resultado.respuesta,
        intent: resultado.intent,
        proveedor: resultado.proveedor,
        confianza: resultado.confianza,
        fecha: new Date().toISOString(),
      },
    })
  } catch (error) {
    return next(error)
  }
})

router.delete('/historial', async (req, res, next) => {
  try {
    await pool.execute(
      'DELETE FROM chatbot_consultas WHERE id_usuario = ?',
      [req.usuario.idUsuario],
    )
    return res.json({ mensaje: 'Conversación eliminada.' })
  } catch (error) {
    return next(error)
  }
})

export default router
