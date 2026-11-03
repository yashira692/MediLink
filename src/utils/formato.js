export function fechaActual() {
  const ahora = new Date()
  const desplazamiento = ahora.getTimezoneOffset() * 60000
  return new Date(ahora.getTime() - desplazamiento).toISOString().slice(0, 10)
}

export function formatearFecha(fecha) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${fecha}T00:00:00Z`))
}

export function formatearHora(hora) {
  const [horas, minutos] = hora.slice(0, 5).split(':').map(Number)
  return new Intl.DateTimeFormat('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2000, 0, 1, horas, minutos))
}

export function etiquetaEstado(estado) {
  return estado.charAt(0).toUpperCase() + estado.slice(1)
}

export function sumarDias(fecha, dias) {
  const resultado = new Date(`${fecha}T00:00:00Z`)
  resultado.setUTCDate(resultado.getUTCDate() + dias)
  return resultado.toISOString().slice(0, 10)
}

export function lunesDeLaSemana(fecha) {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay()
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia)
}
