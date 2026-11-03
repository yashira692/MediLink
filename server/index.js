import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verificarConexion } from './config/db.js'
import adminRoutes from './routes/admin.js'
import asistenteRoutes from './routes/asistente.js'
import authRoutes from './routes/auth.js'
import citasRoutes from './routes/citas.js'
import historialRoutes from './routes/historial.js'
import medicoRoutes from './routes/medico.js'
import notificacionesRoutes from './routes/notificaciones.js'
import pacienteRoutes from './routes/paciente.js'
import { marcarCitasVencidas } from './services/citasVencidas.js'
import { generarRecordatorios } from './services/recordatorios.js'

const app = express()
const port = Number(process.env.PORT || 3001)
const enProduccion = process.env.NODE_ENV === 'production'
const carpetaFrontend = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist',
)

// Render atiende por un proxy: sin esto, todos los usuarios compartirían la misma IP.
if (enProduccion) app.set('trust proxy', 1)

function limiteSolicitudes(ventanaMinutos, limite) {
  return rateLimit({
    windowMs: ventanaMinutos * 60 * 1000,
    limit: limite,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      mensaje: 'Demasiadas solicitudes. Inténtalo nuevamente en unos minutos.',
    },
  })
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
}))
app.use(express.json({ limit: '1mb' }))

app.get('/api/salud', (_req, res) => {
  res.json({ estado: 'ok', servicio: 'MediLink API' })
})

app.use('/api', limiteSolicitudes(1, 600))
app.use('/api/auth', limiteSolicitudes(15, 100), authRoutes)
app.use('/api/asistente', asistenteRoutes)
app.use('/api/paciente', pacienteRoutes)
app.use('/api/citas', citasRoutes)
app.use('/api/historial', historialRoutes)
app.use('/api/medico', medicoRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/notificaciones', notificacionesRoutes)
app.use('/api', (_req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada.' })
})

if (enProduccion) {
  app.use(express.static(carpetaFrontend))
  app.get('/{*ruta}', (_req, res) => {
    res.sendFile(path.join(carpetaFrontend, 'index.html'))
  })
}

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ mensaje: 'Ocurrió un error interno en el servidor.' })
})

if (!process.env.JWT_SECRET) {
  console.error('Falta configurar JWT_SECRET en el archivo .env.')
  process.exit(1)
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET debe tener al menos 32 caracteres.')
  if (process.env.NODE_ENV === 'production') process.exit(1)
}

try {
  await verificarConexion()
  app.listen(port, () => {
    console.log(`MediLink API disponible en http://localhost:${port}`)
  })
  const actualizarCitasVencidas = () =>
    marcarCitasVencidas().catch((error) => {
      console.error('No se pudieron marcar las citas vencidas:', error.message)
    })

  await actualizarCitasVencidas()
  await generarRecordatorios()
  const recordatoriosInterval = setInterval(() => {
    actualizarCitasVencidas()
    generarRecordatorios().catch((error) => {
      console.error('No se pudieron generar recordatorios:', error.message)
    })
  }, 15 * 60 * 1000)
  recordatoriosInterval.unref()
} catch (error) {
  console.error('No se pudo conectar con MySQL:', error.message)
  process.exit(1)
}
