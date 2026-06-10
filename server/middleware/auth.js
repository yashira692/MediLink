import jwt from 'jsonwebtoken'
import pool from '../config/db.js'

export async function autenticar(req, res, next) {
  const authorization = req.headers.authorization

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ mensaje: 'Debes iniciar sesión.' })
  }

  try {
    const sesion = jwt.verify(
      authorization.slice('Bearer '.length),
      process.env.JWT_SECRET,
    )
    const [usuarios] = await pool.execute(
      `SELECT estado, token_version
       FROM usuarios WHERE id_usuario = ? LIMIT 1`,
      [sesion.idUsuario],
    )
    const usuario = usuarios[0]

    if (
      !usuario ||
      !usuario.estado ||
      usuario.token_version !== sesion.tokenVersion
    ) {
      return res.status(401).json({ mensaje: 'La sesión ya no es válida.' })
    }

    req.usuario = sesion
    return next()
  } catch {
    return res.status(401).json({ mensaje: 'La sesión no es válida o expiró.' })
  }
}

export function soloPacientes(req, res, next) {
  if (req.usuario.rol !== 'paciente') {
    return res.status(403).json({ mensaje: 'Acceso permitido solo a pacientes.' })
  }

  return next()
}
