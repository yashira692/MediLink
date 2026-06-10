import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'

const router = Router()
const intentosLogin = new Map()
const MAX_INTENTOS = 5
const VENTANA_INTENTOS_MS = 15 * 60 * 1000
const BLOQUEO_MS = 10 * 60 * 1000

function limpiarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : ''
}

function crearToken(usuario) {
  return jwt.sign(
    {
      idUsuario: usuario.id_usuario,
      idPaciente: usuario.id_paciente,
      rol: usuario.rol,
      tokenVersion: usuario.token_version || 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  )
}

function pacientePublico(usuario) {
  return {
    idUsuario: usuario.id_usuario,
    idPaciente: usuario.id_paciente,
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    dni: usuario.dni,
    correo: usuario.correo,
    telefono: usuario.telefono,
    fechaNacimiento: usuario.fecha_nacimiento,
    direccion: usuario.direccion,
    rol: usuario.rol,
  }
}

function passwordSegura(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  )
}

function claveIntento(req, correo) {
  return `${req.ip}:${correo}`
}

function revisarBloqueo(clave) {
  const ahora = Date.now()
  const registro = intentosLogin.get(clave)

  if (!registro) return 0
  if (registro.bloqueadoHasta > ahora) {
    return Math.ceil((registro.bloqueadoHasta - ahora) / 60000)
  }
  if (ahora - registro.inicioVentana > VENTANA_INTENTOS_MS) {
    intentosLogin.delete(clave)
  }
  return 0
}

function registrarFallo(clave) {
  const ahora = Date.now()
  const anterior = intentosLogin.get(clave)
  const registro =
    !anterior || ahora - anterior.inicioVentana > VENTANA_INTENTOS_MS
      ? { intentos: 0, inicioVentana: ahora, bloqueadoHasta: 0 }
      : anterior

  registro.intentos += 1
  if (registro.intentos >= MAX_INTENTOS) {
    registro.bloqueadoHasta = ahora + BLOQUEO_MS
  }
  intentosLogin.set(clave, registro)
}

router.post('/registro', async (req, res, next) => {
  const nombres = limpiarTexto(req.body.nombres)
  const apellidos = limpiarTexto(req.body.apellidos)
  const dni = limpiarTexto(req.body.dni)
  const correo = limpiarTexto(req.body.correo).toLowerCase()
  const telefono = limpiarTexto(req.body.telefono)
  const password = req.body.password
  const fechaNacimiento = req.body.fechaNacimiento || null
  const direccion = limpiarTexto(req.body.direccion) || null

  if (!nombres || !apellidos || !dni || !correo || !telefono || !password) {
    return res.status(400).json({ mensaje: 'Completa los campos obligatorios.' })
  }

  if (!/^\d{8}$/.test(dni)) {
    return res.status(400).json({ mensaje: 'El DNI debe tener 8 dígitos.' })
  }

  if (!/^\d{9}$/.test(telefono)) {
    return res.status(400).json({ mensaje: 'El teléfono debe tener 9 dígitos.' })
  }

  if (!passwordSegura(password)) {
    return res.status(400).json({
      mensaje:
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
    })
  }

  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    const [existentes] = await connection.execute(
      'SELECT id_usuario FROM usuarios WHERE correo = ? OR dni = ? LIMIT 1',
      [correo, dni],
    )

    if (existentes.length > 0) {
      await connection.rollback()
      return res.status(409).json({ mensaje: 'El correo o DNI ya está registrado.' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const [usuarioResult] = await connection.execute(
      `INSERT INTO usuarios
        (nombres, apellidos, dni, correo, telefono, password_hash, rol)
       VALUES (?, ?, ?, ?, ?, ?, 'paciente')`,
      [nombres, apellidos, dni, correo, telefono, passwordHash],
    )

    const [pacienteResult] = await connection.execute(
      `INSERT INTO pacientes (id_usuario, fecha_nacimiento, direccion)
       VALUES (?, ?, ?)`,
      [usuarioResult.insertId, fechaNacimiento, direccion],
    )
    await connection.execute(
      `INSERT INTO notificaciones (id_paciente, tipo, mensaje)
       VALUES (?, 'sistema', 'Bienvenido a MediLink. Tu cuenta fue creada correctamente.')`,
      [pacienteResult.insertId],
    )

    await connection.commit()

    const usuario = {
      id_usuario: usuarioResult.insertId,
      id_paciente: pacienteResult.insertId,
      nombres,
      apellidos,
      dni,
      correo,
      telefono,
      fecha_nacimiento: fechaNacimiento,
      direccion,
      rol: 'paciente',
      token_version: 0,
    }

    return res.status(201).json({
      token: crearToken(usuario),
      paciente: pacientePublico(usuario),
    })
  } catch (error) {
    if (connection) await connection.rollback()
    return next(error)
  } finally {
    connection?.release()
  }
})

router.post('/login', async (req, res, next) => {
  const correo = limpiarTexto(req.body.correo).toLowerCase()
  const password = req.body.password

  if (!correo || !password) {
    return res.status(400).json({ mensaje: 'Ingresa tu correo y contraseña.' })
  }

  const clave = claveIntento(req, correo)
  const minutosBloqueo = revisarBloqueo(clave)

  if (minutosBloqueo > 0) {
    return res.status(429).json({
      mensaje: `Demasiados intentos. Inténtalo nuevamente en ${minutosBloqueo} minutos.`,
    })
  }

  try {
    const [usuarios] = await pool.execute(
      `SELECT u.*, p.id_paciente, p.fecha_nacimiento, p.direccion
       FROM usuarios u
       INNER JOIN pacientes p ON p.id_usuario = u.id_usuario
       WHERE u.correo = ? AND u.rol = 'paciente'
       LIMIT 1`,
      [correo],
    )
    const usuario = usuarios[0]

    if (
      !usuario ||
      !usuario.estado ||
      !(await bcrypt.compare(password, usuario.password_hash))
    ) {
      registrarFallo(clave)
      return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' })
    }

    intentosLogin.delete(clave)
    return res.json({
      token: crearToken(usuario),
      paciente: pacientePublico(usuario),
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/solicitar-recuperacion', async (req, res, next) => {
  const correo = limpiarTexto(req.body.correo).toLowerCase()
  const respuesta = {
    mensaje:
      'Si el correo está registrado, se generó un enlace para restablecer la contraseña.',
  }

  if (!correo) {
    return res.status(400).json({ mensaje: 'Ingresa tu correo electrónico.' })
  }

  try {
    const [usuarios] = await pool.execute(
      `SELECT id_usuario FROM usuarios
       WHERE correo = ? AND rol = 'paciente' AND estado = 1 LIMIT 1`,
      [correo],
    )
    const usuario = usuarios[0]

    if (!usuario) return res.json(respuesta)

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    await pool.execute(
      'UPDATE recuperacion_password SET usado = 1 WHERE id_usuario = ? AND usado = 0',
      [usuario.id_usuario],
    )
    await pool.execute(
      `INSERT INTO recuperacion_password
        (id_usuario, token_hash, fecha_expiracion)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [usuario.id_usuario, tokenHash],
    )

    if (process.env.NODE_ENV !== 'production') {
      respuesta.enlaceDesarrollo =
        `${process.env.CLIENT_URL || 'http://localhost:5173'}/?resetToken=${token}`
    }

    return res.json(respuesta)
  } catch (error) {
    return next(error)
  }
})

router.post('/restablecer-password', async (req, res, next) => {
  const token = limpiarTexto(req.body.token)
  const nuevaPassword = req.body.nuevaPassword

  if (!token || !passwordSegura(nuevaPassword)) {
    return res.status(400).json({
      mensaje:
        'El enlace es obligatorio y la nueva contraseña debe tener 8 caracteres, mayúscula, minúscula y número.',
    })
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const [[recuperacion]] = await connection.execute(
      `SELECT id_recuperacion, id_usuario
       FROM recuperacion_password
       WHERE token_hash = ? AND usado = 0 AND fecha_expiracion > NOW()
       LIMIT 1 FOR UPDATE`,
      [tokenHash],
    )

    if (!recuperacion) {
      await connection.rollback()
      return res.status(400).json({
        mensaje: 'El enlace de recuperación no es válido o ya expiró.',
      })
    }

    const passwordHash = await bcrypt.hash(nuevaPassword, 12)
    await connection.execute(
      `UPDATE usuarios
       SET password_hash = ?, token_version = token_version + 1
       WHERE id_usuario = ?`,
      [passwordHash, recuperacion.id_usuario],
    )
    await connection.execute(
      `UPDATE recuperacion_password SET usado = 1
       WHERE id_usuario = ? AND usado = 0`,
      [recuperacion.id_usuario],
    )
    await connection.commit()

    return res.json({
      mensaje: 'Contraseña restablecida. Ya puedes iniciar sesión.',
    })
  } catch (error) {
    if (connection) await connection.rollback()
    return next(error)
  } finally {
    connection?.release()
  }
})

export default router
