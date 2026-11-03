import mysql from 'mysql2/promise'

export const opcionesConexion = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // En la nube la conexión va cifrada y se valida con el certificado del proveedor.
  ssl: process.env.DB_SSL_CA
    ? { ca: process.env.DB_SSL_CA.replaceAll('\\n', '\n') }
    : undefined,
}

// La base en la nube trabaja en UTC; CURDATE() y NOW() deben seguir la hora de la clínica.
export const zonaHorariaBase = process.env.DB_TIME_ZONE

const pool = mysql.createPool({
  ...opcionesConexion,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
})

if (zonaHorariaBase) {
  pool.on('connection', (connection) => {
    connection.query('SET time_zone = ?', [zonaHorariaBase], (error) => {
      if (error) console.error('No se pudo fijar la zona horaria:', error.message)
    })
  })
}

export async function verificarConexion() {
  const connection = await pool.getConnection()
  connection.release()
}

export default pool
