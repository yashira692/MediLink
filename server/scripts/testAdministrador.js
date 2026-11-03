import 'dotenv/config'
import mysql from 'mysql2/promise'

const apiUrl = `http://localhost:${process.env.PORT || 3001}/api`
const sello = String(Date.now())
const correoPaciente = `admin.paciente.${sello}@medilink.test`
const correoMedico = `admin.medico.${sello}@medilink.test`
const passwordMedico = 'MedicoPrueba2026'
let idUsuarioPaciente
let idPaciente
let idMedico
let idEspecialidad

async function solicitud(ruta, token, opciones = {}) {
  const respuesta = await fetch(`${apiUrl}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const datos = await respuesta.json().catch(() => ({}))
  return { status: respuesta.status, datos }
}

async function exito(ruta, token, opciones) {
  const { status, datos } = await solicitud(ruta, token, opciones)
  if (status >= 400) throw new Error(`${ruta}: ${datos.mensaje}`)
  return datos
}

function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje)
}

const enviar = (metodo, cuerpo) => ({
  method: metodo,
  body: JSON.stringify(cuerpo),
})

const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dateStrings: true,
})

const [[{ ultimoRegistro }]] = await db.execute(
  'SELECT COALESCE(MAX(id_bitacora), 0) AS ultimoRegistro FROM bitacora_accesos',
)

try {
  const sesion = await exito(
    '/auth/login',
    null,
    enviar('POST', { correo: 'admin@medilink.pe', password: 'Medilink2026!' }),
  )
  const token = sesion.token
  comprobar(sesion.administrador?.rol === 'administrador', 'Login de administrador incorrecto.')

  const registro = await exito(
    '/auth/registro',
    null,
    enviar('POST', {
      nombres: 'Paciente',
      apellidos: 'Reporte',
      dni: sello.slice(-8),
      correo: correoPaciente,
      telefono: '900333444',
      password: 'Prueba2026!',
      aceptaPrivacidad: true,
    }),
  )
  const tokenPaciente = registro.token
  idUsuarioPaciente = registro.paciente.idUsuario
  idPaciente = registro.paciente.idPaciente

  // Separación de roles
  const sesionEmily = await exito(
    '/auth/login',
    null,
    enviar('POST', { correo: 'emily.roberts@medilink.pe', password: 'Medilink2026!' }),
  )
  comprobar(
    (await solicitud('/admin/dashboard', tokenPaciente)).status === 403,
    'Un paciente accedió al panel de administración.',
  )
  comprobar(
    (await solicitud('/admin/dashboard', sesionEmily.token)).status === 403,
    'Un médico accedió al panel de administración.',
  )
  comprobar((await solicitud('/admin/dashboard')).status === 401, 'Dashboard sin sesión.')
  comprobar((await solicitud('/medico/perfil', token)).status === 403, 'Admin en rutas de médico.')
  comprobar((await solicitud('/citas', token)).status === 403, 'Admin en rutas de paciente.')

  // Especialidades
  const nombreEspecialidad = `Especialidad ${sello}`
  const especialidad = await exito(
    '/admin/especialidades',
    token,
    enviar('POST', { nombre: nombreEspecialidad, descripcion: 'Prueba' }),
  )
  idEspecialidad = especialidad.id
  comprobar(
    (await solicitud('/admin/especialidades', token, enviar('POST', { nombre: nombreEspecialidad })))
      .status === 409,
    'Se duplicó una especialidad.',
  )
  comprobar(
    (await solicitud('/admin/especialidades', token, enviar('POST', { nombre: '' }))).status === 400,
    'Se aceptó una especialidad sin nombre.',
  )
  await exito(
    `/admin/especialidades/${idEspecialidad}`,
    token,
    enviar('PUT', { nombre: `${nombreEspecialidad} editada`, descripcion: 'Editada' }),
  )

  // Médicos
  const medico = {
    nombres: 'Medico',
    apellidos: 'Prueba',
    dni: String(Number(sello.slice(-8)) + 1).padStart(8, '0').slice(-8),
    correo: correoMedico,
    telefono: '900444555',
    cmp: `T${sello.slice(-8)}`,
    idEspecialidad,
    password: passwordMedico,
  }
  comprobar(
    (await solicitud('/admin/medicos', token, enviar('POST', { ...medico, password: 'debil' })))
      .status === 400,
    'Se aceptó una contraseña débil.',
  )
  comprobar(
    (await solicitud('/admin/medicos', token, enviar('POST', { ...medico, dni: '123' }))).status === 400,
    'Se aceptó un DNI inválido.',
  )
  comprobar(
    (await solicitud('/admin/medicos', token, enviar('POST', { ...medico, idEspecialidad: 999999 })))
      .status === 400,
    'Se aceptó una especialidad inexistente.',
  )

  const creado = await exito('/admin/medicos', token, enviar('POST', medico))
  idMedico = creado.id
  comprobar(
    (await solicitud('/admin/medicos', token, enviar('POST', medico))).status === 409,
    'Se duplicó un médico.',
  )

  await exito(
    `/admin/medicos/${idMedico}`,
    token,
    enviar('PUT', { ...medico, telefono: '900444666' }),
  )
  const listado = await exito('/admin/medicos', token)
  comprobar(
    listado.medicos.find((item) => item.id === idMedico)?.telefono === '900444666',
    'La edición del médico no se guardó.',
  )

  const sesionMedico = await exito(
    '/auth/login',
    null,
    enviar('POST', { correo: correoMedico, password: passwordMedico }),
  )
  comprobar(sesionMedico.medico?.idMedico === idMedico, 'El médico creado no pudo ingresar.')

  // El paciente lo ve y reserva
  let catalogo = await exito('/citas/catalogo', tokenPaciente)
  comprobar(catalogo.medicos.some((item) => item.id === idMedico), 'Médico fuera del catálogo.')

  let fecha
  let horarios = []
  for (let dias = 1; dias <= 7 && horarios.length === 0; dias += 1) {
    const [[fila]] = await db.execute(
      'SELECT DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL ? DAY), "%Y-%m-%d") AS fecha',
      [dias],
    )
    fecha = fila.fecha
    horarios = (await exito(`/citas/horarios?idMedico=${idMedico}&fecha=${fecha}`, tokenPaciente)).horarios
  }
  comprobar(horarios.length > 0, 'El médico creado no tiene horarios.')

  const mes = fecha.slice(0, 7)
  const [[{ hoy }]] = await db.execute(
    "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy",
  )
  const antes = await exito(`/admin/dashboard?mes=${mes}`, token)
  const reserva = await exito(
    '/citas',
    tokenPaciente,
    enviar('POST', { idMedico, fecha, hora: horarios[0], motivo: 'Prueba de reporte' }),
  )
  const despues = await exito(`/admin/dashboard?mes=${mes}`, token)
  comprobar(despues.citas === antes.citas + 1, 'El dashboard no contó la cita.')
  comprobar(despues.activas === antes.activas + 1, 'El dashboard no contó la cita activa.')
  comprobar(
    despues.especialidades.find((item) => item.id === idEspecialidad)?.citas === 1,
    'La demanda por especialidad es incorrecta.',
  )
  comprobar(
    (await solicitud('/admin/dashboard?mes=2026-13', token)).status === 400,
    'Se aceptó un mes inválido.',
  )

  // Reportes
  const rango = `desde=${fecha}&hasta=${fecha}`
  const porMedico = await exito(`/admin/reportes?${rango}&idMedico=${idMedico}`, token)
  comprobar(
    porMedico.filas.length === 1 && porMedico.filas[0].id === reserva.idCita,
    'El filtro por médico es incorrecto.',
  )
  comprobar(porMedico.resumen.activas === 1, 'El resumen del reporte es incorrecto.')
  comprobar(!('motivo' in porMedico.filas[0]), 'El reporte expone el motivo clínico.')

  const porEspecialidad = await exito(
    `/admin/reportes?${rango}&idEspecialidad=${idEspecialidad}`,
    token,
  )
  comprobar(porEspecialidad.filas.length === 1, 'El filtro por especialidad es incorrecto.')

  const otraEspecialidad = await exito(
    `/admin/reportes?${rango}&idMedico=${idMedico}&idEspecialidad=999999`,
    token,
  )
  comprobar(otraEspecialidad.filas.length === 0, 'Los filtros no se combinan.')
  comprobar(
    (await solicitud(`/admin/reportes?desde=${fecha}&hasta=2000-01-01`, token)).status === 400,
    'Se aceptó un período invertido.',
  )

  for (const [formato, firma] of [['pdf', '%PDF'], ['excel', 'PK']]) {
    const archivo = await fetch(
      `${apiUrl}/admin/reportes/exportar?${rango}&idMedico=${idMedico}&formato=${formato}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const bytes = Buffer.from(await archivo.arrayBuffer())
    comprobar(
      archivo.ok && bytes.subarray(0, firma.length).toString('latin1') === firma,
      `La exportación ${formato} no es válida.`,
    )
    comprobar(
      archivo.headers.get('content-disposition').includes('reporte-citas'),
      `La exportación ${formato} no tiene nombre.`,
    )
  }
  const exportarPaciente = await fetch(
    `${apiUrl}/admin/reportes/exportar?${rango}&formato=pdf`,
    { headers: { Authorization: `Bearer ${tokenPaciente}` } },
  )
  comprobar(exportarPaciente.status === 403, 'Un paciente exportó un reporte.')

  // Bitácora
  const bitacora = await exito(`/admin/bitacora?desde=${hoy}&hasta=${hoy}`, token)
  comprobar(
    bitacora.registros.some((registro) => registro.accion === 'exportar_reporte'),
    'La bitácora no registró la exportación.',
  )
  comprobar(
    (await solicitud(`/admin/bitacora?desde=${hoy}&hasta=${hoy}`, sesionEmily.token)).status === 403,
    'Un médico accedió a la bitácora.',
  )
  comprobar(
    (await solicitud('/admin/bitacora?desde=x&hasta=y', token)).status === 400,
    'Se aceptó un período inválido en la bitácora.',
  )

  // Desactivación
  const especialidadOcupada = await solicitud(
    `/admin/especialidades/${idEspecialidad}/estado`,
    token,
    enviar('PATCH', { activo: false }),
  )
  comprobar(especialidadOcupada.status === 409, 'Se desactivó una especialidad con médicos.')

  const medicoOcupado = await solicitud(
    `/admin/medicos/${idMedico}/estado`,
    token,
    enviar('PATCH', { activo: false }),
  )
  comprobar(medicoOcupado.status === 409, 'Se desactivó un médico con citas por atender.')

  await exito(
    `/medico/citas/${reserva.idCita}/cancelar`,
    sesionMedico.token,
    enviar('PATCH', { motivo: 'Prueba' }),
  )
  await exito(`/admin/medicos/${idMedico}/estado`, token, enviar('PATCH', { activo: false }))

  const loginInactivo = await solicitud(
    '/auth/login',
    null,
    enviar('POST', { correo: correoMedico, password: passwordMedico }),
  )
  comprobar(loginInactivo.status === 401, 'Un médico inactivo pudo ingresar.')
  comprobar(
    (await solicitud('/medico/perfil', sesionMedico.token)).status === 401,
    'La sesión del médico inactivo sigue vigente.',
  )

  catalogo = await exito('/citas/catalogo', tokenPaciente)
  comprobar(!catalogo.medicos.some((item) => item.id === idMedico), 'Médico inactivo en catálogo.')
  const sinHorarios = await exito(
    `/citas/horarios?idMedico=${idMedico}&fecha=${fecha}`,
    tokenPaciente,
  )
  comprobar(sinHorarios.horarios.length === 0, 'Un médico inactivo ofrece horarios.')

  await exito(
    `/admin/especialidades/${idEspecialidad}/estado`,
    token,
    enviar('PATCH', { activo: false }),
  )
  catalogo = await exito('/citas/catalogo', tokenPaciente)
  comprobar(
    !catalogo.especialidades.some((item) => item.id === idEspecialidad),
    'Especialidad inactiva en catálogo.',
  )

  await exito(`/admin/medicos/${idMedico}/estado`, token, enviar('PATCH', { activo: true }))
  await exito(
    '/auth/login',
    null,
    enviar('POST', { correo: correoMedico, password: passwordMedico }),
  )

  // Cambio de contraseña
  comprobar(typeof despues.vencidas === 'number', 'El dashboard no incluye las vencidas.')
  comprobar(
    (await solicitud('/admin/password', tokenPaciente, enviar('PUT', {}))).status === 403,
    'Un paciente usó la ruta de contraseña del administrador.',
  )
  comprobar(
    (await solicitud(
      '/admin/password',
      token,
      enviar('PUT', { passwordActual: 'Incorrecta2026', nuevaPassword: 'OtraClave2026' }),
    )).status === 401,
    'El administrador cambió su contraseña sin conocer la actual.',
  )

  const sesionFinal = await exito(
    '/auth/login',
    null,
    enviar('POST', { correo: correoMedico, password: passwordMedico }),
  )
  comprobar(
    (await solicitud(
      '/medico/password',
      sesionFinal.token,
      enviar('PUT', { passwordActual: passwordMedico, nuevaPassword: 'debil' }),
    )).status === 400,
    'Se aceptó una contraseña débil al cambiarla.',
  )
  await exito(
    '/medico/password',
    sesionFinal.token,
    enviar('PUT', { passwordActual: passwordMedico, nuevaPassword: 'MedicoNueva2026' }),
  )
  comprobar(
    (await solicitud('/medico/perfil', sesionFinal.token)).status === 401,
    'La sesión anterior sigue activa tras cambiar la contraseña.',
  )
  await exito(
    '/auth/login',
    null,
    enviar('POST', { correo: correoMedico, password: 'MedicoNueva2026' }),
  )

  console.log(
    'Login, permisos, médicos, especialidades, dashboard, reportes y exportación del administrador: correctos.',
  )
} finally {
  await db.execute('DELETE FROM bitacora_accesos WHERE id_bitacora > ?', [
    ultimoRegistro,
  ])
  if (idPaciente) {
    await db.execute('DELETE FROM notificaciones WHERE id_paciente = ?', [idPaciente])
    await db.execute('DELETE FROM citas WHERE id_paciente = ?', [idPaciente])
  }
  if (idUsuarioPaciente) {
    await db.execute('DELETE FROM usuarios WHERE id_usuario = ?', [idUsuarioPaciente])
  }
  if (idMedico) {
    await db.execute('DELETE FROM medicos WHERE id_medico = ?', [idMedico])
  }
  await db.execute('DELETE FROM usuarios WHERE correo = ?', [correoMedico])
  if (idEspecialidad) {
    await db.execute('DELETE FROM especialidades WHERE id_especialidad = ?', [idEspecialidad])
  }
  await db.end()
}
