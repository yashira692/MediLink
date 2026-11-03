import pool from '../config/db.js'

export async function marcarCitasVencidas() {
  const [resultado] = await pool.execute(
    `UPDATE citas
     SET estado = 'vencida'
     WHERE fecha < CURDATE()
       AND estado IN ('pendiente', 'confirmada', 'reprogramada')`,
  )

  return resultado.affectedRows
}
