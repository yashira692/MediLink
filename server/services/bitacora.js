export async function registrarAcceso(
  conexion,
  req,
  { accion, idPaciente = null, detalle = null },
) {
  await conexion.execute(
    `INSERT INTO bitacora_accesos
      (id_usuario, usuario, rol, accion, id_paciente, detalle, ip)
     SELECT id_usuario, CONCAT(nombres, ' ', apellidos), rol, ?, ?, ?, ?
     FROM usuarios WHERE id_usuario = ?`,
    [accion, idPaciente, detalle, req.ip, req.usuario.idUsuario],
  )
}
