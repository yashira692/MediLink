import 'dotenv/config'
import {
  detectarIntentDialogflow,
  dialogflowHabilitado,
} from '../services/dialogflow.js'

if (!dialogflowHabilitado()) {
  console.error('Dialogflow no está habilitado en el archivo .env.')
  process.exit(1)
}

try {
  const resultado = await detectarIntentDialogflow({
    pregunta: '¿Cómo puedo reservar una cita?',
    idUsuario: `prueba-${Date.now()}`,
  })

  if (!resultado) {
    console.log(
      'Dialogflow respondió, pero usó fallback o la intención no tiene respuesta configurada.',
    )
  } else {
    console.log(
      `Dialogflow conectado. Intención: ${resultado.intent}. Confianza: ${resultado.confianza.toFixed(2)}.`,
    )
  }
} catch (error) {
  console.error(`No se pudo consultar Dialogflow: ${error.message}`)
  process.exit(1)
}
