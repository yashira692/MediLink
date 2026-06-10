import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { verificarConexion } from './config/db.js'
import asistenteRoutes from './routes/asistente.js'
import authRoutes from './routes/auth.js'
import citasRoutes from './routes/citas.js'
import historialRoutes from './routes/historial.js'
import notificacionesRoutes from './routes/notificaciones.js'
import pacienteRoutes from './routes/paciente.js'
import { generarRecordatorios } from './services/recordatorios.js'

const app = express()
const port = Number(process.env.PORT || 3001)

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
}))
app.use(express.json({ limit: '1mb' }))

app.get('/api/salud', (_req, res) => {
  res.json({ estado: 'ok', servicio: 'MediLink API' })
})

app.use('/api/auth', authRoutes)
app.use('/api/asistente', asistenteRoutes)
app.use('/api/paciente', pacienteRoutes)
app.use('/api/citas', citasRoutes)
app.use('/api/historial', historialRoutes)
app.use('/api/notificaciones', notificacionesRoutes)

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ mensaje: 'Ocurrió un error interno en el servidor.' })
})

if (!process.env.JWT_SECRET) {
  console.error('Falta configurar JWT_SECRET en el archivo .env.')
  process.exit(1)
}

try {
  await verificarConexion()
  app.listen(port, () => {
    console.log(`MediLink API disponible en http://localhost:${port}`)
  })
  await generarRecordatorios()
  const recordatoriosInterval = setInterval(() => {
    generarRecordatorios().catch((error) => {
      console.error('No se pudieron generar recordatorios:', error.message)
    })
  }, 15 * 60 * 1000)
  recordatoriosInterval.unref()
} catch (error) {
  console.error('No se pudo conectar con MySQL:', error.message)
  process.exit(1)
}
