import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../config/db.js'
import { autenticar, soloPacientes } from '../middleware/auth.js'
import { VERSION_AVISO_PRIVACIDAD } from '../utils/validacion.js'

const router = Router()

router.use(autenticar, soloPacientes)

router.get('/perfil', async (req, res, next) => {
  try {
    const [pacientes] = await pool.execute(
      `SELECT
        u.id_usuario AS idUsuario,
        p.id_paciente AS idPaciente,
        u.nombres,
        u.apellidos,
        u.dni,
        u.correo,
        u.telefono,
        p.fecha_nacimiento AS fechaNacimiento,
        p.direccion,
        p.consentimiento_fecha AS consentimientoFecha,
        u.rol
       FROM usuarios u
       INNER JOIN pacientes p ON p.id_usuario = u.id_usuario
       WHERE u.id_usuario = ? AND p.id_paciente = ?
       LIMIT 1`,
      [req.usuario.idUsuario, req.usuario.idPaciente],
    )

    if (!pacientes[0]) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado.' })
    }

    return res.json({ paciente: pacientes[0] })
  } catch (error) {
    return next(error)
  }
})

router.post('/consentimiento', async (req, res, next) => {
  try {
    await pool.execute(
      `UPDATE pacientes
       SET consentimiento_fecha = NOW(), consentimiento_version = ?
       WHERE id_paciente = ?`,
      [VERSION_AVISO_PRIVACIDAD, req.usuario.idPaciente],
    )
    const [[consentimiento]] = await pool.execute(
      `SELECT consentimiento_fecha AS consentimientoFecha
       FROM pacientes WHERE id_paciente = ?`,
      [req.usuario.idPaciente],
    )

    return res.json(consentimiento)
  } catch (error) {
    return next(error)
  }
})

router.put('/perfil', async (req, res, next) => {
  const telefono = req.body.telefono?.trim()
  const direccion = req.body.direccion?.trim() || null

  if (!telefono) {
    return res.status(400).json({ mensaje: 'Completa los campos obligatorios.' })
  }

  if (!/^\d{9}$/.test(telefono)) {
    return res.status(400).json({ mensaje: 'El teléfono debe tener 9 dígitos.' })
  }

  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE usuarios
       SET telefono = ?
       WHERE id_usuario = ?`,
      [telefono, req.usuario.idUsuario],
    )
    await connection.execute(
      `UPDATE pacientes
       SET direccion = ?
       WHERE id_paciente = ?`,
      [direccion, req.usuario.idPaciente],
    )
    await connection.execute(
      `INSERT INTO notificaciones (id_paciente, tipo, mensaje)
       VALUES (?, 'sistema', 'Tus datos personales fueron actualizados correctamente.')`,
      [req.usuario.idPaciente],
    )

    await connection.commit()

    const [pacientes] = await connection.execute(
      `SELECT
        u.id_usuario AS idUsuario,
        p.id_paciente AS idPaciente,
        u.nombres,
        u.apellidos,
        u.dni,
        u.correo,
        u.telefono,
        p.fecha_nacimiento AS fechaNacimiento,
        p.direccion,
        p.consentimiento_fecha AS consentimientoFecha,
        u.rol
       FROM usuarios u
       INNER JOIN pacientes p ON p.id_usuario = u.id_usuario
       WHERE u.id_usuario = ?`,
      [req.usuario.idUsuario],
    )

    return res.json({
      mensaje: 'Perfil actualizado correctamente.',
      paciente: pacientes[0],
    })
  } catch (error) {
    if (connection) await connection.rollback()
    return next(error)
  } finally {
    connection?.release()
  }
})

router.put('/password', async (req, res, next) => {
  const passwordActual = req.body.passwordActual
  const nuevaPassword = req.body.nuevaPassword

  if (
    !passwordActual ||
    typeof nuevaPassword !== 'string' ||
    nuevaPassword.length < 8 ||
    !/[A-Z]/.test(nuevaPassword) ||
    !/[a-z]/.test(nuevaPassword) ||
    !/\d/.test(nuevaPassword)
  ) {
    return res.status(400).json({
      mensaje:
        'La nueva contraseña debe tener 8 caracteres, una mayúscula, una minúscula y un número.',
    })
  }

  try {
    const [[usuario]] = await pool.execute(
      'SELECT password_hash FROM usuarios WHERE id_usuario = ? LIMIT 1',
      [req.usuario.idUsuario],
    )

    if (!usuario || !(await bcrypt.compare(passwordActual, usuario.password_hash))) {
      return res.status(401).json({ mensaje: 'La contraseña actual es incorrecta.' })
    }

    if (await bcrypt.compare(nuevaPassword, usuario.password_hash)) {
      return res.status(400).json({
        mensaje: 'La nueva contraseña debe ser diferente de la actual.',
      })
    }

    const passwordHash = await bcrypt.hash(nuevaPassword, 12)
    await pool.execute(
      `UPDATE usuarios
       SET password_hash = ?, token_version = token_version + 1
       WHERE id_usuario = ?`,
      [passwordHash, req.usuario.idUsuario],
    )
    await pool.execute(
      `INSERT INTO notificaciones (id_paciente, tipo, mensaje)
       VALUES (?, 'sistema', 'Tu contraseña fue actualizada correctamente.')`,
      [req.usuario.idPaciente],
    )

    return res.json({
      mensaje: 'Contraseña actualizada. Inicia sesión nuevamente.',
    })
  } catch (error) {
    return next(error)
  }
})

export default router
