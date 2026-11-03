const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

export const VERSION_AVISO_PRIVACIDAD = '2026-11'

export function fechaValida(fecha) {
  if (!FORMATO_FECHA.test(fecha || '')) return false

  const convertida = new Date(`${fecha}T00:00:00Z`)
  return (
    !Number.isNaN(convertida.getTime()) &&
    convertida.toISOString().slice(0, 10) === fecha
  )
}

export function passwordSegura(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  )
}
