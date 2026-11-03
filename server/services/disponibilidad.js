export const ESTADOS_ACTIVOS = ['pendiente', 'confirmada', 'reprogramada']

export function fechaHoraFutura(fecha, hora) {
  const fechaCita = new Date(`${fecha}T${hora}`)
  return !Number.isNaN(fechaCita.getTime()) && fechaCita > new Date()
}

function horaAMinutos(hora) {
  const [horas, minutos] = hora.slice(0, 5).split(':').map(Number)
  return horas * 60 + minutos
}

function minutosAHora(total) {
  const horas = String(Math.floor(total / 60)).padStart(2, '0')
  const minutos = String(total % 60).padStart(2, '0')
  return `${horas}:${minutos}`
}

export async function obtenerDisponibilidad(connection, idMedico, fecha) {
  const diaSemanaJs = new Date(`${fecha}T12:00:00`).getDay()
  const diaSemana = diaSemanaJs === 0 ? 7 : diaSemanaJs
  const [jornadas] = await connection.execute(
    `SELECT hora_inicio, hora_fin, duracion_minutos
     FROM disponibilidad_medica
     WHERE id_medico = ? AND dia_semana = ? AND estado = 1`,
    [idMedico, diaSemana],
  )
  const [ocupadas] = await connection.execute(
    `SELECT TIME_FORMAT(hora, '%H:%i') AS hora
     FROM citas
     WHERE id_medico = ? AND fecha = ? AND estado IN (?, ?, ?)`,
    [idMedico, fecha, ...ESTADOS_ACTIVOS],
  )
  const horasOcupadas = new Set(ocupadas.map((cita) => cita.hora))
  const horarios = []

  for (const jornada of jornadas) {
    const inicio = horaAMinutos(jornada.hora_inicio)
    const fin = horaAMinutos(jornada.hora_fin)

    for (
      let minuto = inicio;
      minuto + jornada.duracion_minutos <= fin;
      minuto += jornada.duracion_minutos
    ) {
      const hora = minutosAHora(minuto)
      if (!horasOcupadas.has(hora) && fechaHoraFutura(fecha, hora)) {
        horarios.push(hora)
      }
    }
  }

  return horarios
}
