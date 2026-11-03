import bcrypt from 'bcryptjs'
import pool from '../config/db.js'
import { passwordSegura } from '../utils/validacion.js'

export async function cambiarPassword(req, res, next, alActualizar) {
  const { passwordActual, nuevaPassword } = req.body

  if (!passwordActual || !passwordSegura(nuevaPassword)) {
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
    await alActualizar()

    return res.json({
      mensaje: 'Contraseña actualizada. Inicia sesión nuevamente.',
    })
  } catch (error) {
    return next(error)
  }
}
