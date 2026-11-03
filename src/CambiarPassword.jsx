import { useState } from 'react'
import { api } from './services/api.js'

function CambiarPassword({ ruta, cerrarSesion }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(e) {
    e.preventDefault()

    if (nueva !== confirmar) {
      alert('Las nuevas contraseñas no coinciden.')
      return
    }

    setGuardando(true)

    try {
      const datos = await api(ruta, {
        method: 'PUT',
        body: JSON.stringify({ passwordActual: actual, nuevaPassword: nueva }),
      })
      alert(datos.mensaje)
      cerrarSesion()
    } catch (error) {
      alert(error.message)
      setGuardando(false)
    }
  }

  return (
    <>
      <h1>Cambiar contraseña</h1>
      <p className="subtitle">
        Usa al menos 8 caracteres, una mayúscula, una minúscula y un número.
      </p>

      <form className="form-card" onSubmit={guardar}>
        <label>Contraseña actual</label>
        <input
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />

        <label>Nueva contraseña</label>
        <input
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />

        <label>Confirmar nueva contraseña</label>
        <input
          type="password"
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
        />

        <button type="submit" disabled={guardando}>
          {guardando ? 'Actualizando...' : 'Cambiar contraseña'}
        </button>
      </form>
    </>
  )
}

export default CambiarPassword
