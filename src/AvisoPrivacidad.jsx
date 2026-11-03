import { useState } from 'react'

export function TextoAvisoPrivacidad() {
  return (
    <div className="aviso-privacidad">
      <p>
        MediLink registra tus datos de identificación y contacto, tus citas, y
        tu información de salud: diagnósticos, recetas, resultados, documentos
        médicos y consultas al asistente virtual.
      </p>
      <p>
        <strong>Para qué se usan:</strong> gestionar tus citas, brindarte atención
        médica, mantener tu historial y enviarte avisos sobre tu atención.
      </p>
      <p>
        <strong>Quién puede verlos:</strong> tú y los médicos con los que tienes o
        tuviste citas. El administrador ve datos de citas y reportes, pero no tu
        historial clínico. Queda registro de los accesos de médicos y
        administradores.
      </p>
      <p>
        <strong>Servicios externos:</strong> si están activados, tus avisos se
        envían por correo y WhatsApp, y tus preguntas al asistente pueden
        procesarse con Dialogflow de Google. No escribas datos sensibles en el
        asistente.
      </p>
      <p>
        <strong>Tus derechos:</strong> puedes solicitar acceder a tus datos,
        rectificarlos, cancelarlos u oponerte a su tratamiento, conforme a la Ley
        N.° 29733, escribiendo al consultorio.
      </p>
      <p>
        Los datos de salud son datos sensibles. Al aceptar, autorizas su
        tratamiento para estas finalidades.
      </p>
    </div>
  )
}

export function PantallaConsentimiento({ aceptar, cerrarSesion }) {
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)

    try {
      await aceptar()
    } catch (error) {
      alert(error.message)
      setEnviando(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={enviar}>
        <div className="login-logo">〽 MediLink</div>
        <h1>Aviso de privacidad</h1>
        <p className="subtitle">
          Para continuar, revisa cómo tratamos tus datos.
        </p>

        <TextoAvisoPrivacidad />

        <label className="consentimiento">
          <input
            type="checkbox"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
          />
          <span>He leído el aviso y autorizo el tratamiento de mis datos.</span>
        </label>

        <button type="submit" disabled={!acepta || enviando}>
          {enviando ? 'Guardando...' : 'Aceptar y continuar'}
        </button>

        <button type="button" className="secondary-btn" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </form>
    </div>
  )
}
