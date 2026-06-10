import dialogflow from '@google-cloud/dialogflow'

const projectId = process.env.DIALOGFLOW_PROJECT_ID
const languageCode = process.env.DIALOGFLOW_LANGUAGE_CODE || 'es'
const enabled = process.env.DIALOGFLOW_ENABLED === 'true'
let sessionsClient

function obtenerCliente() {
  if (!sessionsClient) {
    sessionsClient = new dialogflow.SessionsClient()
  }
  return sessionsClient
}

export function dialogflowHabilitado() {
  return enabled && Boolean(projectId)
}

export async function detectarIntentDialogflow({
  pregunta,
  idUsuario,
}) {
  if (!dialogflowHabilitado()) return null

  const cliente = obtenerCliente()
  const session = cliente.projectAgentSessionPath(
    projectId,
    `paciente-${idUsuario}`,
  )
  const [respuesta] = await cliente.detectIntent({
    session,
    queryInput: {
      text: {
        text: pregunta,
        languageCode,
      },
    },
  })
  const resultado = respuesta.queryResult
  const intent = resultado?.intent?.displayName
  const fulfillmentText = resultado?.fulfillmentText?.trim()

  if (
    !intent ||
    intent === 'Default Fallback Intent' ||
    !fulfillmentText
  ) {
    return null
  }

  return {
    intent,
    respuesta: fulfillmentText,
    confianza: Number(resultado.intentDetectionConfidence || 0),
    proveedor: 'dialogflow',
  }
}
