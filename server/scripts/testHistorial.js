import 'dotenv/config'
import jwt from 'jsonwebtoken'
import mysql from 'mysql2/promise'

const apiUrl = `http://localhost:${process.env.PORT || 3001}/api`
const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

try {
  const [[paciente]] = await db.execute(
    `SELECT
      u.id_usuario AS idUsuario,
      p.id_paciente AS idPaciente,
      u.token_version AS tokenVersion
     FROM pacientes p
     INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
     ORDER BY p.id_paciente LIMIT 1`,
  )

  if (!paciente) throw new Error('No existe un paciente para ejecutar la prueba.')

  const token = jwt.sign(
    { ...paciente, rol: 'paciente' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' },
  )
  const headers = { Authorization: `Bearer ${token}` }
  const historialResponse = await fetch(`${apiUrl}/historial`, { headers })
  const historial = await historialResponse.json()

  if (!historialResponse.ok) throw new Error(historial.mensaje)
  if (
    historial.consultas.length === 0 ||
    historial.recetas.length === 0 ||
    historial.resultados.length === 0
  ) {
    throw new Error('El historial de demostración está incompleto.')
  }

  const idDocumento = historial.consultas[0].idDocumento
  const documentoResponse = await fetch(
    `${apiUrl}/historial/documentos/${idDocumento}/descargar`,
    { headers },
  )
  const bytes = new Uint8Array(await documentoResponse.arrayBuffer())
  const firma = String.fromCharCode(...bytes.slice(0, 4))

  if (!documentoResponse.ok || firma !== '%PDF') {
    throw new Error('El documento descargado no es un PDF válido.')
  }

  const tokenAjeno = jwt.sign(
    {
      idUsuario: paciente.idUsuario,
      idPaciente: paciente.idPaciente + 999999,
      rol: 'paciente',
      tokenVersion: paciente.tokenVersion,
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' },
  )
  const respuestaAjena = await fetch(
    `${apiUrl}/historial/documentos/${idDocumento}/descargar`,
    { headers: { Authorization: `Bearer ${tokenAjeno}` } },
  )

  if (respuestaAjena.status !== 404) {
    throw new Error('La protección de propiedad del documento no respondió como se esperaba.')
  }

  console.log('Historial, PDF y control de acceso: correctos.')
} finally {
  await db.end()
}
