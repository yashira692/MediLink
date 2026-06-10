const TOKEN_KEY = 'medilinkToken'

export function obtenerToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function guardarToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function eliminarToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export async function api(ruta, opciones = {}) {
  const token = obtenerToken()
  const headers = new Headers(opciones.headers)

  if (opciones.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let respuesta

  try {
    respuesta = await fetch(`/api${ruta}`, {
      ...opciones,
      headers,
    })
  } catch {
    throw new Error(
      'No se pudo conectar con el servidor. Verifica que el backend esté iniciado.',
    )
  }
  const datos = await respuesta.json().catch(() => ({}))

  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'No se pudo completar la operación.')
  }

  return datos
}

export async function descargarArchivo(ruta) {
  const token = obtenerToken()
  let respuesta

  try {
    respuesta = await fetch(`/api${ruta}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor.')
  }

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}))
    throw new Error(datos.mensaje || 'No se pudo descargar el documento.')
  }

  const disposicion = respuesta.headers.get('Content-Disposition') || ''
  const coincidencia = disposicion.match(/filename="?([^";]+)"?/)
  const nombre = coincidencia?.[1] || 'documento-medico.pdf'
  const archivo = await respuesta.blob()
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')

  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
