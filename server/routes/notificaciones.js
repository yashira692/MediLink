import { Router } from 'express'
import pool from '../config/db.js'
import { autenticar, soloPacientes } from '../middleware/auth.js'
import { generarRecordatorios } from '../services/recordatorios.js'

const router = Router()

router.use(autenticar, soloPacientes)

router.post('/generar-recordatorios', async (req, res, next) => {
  try {
    const creados = await generarRecordatorios(req.usuario.idPaciente)

    return res.json({
      creados,
      mensaje:
        creados > 0
          ? 'Se generaron recordatorios para tus citas próximas.'
          : 'No hay recordatorios nuevos.',
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const [notificaciones] = await pool.execute(
      `SELECT
        id_notificacion AS id,
        tipo,
        mensaje,
        leido,
        DATE_FORMAT(fecha_creacion, '%Y-%m-%dT%H:%i:%s') AS fechaCreacion,
        DATE_FORMAT(fecha_lectura, '%Y-%m-%dT%H:%i:%s') AS fechaLectura
       FROM notificaciones
       WHERE id_paciente = ?
       ORDER BY fecha_creacion DESC, id_notificacion DESC`,
      [req.usuario.idPaciente],
    )
    const noLeidas = notificaciones.filter(
      (notificacion) => !notificacion.leido,
    ).length

    return res.json({ notificaciones, noLeidas })
  } catch (error) {
    return next(error)
  }
})

router.patch('/leer-todas', async (req, res, next) => {
  try {
    await pool.execute(
      `UPDATE notificaciones
       SET leido = 1, fecha_lectura = COALESCE(fecha_lectura, CURRENT_TIMESTAMP)
       WHERE id_paciente = ? AND leido = 0`,
      [req.usuario.idPaciente],
    )

    return res.json({ mensaje: 'Todas las notificaciones fueron marcadas como leídas.' })
  } catch (error) {
    return next(error)
  }
})

router.patch('/:id/leer', async (req, res, next) => {
  try {
    const [resultado] = await pool.execute(
      `UPDATE notificaciones
       SET leido = 1, fecha_lectura = COALESCE(fecha_lectura, CURRENT_TIMESTAMP)
       WHERE id_notificacion = ? AND id_paciente = ?`,
      [Number(req.params.id), req.usuario.idPaciente],
    )

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Notificación no encontrada.' })
    }

    return res.json({ mensaje: 'Notificación marcada como leída.' })
  } catch (error) {
    return next(error)
  }
})

export default router
