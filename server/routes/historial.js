import { Router } from 'express'
import pool from '../config/db.js'
import { autenticar, soloPacientes } from '../middleware/auth.js'
import {
  enviarDocumento,
  obtenerHistorialPaciente,
} from '../services/historial.js'

const router = Router()

router.use(autenticar, soloPacientes)

router.get('/', async (req, res, next) => {
  try {
    return res.json(await obtenerHistorialPaciente(req.usuario.idPaciente))
  } catch (error) {
    return next(error)
  }
})

router.get('/documentos/:id/descargar', async (req, res, next) => {
  try {
    const [documentos] = await pool.execute(
      `SELECT nombre_original, ruta_relativa, mime_type
       FROM documentos_medicos
       WHERE id_documento = ? AND id_paciente = ?
       LIMIT 1`,
      [Number(req.params.id), req.usuario.idPaciente],
    )
    const documento = documentos[0]

    if (!documento) {
      return res.status(404).json({ mensaje: 'Documento no encontrado.' })
    }

    return enviarDocumento(res, documento)
  } catch (error) {
    return next(error)
  }
})

export default router
