import { useEffect, useRef, useState } from 'react'
import './App.css'
import {
  api,
  descargarArchivo,
  eliminarToken,
  guardarToken,
  obtenerToken,
} from './services/api.js'

function fechaActual() {
  const ahora = new Date()
  const desplazamiento = ahora.getTimezoneOffset() * 60000
  return new Date(ahora.getTime() - desplazamiento).toISOString().slice(0, 10)
}

function formatearFecha(fecha) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${fecha}T00:00:00Z`))
}

function formatearHora(hora) {
  const [horas, minutos] = hora.slice(0, 5).split(':').map(Number)
  return new Intl.DateTimeFormat('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2000, 0, 1, horas, minutos))
}

function etiquetaEstado(estado) {
  return estado.charAt(0).toUpperCase() + estado.slice(1)
}

function formatearFechaHora(fecha) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(fecha))
}

function App() {
  const [vista, setVista] = useState('dashboard')
  const [menuUsuario, setMenuUsuario] = useState(false)
  const [citas, setCitas] = useState([])
  const [confirmacion, setConfirmacion] = useState(null)
  const [procesandoConfirmacion, setProcesandoConfirmacion] = useState(false)
  const [aviso, setAviso] = useState(null)

  const [notificaciones, setNotificaciones] = useState([])

  const [paciente, setPaciente] = useState(null)
  const [sesionActiva, setSesionActiva] = useState(Boolean(obtenerToken()))
  const [cargandoSesion, setCargandoSesion] = useState(Boolean(obtenerToken()))

  useEffect(() => {
    if (!obtenerToken()) return

    api('/paciente/perfil')
      .then(({ paciente: pacienteActual }) => {
        setPaciente(pacienteActual)
        setSesionActiva(true)
      })
      .catch(() => {
        eliminarToken()
        setSesionActiva(false)
      })
      .finally(() => setCargandoSesion(false))
  }, [])

  useEffect(() => {
    if (!sesionActiva || !obtenerToken()) return

    cargarCitas()
    cargarNotificaciones()
  }, [sesionActiva])

  async function cargarCitas() {
    try {
      const datos = await api('/citas')
      setCitas(datos.citas)
    } catch (error) {
      alert(error.message)
    }
  }

  async function cargarNotificaciones() {
    try {
      await api('/notificaciones/generar-recordatorios', {
        method: 'POST',
      })
      const datos = await api('/notificaciones')
      setNotificaciones(datos.notificaciones)
    } catch (error) {
      alert(error.message)
    }
  }

  async function reservarCita(nuevaCita) {
    const datos = await api('/citas', {
      method: 'POST',
      body: JSON.stringify(nuevaCita),
    })

    await cargarCitas()
    await cargarNotificaciones()
    setVista('dashboard')
    return datos
  }

  useEffect(() => {
    if (!aviso) return undefined

    const temporizador = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(temporizador)
  }, [aviso])

  useEffect(() => {
    const alertaOriginal = window.alert

    window.alert = (mensaje) => {
      const texto = String(mensaje)
      const esExito = /correctamente|exitosa|reservada|actualizada|registrado/i.test(texto)
      setAviso({
        tipo: esExito ? 'exito' : 'info',
        mensaje: texto,
      })
    }

    return () => {
      window.alert = alertaOriginal
    }
  }, [])

  function solicitarConfirmacion(configuracion) {
    setConfirmacion(configuracion)
  }

  function cancelarCita(id) {
    solicitarConfirmacion({
      titulo: 'Cancelar cita',
      mensaje:
        '¿Confirmas que deseas cancelar esta cita? Esta acción no se puede deshacer.',
      textoConfirmar: 'Sí, cancelar cita',
      textoProcesando: 'Cancelando...',
      accion: async () => {
        const datos = await api(`/citas/${id}/cancelar`, {
          method: 'PATCH',
          body: JSON.stringify({ motivo: 'Cancelada por el paciente' }),
        })
        await cargarCitas()
        await cargarNotificaciones()
        setAviso({ tipo: 'exito', mensaje: datos.mensaje })
      },
    })
  }

  async function ejecutarConfirmacion() {
    if (!confirmacion) return

    setProcesandoConfirmacion(true)

    try {
      await confirmacion.accion()
      setConfirmacion(null)
    } catch (error) {
      setAviso({ tipo: 'error', mensaje: error.message })
    } finally {
      setProcesandoConfirmacion(false)
    }
  }

  async function reprogramarCita(id, nuevaFecha, nuevaHora) {
    const datos = await api(`/citas/${id}/reprogramar`, {
      method: 'PUT',
      body: JSON.stringify({ fecha: nuevaFecha, hora: nuevaHora }),
    })
    await cargarCitas()
    await cargarNotificaciones()
    return datos
  }

  async function iniciarSesion(correo, password) {
    try {
      const datos = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ correo, password }),
      })

      guardarToken(datos.token)
      setPaciente(datos.paciente)
      setSesionActiva(true)
    } catch (error) {
      alert(error.message)
    }
  }

  async function registrarPaciente(nuevoPaciente) {
    try {
      const datos = await api('/auth/registro', {
        method: 'POST',
        body: JSON.stringify(nuevoPaciente),
      })

      guardarToken(datos.token)
      setPaciente(datos.paciente)
      setSesionActiva(true)
    } catch (error) {
      alert(error.message)
    }
  }

  async function actualizarPerfil(datosPerfil) {
    const datos = await api('/paciente/perfil', {
      method: 'PUT',
      body: JSON.stringify({
        correo: datosPerfil.correo,
        telefono: datosPerfil.telefono,
        direccion: datosPerfil.direccion,
      }),
    })

    setPaciente(datos.paciente)
    await cargarNotificaciones()

    return datos
  }

  async function marcarNotificacionLeida(id) {
    try {
      await api(`/notificaciones/${id}/leer`, { method: 'PATCH' })
      setNotificaciones((actuales) =>
        actuales.map((notificacion) =>
          notificacion.id === id
            ? {
                ...notificacion,
                leido: 1,
                fechaLectura: new Date().toISOString(),
              }
            : notificacion,
        ),
      )
    } catch (error) {
      alert(error.message)
    }
  }

  async function marcarTodasLeidas() {
    try {
      await api('/notificaciones/leer-todas', { method: 'PATCH' })
      const fechaLectura = new Date().toISOString()
      setNotificaciones((actuales) =>
        actuales.map((notificacion) => ({
          ...notificacion,
          leido: 1,
          fechaLectura: notificacion.fechaLectura || fechaLectura,
        })),
      )
    } catch (error) {
      alert(error.message)
    }
  }

  function cerrarSesion() {
    eliminarToken()
    setPaciente(null)
    setSesionActiva(false)
  }

  const notificacionesNoLeidas = notificaciones.filter(
    (notificacion) => !notificacion.leido,
  ).length

  if (cargandoSesion) {
    return <div className="session-loading">Verificando sesión...</div>
  }

  if (!sesionActiva) {
    return (
      <>
        <LoginRegistro
          iniciarSesion={iniciarSesion}
          registrarPaciente={registrarPaciente}
        />
        {aviso && (
          <div className={`app-toast ${aviso.tipo}`} role="status">
            {aviso.mensaje}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">〽 MediLink</div>

        <button
          className={vista === 'dashboard' ? 'menu active' : 'menu'}
          onClick={() => setVista('dashboard')}
        >
          Panel principal
        </button>

        <button
          className={vista === 'reservar' ? 'menu active' : 'menu'}
          onClick={() => setVista('reservar')}
        >
          Reservar cita
        </button>

        <button
          className={vista === 'misCitas' ? 'menu active' : 'menu'}
          onClick={() => setVista('misCitas')}
        >
          Mis citas
        </button>

        <button
          className={vista === 'historial' ? 'menu active' : 'menu'}
          onClick={() => setVista('historial')}
        >
          Historial médico
        </button>

        <button
          className={vista === 'asistente' ? 'menu active' : 'menu'}
          onClick={() => setVista('asistente')}
        >
          Asistente IA
        </button>

      </aside>

      <main className="main">
        <header className="header">
          <div>
            <h2>{paciente.nombres} {paciente.apellidos}</h2>
            <p>Paciente</p>
          </div>

          <div className="header-actions">
            <button className="bell" onClick={() => setVista('notificaciones')}>
              🔔
              {notificacionesNoLeidas > 0 && <span>{notificacionesNoLeidas}</span>}
            </button>

            <div className="user-menu">
              <button
                className="avatar avatar-button"
                onClick={() => setMenuUsuario(!menuUsuario)}
              >
                {paciente.nombres.charAt(0)}{paciente.apellidos.charAt(0)}
              </button>

              {menuUsuario && (
                <div className="user-dropdown">
                  <button
                    onClick={() => {
                      setVista('perfil')
                      setMenuUsuario(false)
                    }}
                  >
                    Mi perfil
                  </button>

                  <button
                    className="dropdown-logout"
                    onClick={cerrarSesion}
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>

          
        </header>

        <section className="content">
          {vista === 'dashboard' && (
            <Dashboard 
              citas={citas} 
              setVista={setVista} 
              cancelarCita={cancelarCita} 
            />
          )}

          {vista === 'reservar' && (
            <ReservarCita reservarCita={reservarCita} />
          )}

          {vista === 'misCitas' && (
            <MisCitas
              citas={citas}
              cancelarCita={cancelarCita}
              reprogramarCita={reprogramarCita}
            />
          )}

          {vista === 'historial' && (
            <HistorialMedico />
          )}

          {vista === 'asistente' && (
            <AsistenteIA solicitarConfirmacion={solicitarConfirmacion} />
          )}

          {vista === 'notificaciones' && (
            <Notificaciones
              notificaciones={notificaciones}
              marcarLeida={marcarNotificacionLeida}
              marcarTodas={marcarTodasLeidas}
            />
            
          )}

          {vista === 'perfil' && (
            <PerfilPaciente 
              paciente={paciente} 
              actualizarPerfil={actualizarPerfil}
              cerrarSesion={cerrarSesion}
            />
          )}

        </section>
      </main>

      {confirmacion && (
        <div className="modal-overlay" role="presentation">
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmacion-titulo"
          >
            <div className="confirm-icon">!</div>
            <h3 id="confirmacion-titulo">{confirmacion.titulo}</h3>
            <p>{confirmacion.mensaje}</p>
            <div className="confirm-actions">
              <button
                className="modal-secondary-btn"
                onClick={() => setConfirmacion(null)}
                disabled={procesandoConfirmacion}
              >
                Volver
              </button>
              <button
                className="modal-danger-btn"
                onClick={ejecutarConfirmacion}
                disabled={procesandoConfirmacion}
              >
                {procesandoConfirmacion
                  ? confirmacion.textoProcesando
                  : confirmacion.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}

      {aviso && (
        <div className={`app-toast ${aviso.tipo}`} role="status">
          {aviso.mensaje}
        </div>
      )}
    </div>
  )
}

function Dashboard({ citas, setVista, cancelarCita }) {
  const proximasCitas = citas.filter(
    (cita) =>
      ['pendiente', 'confirmada', 'reprogramada'].includes(cita.estado) &&
      new Date(`${cita.fecha}T${cita.hora}`) > new Date(),
  )

  return (
    <>
      <h1>Bienvenida a MediLink</h1>
      <p className="subtitle">Este es tu resumen de salud y atención médica.</p>

      <div className="cards">
        <div className="card" onClick={() => setVista('reservar')}>
          <h3>Reservar cita</h3>
          <p>Agenda una visita con tu médico.</p>
        </div>

        <div className="card" onClick={() => setVista('asistente')}>
          <h3>Asistente IA</h3>
          <p>Consulta orientación básica.</p>
        </div>

        <div className="card" onClick={() => setVista('historial')}>
          <h3>Historial médico</h3>
          <p>Revisa tus registros médicos.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Próximas citas</h3>

        {proximasCitas.length === 0 && (
          <p>No tienes próximas citas registradas.</p>
        )}

        {proximasCitas.map((cita) => (
          <div className="appointment" key={cita.id}>
            <div>
              <h4>{cita.medico}</h4>
              <p>{cita.especialidad}</p>
              <span>{formatearFecha(cita.fecha)} - {formatearHora(cita.hora)}</span>
            </div>

            <div className="cita-actions">
              <span className="estado">{etiquetaEstado(cita.estado)}</span>
              <button
                className="cancel-btn"
                onClick={() => cancelarCita(cita.id)}
              >
                Cancelar cita
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function ReservarCita({ reservarCita }) {
  const [especialidad, setEspecialidad] = useState('')
  const [medico, setMedico] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [motivo, setMotivo] = useState('')
  const [catalogo, setCatalogo] = useState({
    especialidades: [],
    medicos: [],
  })
  const [horarios, setHorarios] = useState([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    api('/citas/catalogo')
      .then(setCatalogo)
      .catch((error) => alert(error.message))
  }, [])

  async function buscarHorarios(fechaSeleccionada) {
    setFecha(fechaSeleccionada)
    setHora('')
    setHorarios([])

    if (!medico || !fechaSeleccionada) return

    setCargandoHorarios(true)

    try {
      const datos = await api(
        `/citas/horarios?idMedico=${medico}&fecha=${fechaSeleccionada}`,
      )
      setHorarios(datos.horarios)
    } catch (error) {
      alert(error.message)
    } finally {
      setCargandoHorarios(false)
    }
  }

  const medicosDisponibles = catalogo.medicos.filter(
    (item) => String(item.idEspecialidad) === especialidad,
  )
  const medicoSeleccionado = catalogo.medicos.find(
    (item) => String(item.id) === medico,
  )
  const especialidadSeleccionada = catalogo.especialidades.find(
    (item) => String(item.id) === especialidad,
  )

  async function enviarFormulario(e) {
    e.preventDefault()

    if (!especialidad || !medico || !fecha || !hora || !motivo.trim()) {
      alert('Completa todos los campos para reservar la cita.')
      return
    }

    setEnviando(true)

    try {
      const datos = await reservarCita({
        idMedico: Number(medico),
        fecha,
        hora,
        motivo,
      })
      alert(datos.mensaje)
    } catch (error) {
      alert(error.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <h1>Reservar cita</h1>
      <p className="subtitle">Programa tu visita con un profesional de salud.</p>

      <div className="booking">
        <form className="form-card" onSubmit={enviarFormulario}>
          <h3>Detalles de la cita</h3>

          <label>Especialidad</label>
          <select value={especialidad} onChange={(e) => {
            setEspecialidad(e.target.value)
            setMedico('')
            setFecha('')
            setHora('')
            setHorarios([])
          }}>
            <option value="">Seleccionar especialidad</option>
            {catalogo.especialidades.map((item) => (
              <option key={item.id} value={item.id}>{item.nombre}</option>
            ))}
          </select>

          <label>Médico</label>
          <select value={medico} onChange={(e) => {
            setMedico(e.target.value)
            setFecha('')
            setHora('')
            setHorarios([])
          }}>
            <option value="">Seleccionar médico</option>
            {medicosDisponibles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre} - {item.cmp}
              </option>
            ))}
          </select>

          <label>Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => buscarHorarios(e.target.value)}
            min={fechaActual()}
          />

          <label>Hora</label>
          <select
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            disabled={!medico || !fecha || cargandoHorarios}
          >
            <option value="">
              {cargandoHorarios ? 'Consultando horarios...' : 'Seleccionar hora'}
            </option>
            {horarios.map((horaDisponible) => (
              <option key={horaDisponible} value={horaDisponible}>
                {formatearHora(horaDisponible)}
              </option>
            ))}
          </select>

          {medico && fecha && !cargandoHorarios && horarios.length === 0 && (
            <p className="form-help">No hay horarios disponibles para esta fecha.</p>
          )}

          <label>Motivo de consulta</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Describe brevemente el motivo de la cita"
            maxLength={500}
          />

          <button type="submit" disabled={enviando}>
            {enviando ? 'Reservando...' : 'Reservar cita'}
          </button>
        </form>

        <div className="summary-card">
          <h3>Resumen de reserva</h3>
          <p><strong>Especialidad:</strong> {especialidadSeleccionada?.nombre || 'No seleccionada'}</p>
          <p><strong>Médico:</strong> {medicoSeleccionado?.nombre || 'No seleccionado'}</p>
          <p><strong>Fecha:</strong> {fecha ? formatearFecha(fecha) : 'No seleccionada'}</p>
          <p><strong>Hora:</strong> {hora ? formatearHora(hora) : 'No seleccionada'}</p>
          <p><strong>Motivo:</strong> {motivo || 'No indicado'}</p>
        </div>
      </div>
    </>
  )
}

function HistorialMedico() {
  const [pestana, setPestana] = useState('consultas')
  const [historial, setHistorial] = useState({
    consultas: [],
    recetas: [],
    resultados: [],
  })
  const [cargando, setCargando] = useState(true)
  const [descargando, setDescargando] = useState(null)

  useEffect(() => {
    api('/historial')
      .then(setHistorial)
      .catch((error) => alert(error.message))
      .finally(() => setCargando(false))
  }, [])

  async function descargarDocumento(idDocumento) {
    setDescargando(idDocumento)

    try {
      await descargarArchivo(
        `/historial/documentos/${idDocumento}/descargar`,
      )
    } catch (error) {
      alert(error.message)
    } finally {
      setDescargando(null)
    }
  }

  return (
    <>
      <h1>Historial médico</h1>
      <p className="subtitle">
        Consulta tus registros médicos, recetas digitales y resultados de laboratorio.
      </p>

      {cargando && <div className="panel">Cargando historial médico...</div>}

      {!cargando && (
        <>
      <div className="tabs">
        <button
          className={pestana === 'consultas' ? 'tab active-tab' : 'tab'}
          onClick={() => setPestana('consultas')}
        >
          Consultas
        </button>

        <button
          className={pestana === 'recetas' ? 'tab active-tab' : 'tab'}
          onClick={() => setPestana('recetas')}
        >
          Recetas digitales
        </button>

        <button
          className={pestana === 'resultados' ? 'tab active-tab' : 'tab'}
          onClick={() => setPestana('resultados')}
        >
          Resultados de laboratorio
        </button>
      </div>

      {pestana === 'consultas' && (
        <div className="panel">
          <h3>Consultas médicas</h3>

          {historial.consultas.length === 0 && (
            <p>No tienes consultas médicas registradas.</p>
          )}

          {historial.consultas.map((consulta) => (
            <div className="history-item" key={consulta.id}>
              <div className="history-top">
                <div>
                  <h4>{consulta.medico}</h4>
                  <p>{consulta.especialidad}</p>
                </div>
                <span className="estado">Completada</span>
              </div>

              <span>{formatearFecha(consulta.fecha)}</span>
              <p>{consulta.descripcion}</p>
              <p><strong>Diagnóstico:</strong> {consulta.diagnostico}</p>
              {consulta.observaciones && (
                <p><strong>Observaciones:</strong> {consulta.observaciones}</p>
              )}

              {consulta.idDocumento && (
                <button
                  disabled={descargando === consulta.idDocumento}
                  onClick={() => descargarDocumento(consulta.idDocumento)}
                >
                  {descargando === consulta.idDocumento
                    ? 'Descargando...'
                    : 'Descargar informe PDF'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pestana === 'recetas' && (
        <div className="panel">
          <h3>Recetas digitales</h3>

          {historial.recetas.length === 0 && (
            <p>No tienes recetas digitales registradas.</p>
          )}

          {historial.recetas.map((receta) => (
            <div className="history-item" key={receta.id}>
              <h4>Receta de {receta.medico}</h4>
              <p><strong>Especialidad:</strong> {receta.especialidad}</p>
              <p><strong>Fecha:</strong> {formatearFecha(receta.fecha)}</p>

              {receta.medicamentos.map((medicamento) => (
                <div className="medicine-item" key={`${receta.id}-${medicamento.medicamento}`}>
                  <strong>{medicamento.medicamento} {medicamento.dosis}</strong>
                  <p>{medicamento.frecuencia} durante {medicamento.duracion}.</p>
                  {medicamento.indicacion && <p>{medicamento.indicacion}</p>}
                </div>
              ))}

              {receta.indicacionesGenerales && (
                <p><strong>Indicaciones generales:</strong> {receta.indicacionesGenerales}</p>
              )}

              {receta.idDocumento && (
                <button
                  disabled={descargando === receta.idDocumento}
                  onClick={() => descargarDocumento(receta.idDocumento)}
                >
                  {descargando === receta.idDocumento
                    ? 'Descargando...'
                    : 'Descargar receta PDF'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pestana === 'resultados' && (
        <div className="panel">
          <h3>Resultados de laboratorio</h3>

          {historial.resultados.length === 0 && (
            <p>No tienes resultados de laboratorio registrados.</p>
          )}

          {historial.resultados.map((resultado) => (
            <div className="history-item" key={resultado.id}>
              <div className="history-top">
                <div>
                  <h4>{resultado.nombreExamen}</h4>
                  <p><strong>Fecha:</strong> {formatearFecha(resultado.fecha)}</p>
                </div>
                <span className="estado">{etiquetaEstado(resultado.estado)}</span>
              </div>

              <p><strong>Resultado:</strong> {resultado.resultado}</p>

              {resultado.idDocumento && (
                <button
                  disabled={descargando === resultado.idDocumento}
                  onClick={() => descargarDocumento(resultado.idDocumento)}
                >
                  {descargando === resultado.idDocumento
                    ? 'Descargando...'
                    : 'Descargar resultado PDF'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </>
  )
}

function AsistenteIA({ solicitarConfirmacion }) {
  const [consultas, setConsultas] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const chatBodyRef = useRef(null)

  useEffect(() => {
    api('/asistente/historial')
      .then(({ consultas: historial }) => setConsultas(historial))
      .catch((error) => alert(error.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (!chatBodyRef.current) return
    chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
  }, [consultas, enviando])

  async function enviarPregunta(pregunta) {
    const preguntaLimpia = pregunta.trim()

    if (!preguntaLimpia || enviando) return

    setEnviando(true)
    setTexto('')

    try {
      const datos = await api('/asistente/consultar', {
        method: 'POST',
        body: JSON.stringify({ pregunta: preguntaLimpia }),
      })
      setConsultas((actuales) => [...actuales, datos.consulta])
    } catch (error) {
      alert(error.message)
      setTexto(preguntaLimpia)
    } finally {
      setEnviando(false)
    }
  }

  function enviarMensaje(e) {
    e.preventDefault()
    enviarPregunta(texto)
  }

  function limpiarConversacion() {
    solicitarConfirmacion({
      titulo: 'Limpiar conversación',
      mensaje:
        '¿Deseas eliminar todo el historial del asistente? Esta acción no se puede deshacer.',
      textoConfirmar: 'Sí, eliminar historial',
      textoProcesando: 'Eliminando...',
      accion: async () => {
        await api('/asistente/historial', { method: 'DELETE' })
        setConsultas([])
        alert('Historial de conversación eliminado correctamente.')
      },
    })
  }

  return (
    <>
      <h1>Asistente IA</h1>
      <p className="subtitle">Chat de orientación básica para el paciente.</p>

      <div className="chat-layout">
        <div className="chat-card">
          <div className="chat-header">
            <div>
              <strong>MediLink Assistant</strong>
              <span>En línea • Orientación general</span>
            </div>
            {consultas.length > 0 && (
              <button onClick={limpiarConversacion}>Limpiar conversación</button>
            )}
          </div>

          <div className="chat-body" ref={chatBodyRef}>
            <div className="message bot">
              Hola, soy el asistente virtual de MediLink. Puedo orientarte sobre
              citas, especialidades, recetas, resultados y uso del sistema.
            </div>

            {cargando && (
              <div className="message bot">Cargando conversación...</div>
            )}

            {consultas.map((consulta) => (
              <div className="chat-exchange" key={consulta.id}>
                <div className="message user">{consulta.pregunta}</div>
                <div
                  className={
                    consulta.intent === 'emergencia'
                      ? 'message bot urgent-message'
                      : 'message bot'
                  }
                >
                  {consulta.respuesta}
                </div>
              </div>
            ))}

            {enviando && (
              <div className="message bot">Preparando orientación...</div>
            )}
          </div>

          <form className="chat-input" onSubmit={enviarMensaje}>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe tu mensaje..."
              maxLength={500}
              disabled={enviando}
            />
            <button type="submit" disabled={enviando || !texto.trim()}>
              Enviar
            </button>
          </form>
        </div>

        <div className="summary-card">
          <h3>Preguntas rápidas</h3>
          <button onClick={() => enviarPregunta('¿Cómo reservo una cita?')}>
            ¿Cómo reservo una cita?
          </button>
          <button onClick={() => enviarPregunta('¿Qué especialidades hay?')}>
            ¿Qué especialidades hay?
          </button>
          <button onClick={() => enviarPregunta('¿Dónde veo mi receta?')}>
            ¿Dónde veo mi receta?
          </button>
          <button onClick={() => enviarPregunta('¿Cómo reprogramo una cita?')}>
            ¿Cómo reprogramo una cita?
          </button>

          <div className="important-note">
            <h4>Nota importante</h4>
            <p>Este asistente no realiza diagnósticos médicos ni reemplaza la atención de un profesional de salud.</p>
          </div>
        </div>
      </div>
    </>
  )
}

function Notificaciones({ notificaciones, marcarLeida, marcarTodas }) {
  const hayNoLeidas = notificaciones.some((notificacion) => !notificacion.leido)

  return (
    <>
      <h1>Notificaciones</h1>
      <p className="subtitle">Recordatorios y avisos del sistema.</p>

      <div className="panel">
        <div className="notifications-header">
          <h3>Avisos recientes</h3>
          {hayNoLeidas && (
            <button className="secondary-btn" onClick={marcarTodas}>
              Marcar todas como leídas
            </button>
          )}
        </div>

        {notificaciones.length === 0 && (
          <p>No tienes notificaciones.</p>
        )}

        {notificaciones.map((notificacion) => (
          <div
            className={
              notificacion.leido
                ? 'notification'
                : 'notification notification-unread'
            }
            key={notificacion.id}
          >
            <div className={`notification-icon notification-${notificacion.tipo}`}>
              {notificacion.tipo === 'cita' ? '📅' : '🔔'}
            </div>
            <div className="notification-content">
              <div className="notification-meta">
                <strong>{etiquetaEstado(notificacion.tipo)}</strong>
                <span>{formatearFechaHora(notificacion.fechaCreacion)}</span>
              </div>
              <p>{notificacion.mensaje}</p>
            </div>
            {!notificacion.leido && (
              <button
                className="notification-read"
                onClick={() => marcarLeida(notificacion.id)}
              >
                Marcar como leída
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function PerfilPaciente({ paciente, actualizarPerfil, cerrarSesion }) {
  const [formulario, setFormulario] = useState(paciente)
  const [guardando, setGuardando] = useState(false)
  const [passwords, setPasswords] = useState({
    actual: '',
    nueva: '',
    confirmar: '',
  })
  const [cambiandoPassword, setCambiandoPassword] = useState(false)

  function actualizarCampo(campo, valor) {
    setFormulario({
      ...formulario,
      [campo]: valor
    })
  }

  async function guardarPerfil(e) {
    e.preventDefault()
    setGuardando(true)

    try {
      const datos = await actualizarPerfil(formulario)
      setFormulario(datos.paciente)
      alert(datos.mensaje)
    } catch (error) {
      alert(error.message)
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarPassword(e) {
    e.preventDefault()

    if (passwords.nueva !== passwords.confirmar) {
      alert('Las nuevas contraseñas no coinciden.')
      return
    }

    setCambiandoPassword(true)

    try {
      const datos = await api('/paciente/password', {
        method: 'PUT',
        body: JSON.stringify({
          passwordActual: passwords.actual,
          nuevaPassword: passwords.nueva,
        }),
      })
      alert(datos.mensaje)
      cerrarSesion()
    } catch (error) {
      alert(error.message)
    } finally {
      setCambiandoPassword(false)
    }
  }

  return (
    <>
      <h1>Mi perfil</h1>
      <p className="subtitle">Visualiza y actualiza tus datos personales.</p>

      <div className="profile-layout">
        <form className="form-card" onSubmit={guardarPerfil}>
          <h3>Datos del paciente</h3>

          <label>Nombres</label>
          <input
            className="identity-field"
            value={formulario.nombres}
            readOnly
            aria-readonly="true"
          />

          <label>Apellidos</label>
          <input
            className="identity-field"
            value={formulario.apellidos}
            readOnly
            aria-readonly="true"
          />

          <label>DNI</label>
          <input
            className="identity-field"
            value={formulario.dni}
            readOnly
            aria-readonly="true"
          />

          <label>Correo electrónico</label>
          <input
            type="email"
            value={formulario.correo}
            onChange={(e) => actualizarCampo('correo', e.target.value)}
          />

          <label>Teléfono</label>
          <input
            value={formulario.telefono}
            onChange={(e) => actualizarCampo('telefono', e.target.value)}
          />

          <label>Fecha de nacimiento</label>
          <input
            className="identity-field"
            type="date"
            value={formulario.fechaNacimiento}
            readOnly
            aria-readonly="true"
          />

          <label>Dirección</label>
          <input
            value={formulario.direccion}
            onChange={(e) => actualizarCampo('direccion', e.target.value)}
          />

          <button type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>

        <div className="summary-card">
          <h3>Resumen del paciente</h3>
          <div className="profile-avatar">
            {formulario.nombres.charAt(0)}{formulario.apellidos.charAt(0)}
          </div>

          <p><strong>Nombre:</strong> {formulario.nombres} {formulario.apellidos}</p>
          <p><strong>DNI:</strong> {formulario.dni}</p>
          <p><strong>Correo:</strong> {formulario.correo}</p>
          <p><strong>Teléfono:</strong> {formulario.telefono}</p>
          <p><strong>Dirección:</strong> {formulario.direccion}</p>
        </div>
      </div>

      <form className="form-card security-card" onSubmit={cambiarPassword}>
        <h3>Seguridad de la cuenta</h3>
        <p className="security-hint">
          Usa al menos 8 caracteres, una mayúscula, una minúscula y un número.
        </p>

        <label>Contraseña actual</label>
        <input
          type="password"
          value={passwords.actual}
          onChange={(e) =>
            setPasswords({ ...passwords, actual: e.target.value })
          }
        />

        <label>Nueva contraseña</label>
        <input
          type="password"
          value={passwords.nueva}
          onChange={(e) =>
            setPasswords({ ...passwords, nueva: e.target.value })
          }
        />

        <label>Confirmar nueva contraseña</label>
        <input
          type="password"
          value={passwords.confirmar}
          onChange={(e) =>
            setPasswords({ ...passwords, confirmar: e.target.value })
          }
        />

        <button type="submit" disabled={cambiandoPassword}>
          {cambiandoPassword ? 'Actualizando...' : 'Cambiar contraseña'}
        </button>
      </form>
    </>
  )
}

function LoginRegistro({ iniciarSesion, registrarPaciente }) {
  const tokenInicial = new URLSearchParams(window.location.search).get('resetToken')
  const [modo, setModo] = useState(tokenInicial ? 'restablecer' : 'login')
  const [enviando, setEnviando] = useState(false)
  const [enlaceDesarrollo, setEnlaceDesarrollo] = useState('')

  const [formulario, setFormulario] = useState({
    nombres: '',
    apellidos: '',
    dni: '',
    correo: '',
    telefono: '',
    fechaNacimiento: '',
    direccion: '',
    password: '',
    confirmarPassword: '',
  })

  function actualizarCampo(campo, valor) {
    setFormulario({
      ...formulario,
      [campo]: valor
    })
  }

  async function enviarLogin(e) {
    e.preventDefault()

    if (!formulario.correo || !formulario.password) {
      alert('Ingresa tu correo y contraseña.')
      return
    }

    setEnviando(true)
    await iniciarSesion(formulario.correo, formulario.password)
    setEnviando(false)
  }

  async function enviarRegistro(e) {
    e.preventDefault()

    if (
      !formulario.nombres ||
      !formulario.apellidos ||
      !formulario.dni ||
      !formulario.correo ||
      !formulario.telefono ||
      !formulario.password
    ) {
      alert('Completa los campos obligatorios.')
      return
    }

    setEnviando(true)
    await registrarPaciente(formulario)
    setEnviando(false)
  }

  async function solicitarRecuperacion(e) {
    e.preventDefault()
    setEnviando(true)
    setEnlaceDesarrollo('')

    try {
      const datos = await api('/auth/solicitar-recuperacion', {
        method: 'POST',
        body: JSON.stringify({ correo: formulario.correo }),
      })
      alert(datos.mensaje)
      setEnlaceDesarrollo(datos.enlaceDesarrollo || '')
    } catch (error) {
      alert(error.message)
    } finally {
      setEnviando(false)
    }
  }

  async function restablecerPassword(e) {
    e.preventDefault()

    if (formulario.password !== formulario.confirmarPassword) {
      alert('Las contraseñas no coinciden.')
      return
    }

    setEnviando(true)

    try {
      const datos = await api('/auth/restablecer-password', {
        method: 'POST',
        body: JSON.stringify({
          token: tokenInicial,
          nuevaPassword: formulario.password,
        }),
      })
      alert(datos.mensaje)
      window.history.replaceState({}, '', window.location.pathname)
      setFormulario({ ...formulario, password: '', confirmarPassword: '' })
      setModo('login')
    } catch (error) {
      alert(error.message)
    } finally {
      setEnviando(false)
    }
  }

  const titulos = {
    login: 'Inicio de sesión',
    registro: 'Registro de paciente',
    recuperar: 'Recuperar contraseña',
    restablecer: 'Nueva contraseña',
  }

  const descripciones = {
    login: 'Ingresa a tu perfil paciente.',
    registro: 'Crea tu cuenta para acceder al sistema.',
    recuperar: 'Ingresa el correo asociado a tu cuenta.',
    restablecer: 'Crea una contraseña nueva para tu cuenta.',
  }

  const enviarFormulario =
    modo === 'login'
      ? enviarLogin
      : modo === 'registro'
        ? enviarRegistro
        : modo === 'recuperar'
          ? solicitarRecuperacion
          : restablecerPassword

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">〽 MediLink</div>

        <h1>{titulos[modo]}</h1>
        <p>{descripciones[modo]}</p>

        <form onSubmit={enviarFormulario}>
          {modo === 'registro' && (
            <>
              <label>Nombres</label>
              <input
                value={formulario.nombres}
                onChange={(e) => actualizarCampo('nombres', e.target.value)}
              />

              <label>Apellidos</label>
              <input
                value={formulario.apellidos}
                onChange={(e) => actualizarCampo('apellidos', e.target.value)}
              />

              <label>DNI</label>
              <input
                value={formulario.dni}
                onChange={(e) => actualizarCampo('dni', e.target.value)}
              />

              <label>Teléfono</label>
              <input
                value={formulario.telefono}
                onChange={(e) => actualizarCampo('telefono', e.target.value)}
              />

              <label>Fecha de nacimiento</label>
              <input
                type="date"
                value={formulario.fechaNacimiento}
                onChange={(e) => actualizarCampo('fechaNacimiento', e.target.value)}
              />

              <label>Dirección</label>
              <input
                value={formulario.direccion}
                onChange={(e) => actualizarCampo('direccion', e.target.value)}
              />
            </>
          )}

          {modo !== 'restablecer' && (
            <>
              <label>Correo electrónico</label>
              <input
                type="email"
                value={formulario.correo}
                onChange={(e) => actualizarCampo('correo', e.target.value)}
                placeholder="paciente@medilink.pe"
              />
            </>
          )}

          {modo !== 'recuperar' && (
            <>
              <label>
                {modo === 'restablecer' ? 'Nueva contraseña' : 'Contraseña'}
              </label>
              <input
                type="password"
                value={formulario.password}
                onChange={(e) => actualizarCampo('password', e.target.value)}
                placeholder="Ejemplo2026"
              />
            </>
          )}

          {modo === 'restablecer' && (
            <>
              <label>Confirmar nueva contraseña</label>
              <input
                type="password"
                value={formulario.confirmarPassword}
                onChange={(e) =>
                  actualizarCampo('confirmarPassword', e.target.value)
                }
              />
            </>
          )}

          {(modo === 'registro' || modo === 'restablecer') && (
            <p className="password-help">
              Mínimo 8 caracteres, mayúscula, minúscula y número.
            </p>
          )}

          <button type="submit" disabled={enviando}>
            {enviando
              ? 'Procesando...'
              : modo === 'login'
                ? 'Ingresar'
                : modo === 'registro'
                  ? 'Registrar paciente'
                  : modo === 'recuperar'
                    ? 'Generar enlace'
                    : 'Restablecer contraseña'}
          </button>
        </form>

        {enlaceDesarrollo && (
          <a className="recovery-link" href={enlaceDesarrollo}>
            Abrir enlace de recuperación
          </a>
        )}

        {modo === 'login' && (
          <>
            <button
              className="change-mode"
              onClick={() => setModo('recuperar')}
            >
              Olvidé mi contraseña
            </button>
            <button
              className="change-mode"
              onClick={() => setModo('registro')}
            >
              Crear una cuenta nueva
            </button>
          </>
        )}

        {modo !== 'login' && (
          <button className="change-mode" onClick={() => setModo('login')}>
            Volver al inicio de sesión
          </button>
        )}

      </div>
    </div>
  )
}

function MisCitas({ citas, cancelarCita, reprogramarCita }) {
  const [citaEditando, setCitaEditando] = useState(null)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora] = useState('')
  const [horarios, setHorarios] = useState([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [guardando, setGuardando] = useState(false)

  function abrirReprogramacion(cita) {
    setCitaEditando(cita.id)
    setNuevaFecha('')
    setNuevaHora('')
    setHorarios([])
  }

  async function buscarHorarios(cita, fecha) {
    setNuevaFecha(fecha)
    setNuevaHora('')

    if (!fecha) {
      setHorarios([])
      return
    }

    setCargandoHorarios(true)

    try {
      const datos = await api(
        `/citas/horarios?idMedico=${cita.idMedico}&fecha=${fecha}`,
      )
      setHorarios(datos.horarios)
    } catch (error) {
      alert(error.message)
    } finally {
      setCargandoHorarios(false)
    }
  }

  async function guardarReprogramacion(id) {
    if (!nuevaFecha || !nuevaHora) {
      alert('Selecciona una nueva fecha y hora.')
      return
    }

    setGuardando(true)

    try {
      const datos = await reprogramarCita(id, nuevaFecha, nuevaHora)
      alert(datos.mensaje)
      setCitaEditando(null)
    } catch (error) {
      alert(error.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <h1>Mis citas</h1>
      <p className="subtitle">
        Revisa tus citas médicas, cancela o reprograma según disponibilidad.
      </p>

      <div className="panel">
        <h3>Citas registradas</h3>

        {citas.length === 0 && (
          <p>No tienes citas registradas.</p>
        )}

        {citas.map((cita) => (
          <div className="appointment cita-completa" key={cita.id}>
            <div className="cita-info">
              <h4>{cita.medico}</h4>
              <p>{cita.especialidad}</p>
              <span>{formatearFecha(cita.fecha)} - {formatearHora(cita.hora)}</span>
              <p className="cita-motivo"><strong>Motivo:</strong> {cita.motivo}</p>
            </div>

            <div className="cita-actions">
              <span className={cita.estado === 'cancelada' ? 'estado cancelada' : 'estado'}>
                {etiquetaEstado(cita.estado)}
              </span>

              {['pendiente', 'confirmada', 'reprogramada'].includes(cita.estado) && (
                <>
                  <button
                    className="edit-btn"
                    onClick={() => abrirReprogramacion(cita)}
                  >
                    Reprogramar
                  </button>

                  <button
                    className="cancel-btn"
                    onClick={() => cancelarCita(cita.id)}
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>

            {citaEditando === cita.id && (
              <div className="reprogramar-box">
                <label>Nueva fecha</label>
                <input
                  type="date"
                  value={nuevaFecha}
                  min={fechaActual()}
                  onChange={(e) => buscarHorarios(cita, e.target.value)}
                />

                <label>Nueva hora</label>
                <select
                  value={nuevaHora}
                  onChange={(e) => setNuevaHora(e.target.value)}
                >
                  <option value="">
                    {cargandoHorarios
                      ? 'Consultando horarios...'
                      : 'Seleccionar hora'}
                  </option>
                  {horarios.map((horaDisponible) => (
                    <option key={horaDisponible} value={horaDisponible}>
                      {formatearHora(horaDisponible)}
                    </option>
                  ))}
                </select>

                <button
                  disabled={guardando}
                  onClick={() => guardarReprogramacion(cita.id)}
                >
                  {guardando ? 'Guardando...' : 'Guardar cambio'}
                </button>

                <button
                  className="secondary-btn"
                  onClick={() => setCitaEditando(null)}
                >
                  Cancelar edición
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

export default App
