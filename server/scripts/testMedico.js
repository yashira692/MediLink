import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const apiUrl = `http://localhost:${process.env.PORT || 3001}/api`
const correo = `medico.prueba.${Date.now()}@medilink.test`
const storageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../storage/medical-documents',
)
let idUsuario
let idPaciente

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

async function login(correoLogin, password) {
  return exito('/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ correo: correoLogin, password }),
  })
}

const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dateStrings: true,
})

try {
  const registro = await exito('/auth/registro', null, {
    method: 'POST',
    body: JSON.stringify({
      nombres: 'Paciente',
      apellidos: 'Medico',
      dni: String(Date.now()).slice(-8),
      correo,
      telefono: '900222333',
      password: 'Prueba2026!',
    }),
  })
  const tokenPaciente = registro.token
  idUsuario = registro.paciente.idUsuario
  idPaciente = registro.paciente.idPaciente

  const sesion = await login('emily.roberts@medilink.pe', 'Medilink2026!')
  const otro = await login('michael.chen@medilink.pe', 'Medilink2026!')
  const tokenMedico = sesion.token
  const tokenOtro = otro.token
  const idMedico = sesion.medico.idMedico

  comprobar(sesion.medico.rol === 'medico', 'El login no identificó al médico.')
  comprobar(!sesion.paciente, 'El login del médico devolvió datos de paciente.')

  const perfil = await exito('/medico/perfil', tokenMedico)
  comprobar(perfil.medico.idMedico === idMedico, 'Perfil de médico incorrecto.')

  // Separación de roles
  const pacienteEnMedico = await solicitud('/medico/perfil', tokenPaciente)
  const medicoEnCitas = await solicitud('/citas', tokenMedico)
  comprobar(pacienteEnMedico.status === 403, 'Un paciente accedió al perfil médico.')
  comprobar(medicoEnCitas.status === 403, 'Un médico accedió a rutas de paciente.')

  // Reserva del paciente en el primer día futuro con horarios
  let fecha
  let horarios = []
  for (let dias = 1; dias <= 7 && horarios.length < 3; dias += 1) {
    const [[fila]] = await db.execute(
      'SELECT DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL ? DAY), "%Y-%m-%d") AS fecha',
      [dias],
    )
    fecha = fila.fecha
    const disponibles = await exito(
      `/citas/horarios?idMedico=${idMedico}&fecha=${fecha}`,
      tokenPaciente,
    )
    horarios = disponibles.horarios
  }
  comprobar(horarios.length >= 3, 'No hay horarios para la prueba.')

  const reserva = await exito('/citas', tokenPaciente, {
    method: 'POST',
    body: JSON.stringify({
      idMedico,
      fecha,
      hora: horarios[0],
      motivo: 'Prueba de agenda médica',
    }),
  })
  const idCita = reserva.idCita

  // Agenda
  const agenda = await exito(
    `/medico/citas?desde=${fecha}&hasta=${fecha}`,
    tokenMedico,
  )
  const enAgenda = agenda.citas.find((cita) => cita.id === idCita)
  comprobar(enAgenda?.estado === 'pendiente', 'La cita no aparece en la agenda.')

  const agendaOtro = await exito(
    `/medico/citas?desde=${fecha}&hasta=${fecha}`,
    tokenOtro,
  )
  comprobar(
    !agendaOtro.citas.some((cita) => cita.id === idCita),
    'Otro médico ve citas ajenas.',
  )
  const rangoInvalido = await solicitud('/medico/citas?desde=x&hasta=y', tokenMedico)
  comprobar(rangoInvalido.status === 400, 'Se aceptó un rango de fechas inválido.')

  // Otro médico no puede actuar sobre la cita ni ver al paciente
  const aprobarAjena = await solicitud(`/medico/citas/${idCita}/aprobar`, tokenOtro, {
    method: 'PATCH',
  })
  const historialAjeno = await solicitud(
    `/medico/pacientes/${idPaciente}/historial`,
    tokenOtro,
  )
  comprobar(aprobarAjena.status === 404, 'Otro médico aprobó una cita ajena.')
  comprobar(historialAjeno.status === 404, 'Otro médico vio un historial ajeno.')

  // Una cita futura aún sin aprobar no se puede atender
  const consultaPendiente = await solicitud(
    `/medico/citas/${idCita}/consulta`,
    tokenMedico,
    { method: 'POST', body: JSON.stringify({ diagnostico: 'Prueba' }) },
  )
  comprobar(consultaPendiente.status === 409, 'Se atendió una cita sin aprobar.')

  // Aprobar, reprogramar y cancelar
  await exito(`/medico/citas/${idCita}/aprobar`, tokenMedico, { method: 'PATCH' })
  let [[fila]] = await db.execute('SELECT estado FROM citas WHERE id_cita = ?', [idCita])
  comprobar(fila.estado === 'confirmada', 'La cita no quedó confirmada.')

  const consultaFutura = await solicitud(
    `/medico/citas/${idCita}/consulta`,
    tokenMedico,
    { method: 'POST', body: JSON.stringify({ diagnostico: 'Prueba' }) },
  )
  comprobar(consultaFutura.status === 409, 'Se atendió una cita futura.')

  const libres = await exito(`/medico/horarios?fecha=${fecha}`, tokenMedico)
  comprobar(!libres.horarios.includes(horarios[0]), 'El horario ocupado sigue libre.')

  const horaOcupada = await solicitud(`/medico/citas/${idCita}/reprogramar`, tokenMedico, {
    method: 'PUT',
    body: JSON.stringify({ fecha, hora: horarios[0] }),
  })
  comprobar(horaOcupada.status === 409, 'Se reprogramó a un horario ocupado.')

  await exito(`/medico/citas/${idCita}/reprogramar`, tokenMedico, {
    method: 'PUT',
    body: JSON.stringify({ fecha, hora: horarios[1] }),
  })
  ;[[fila]] = await db.execute(
    "SELECT estado, TIME_FORMAT(hora, '%H:%i') AS hora FROM citas WHERE id_cita = ?",
    [idCita],
  )
  comprobar(
    fila.estado === 'reprogramada' && fila.hora === horarios[1],
    'La cita no quedó reprogramada.',
  )

  await exito(`/medico/citas/${idCita}/cancelar`, tokenMedico, {
    method: 'PATCH',
    body: JSON.stringify({ motivo: 'Prueba de cancelación' }),
  })
  const aprobarCancelada = await solicitud(`/medico/citas/${idCita}/aprobar`, tokenMedico, {
    method: 'PATCH',
  })
  comprobar(aprobarCancelada.status === 404, 'Se aprobó una cita cancelada.')

  const avisos = await exito('/notificaciones', tokenPaciente)
  const textos = avisos.notificaciones.map((aviso) => aviso.mensaje).join(' | ')
  comprobar(
    textos.includes('confirmada por el médico') &&
      textos.includes('El médico reprogramó') &&
      textos.includes('El médico canceló'),
    'El paciente no recibió las notificaciones de los cambios.',
  )

  // Consulta de una cita de hoy, fuera del horario normal para no ocupar turnos
  const [citaHoy] = await db.execute(
    `INSERT INTO citas (id_paciente, id_medico, fecha, hora, motivo, estado)
     VALUES (?, ?, CURDATE(), '23:30:00', 'Control de prueba', 'confirmada')`,
    [idPaciente, idMedico],
  )
  const rutaConsulta = `/medico/citas/${citaHoy.insertId}/consulta`
  const sinDiagnostico = await solicitud(rutaConsulta, tokenMedico, {
    method: 'POST',
    body: JSON.stringify({ observaciones: 'Sin diagnóstico' }),
  })
  const recetaIncompleta = await solicitud(rutaConsulta, tokenMedico, {
    method: 'POST',
    body: JSON.stringify({
      diagnostico: 'Prueba',
      medicamentos: [{ medicamento: 'Paracetamol' }],
    }),
  })
  comprobar(sinDiagnostico.status === 400, 'Se aceptó una consulta sin diagnóstico.')
  comprobar(recetaIncompleta.status === 400, 'Se aceptó una receta incompleta.')

  const consulta = await exito(rutaConsulta, tokenMedico, {
    method: 'POST',
    body: JSON.stringify({
      descripcion: 'Control general',
      diagnostico: 'Diagnóstico de prueba',
      observaciones: 'Observación de prueba',
      indicacionesGenerales: 'Reposo relativo',
      medicamentos: [
        {
          medicamento: 'Medicamento de prueba',
          dosis: '500 mg',
          frecuencia: 'Cada 8 horas',
          duracion: '3 días',
          indicacion: 'Después de los alimentos',
        },
      ],
    }),
  })
  comprobar(consulta.idReceta, 'No se generó la receta.')

  const repetida = await solicitud(rutaConsulta, tokenMedico, {
    method: 'POST',
    body: JSON.stringify({ diagnostico: 'Duplicado' }),
  })
  comprobar(repetida.status === 409, 'Se registró dos veces la misma consulta.')

  // El paciente ve la consulta y descarga sus PDF
  const historial = await exito('/historial', tokenPaciente)
  const registrada = historial.consultas.find(
    (item) => item.id === consulta.idHistorial,
  )
  const receta = historial.recetas.find((item) => item.id === consulta.idReceta)
  comprobar(registrada?.diagnostico === 'Diagnóstico de prueba', 'Historial sin consulta.')
  comprobar(receta?.medicamentos.length === 1, 'Historial sin receta.')

  for (const idDocumento of [registrada.idDocumento, receta.idDocumento]) {
    const descarga = await fetch(
      `${apiUrl}/historial/documentos/${idDocumento}/descargar`,
      { headers: { Authorization: `Bearer ${tokenPaciente}` } },
    )
    const bytes = new Uint8Array(await descarga.arrayBuffer())
    comprobar(
      descarga.ok && String.fromCharCode(...bytes.slice(0, 4)) === '%PDF',
      'El paciente no pudo descargar su PDF.',
    )
  }

  // El médico ve el historial de su paciente, pero otro médico no
  const pacientes = await exito('/medico/pacientes', tokenMedico)
  comprobar(
    pacientes.pacientes.some((item) => item.id === idPaciente),
    'El paciente no aparece en la lista del médico.',
  )
  const historialMedico = await exito(
    `/medico/pacientes/${idPaciente}/historial`,
    tokenMedico,
  )
  comprobar(historialMedico.consultas.length === 1, 'El médico no ve el historial.')

  const rutaDocumento = `/medico/documentos/${registrada.idDocumento}/descargar`
  const documentoPropio = await fetch(`${apiUrl}${rutaDocumento}`, {
    headers: { Authorization: `Bearer ${tokenMedico}` },
  })
  await documentoPropio.arrayBuffer()
  const documentoAjeno = await solicitud(rutaDocumento, tokenOtro)
  comprobar(documentoPropio.ok, 'El médico no pudo descargar el documento.')
  comprobar(documentoAjeno.status === 404, 'Otro médico descargó un documento ajeno.')

  // Subida de documentos
  const pdf = Buffer.from('%PDF-1.4\n% documento de prueba\n%%EOF\n')

  async function subirDocumento(token, campos, contenido = pdf, destino = idPaciente) {
    const formulario = new FormData()
    for (const [campo, valor] of Object.entries(campos)) {
      formulario.append(campo, valor)
    }
    if (contenido) {
      formulario.append(
        'archivo',
        new Blob([contenido], { type: 'application/pdf' }),
        'hemograma ñandú.pdf',
      )
    }
    const respuesta = await fetch(`${apiUrl}/medico/pacientes/${destino}/documentos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formulario,
    })
    return respuesta.status
  }

  const [[{ hoy, manana }]] = await db.execute(
    `SELECT
      DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy,
      DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d') AS manana`,
  )
  const datosResultado = {
    tipo: 'resultado',
    nombreExamen: 'Examen subido de prueba',
    fechaResultado: hoy,
    resumen: 'Resumen de prueba',
  }

  comprobar(
    (await subirDocumento(tokenPaciente, datosResultado)) === 403,
    'Un paciente subió un documento médico.',
  )
  comprobar(
    (await subirDocumento(tokenOtro, datosResultado)) === 404,
    'Otro médico subió un documento a un paciente ajeno.',
  )
  comprobar(
    (await subirDocumento(tokenMedico, datosResultado, Buffer.from('no es un pdf'))) === 400,
    'Se aceptó un archivo que no es PDF.',
  )
  comprobar(
    (await subirDocumento(tokenMedico, datosResultado, null)) === 400,
    'Se aceptó una subida sin archivo.',
  )
  comprobar(
    (await subirDocumento(
      tokenMedico,
      datosResultado,
      Buffer.concat([pdf, Buffer.alloc(10 * 1024 * 1024)]),
    )) === 413,
    'Se aceptó un PDF de más de 10 MB.',
  )
  comprobar(
    (await subirDocumento(tokenMedico, { ...datosResultado, fechaResultado: manana })) === 400,
    'Se aceptó un resultado con fecha futura.',
  )
  comprobar(
    (await subirDocumento(tokenMedico, { ...datosResultado, fechaResultado: '2026-02-31' })) === 400,
    'Se aceptó una fecha inexistente.',
  )
  comprobar(
    (await subirDocumento(tokenMedico, { tipo: 'informe', idHistorial: '999999' })) === 404,
    'Se adjuntó un informe a una consulta inexistente.',
  )
  comprobar(
    (await subirDocumento(tokenMedico, datosResultado)) === 201,
    'No se pudo subir el resultado.',
  )
  comprobar(
    (await subirDocumento(tokenMedico, {
      tipo: 'informe',
      idHistorial: String(consulta.idHistorial),
    })) === 201,
    'No se pudo subir el informe.',
  )
  comprobar(
    (await subirDocumento(tokenMedico, {
      tipo: 'receta',
      idReceta: String(consulta.idReceta),
    })) === 201,
    'No se pudo subir la receta.',
  )

  const conDocumentos = await exito('/historial', tokenPaciente)
  const resultadoSubido = conDocumentos.resultados.find(
    (item) => item.nombreExamen === 'Examen subido de prueba',
  )
  comprobar(resultadoSubido?.estado === 'disponible', 'El paciente no ve el resultado.')
  comprobar(
    conDocumentos.consultas[0].idDocumento !== registrada.idDocumento,
    'El informe subido no reemplazó al anterior.',
  )

  const descargaResultado = await fetch(
    `${apiUrl}/historial/documentos/${resultadoSubido.idDocumento}/descargar`,
    { headers: { Authorization: `Bearer ${tokenPaciente}` } },
  )
  const bytesResultado = Buffer.from(await descargaResultado.arrayBuffer())
  comprobar(bytesResultado.equals(pdf), 'El PDF descargado no coincide con el subido.')
  comprobar(
    decodeURIComponent(descargaResultado.headers.get('content-disposition')).includes('hemograma ñandú.pdf'),
    'El nombre original del PDF no se conservó.',
  )

  const avisosSubida = await exito('/notificaciones', tokenPaciente)
  comprobar(
    avisosSubida.notificaciones.some((aviso) =>
      aviso.mensaje.includes('Examen subido de prueba'),
    ),
    'El paciente no recibió el aviso del documento.',
  )

  console.log(
    'Login, agenda, aprobación, reprogramación, cancelación, consulta, receta, subida de PDF y permisos del médico: correctos.',
  )
} finally {
  if (idPaciente) {
    await db.execute('DELETE FROM documentos_medicos WHERE id_paciente = ?', [idPaciente])
    await db.execute(
      `DELETE r FROM recetas r
       INNER JOIN historial_medico h ON h.id_historial = r.id_historial
       WHERE h.id_paciente = ?`,
      [idPaciente],
    )
    await db.execute('DELETE FROM resultados_laboratorio WHERE id_paciente = ?', [idPaciente])
    await db.execute('DELETE FROM historial_medico WHERE id_paciente = ?', [idPaciente])
    await db.execute('DELETE FROM notificaciones WHERE id_paciente = ?', [idPaciente])
    await db.execute('DELETE FROM citas WHERE id_paciente = ?', [idPaciente])
    fs.rmSync(path.join(storageRoot, String(idPaciente)), {
      recursive: true,
      force: true,
    })
  }
  if (idUsuario) {
    await db.execute('DELETE FROM usuarios WHERE id_usuario = ?', [idUsuario])
  }
  await db.end()
}
