import { useEffect, useState } from 'react'
import './App.css'

function obtenerDatos(clave, valorInicial) {
  const datosGuardados = localStorage.getItem(clave)

  if (datosGuardados) {
    return JSON.parse(datosGuardados)
  }

  return valorInicial
}

function App() {
  const [vista, setVista] = useState('dashboard')
  const [menuUsuario, setMenuUsuario] = useState(false)
  const [citas, setCitas] = useState(() =>
    obtenerDatos('citasMedilink', [
      {
        id: 1,
        medico: 'Dr. Michael Chen',
        especialidad: 'Cardiología',
        fecha: '28 mayo 2026',
        hora: '10:00 AM',
        estado: 'Confirmada'
      },
      {
        id: 2,
        medico: 'Dra. Emily Roberts',
        especialidad: 'Medicina General',
        fecha: '02 junio 2026',
        hora: '2:30 PM',
        estado: 'Confirmada'
      }
    ])
  )

  const [notificaciones, setNotificaciones] = useState(() =>
    obtenerDatos('notificacionesMedilink', [
      'Tienes una cita confirmada con Cardiología el 28 de mayo.',
      'Tu receta digital está disponible en el historial médico.',
      'Recuerda llegar 10 minutos antes de tu consulta.'
    ])
  )

  const [paciente, setPaciente] = useState(() =>
    obtenerDatos('pacienteMedilink', {
      nombres: 'Yashira',
      apellidos: 'Rojas',
      dni: '76543210',
      correo: 'paciente@medilink.pe',
      telefono: '987654321',
      fechaNacimiento: '2004-05-15',
      direccion: 'Santa Anita, Lima'
    })
  )

  const [sesionActiva, setSesionActiva] = useState(() =>
    obtenerDatos('sesionMedilink', false)
  )

  useEffect(() => {
    localStorage.setItem('citasMedilink', JSON.stringify(citas))
  }, [citas])

  useEffect(() => {
    localStorage.setItem('notificacionesMedilink', JSON.stringify(notificaciones))
  }, [notificaciones])

  useEffect(() => {
    localStorage.setItem('pacienteMedilink', JSON.stringify(paciente))
  }, [paciente])

  useEffect(() => {
    localStorage.setItem('sesionMedilink', JSON.stringify(sesionActiva))
  }, [sesionActiva])

  

  function reservarCita(nuevaCita) {
    setCitas([...citas, nuevaCita])
    setNotificaciones([
      `Nueva cita reservada con ${nuevaCita.medico} para el ${nuevaCita.fecha}.`,
      ...notificaciones
    ])
    setVista('dashboard')
  }

  function cancelarCita(id) {
    const nuevasCitas = citas.map((cita) =>
      cita.id === id ? { ...cita, estado: 'Cancelada' } : cita
    )
    setCitas(nuevasCitas)
    setNotificaciones(['Una cita fue cancelada correctamente.', ...notificaciones])
  }

  function reprogramarCita(id, nuevaFecha, nuevaHora) {
  if (!nuevaFecha || !nuevaHora) {
    alert('Selecciona una nueva fecha y hora.')
    return
  }

  const citasActualizadas = citas.map((cita) =>
    cita.id === id
      ? { ...cita, fecha: nuevaFecha, hora: nuevaHora, estado: 'Reprogramada' }
      : cita
  )

  setCitas(citasActualizadas)

  setNotificaciones([
    'Una cita fue reprogramada correctamente.',
    ...notificaciones
  ])

  alert('Cita reprogramada correctamente.')
}

  function iniciarSesion(correo, password) {
    if (correo === paciente.correo && password === '123456') {
      setSesionActiva(true)
    } else {
      alert('Correo o contraseña incorrectos.')
    }
  }

  function registrarPaciente(nuevoPaciente) {
    setPaciente(nuevoPaciente)
    setSesionActiva(true)
    setNotificaciones([
      'Cuenta de paciente creada correctamente.',
      ...notificaciones
    ])
  }

  function cerrarSesion() {
    setSesionActiva(false)
  }

  if (!sesionActiva) {
    return (
      <LoginRegistro
        iniciarSesion={iniciarSesion}
        registrarPaciente={registrarPaciente}
      />
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
              {notificaciones.length > 0 && <span>{notificaciones.length}</span>}
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
            <AsistenteIA />
          )}

          {vista === 'notificaciones' && (
            <Notificaciones notificaciones={notificaciones} />
            
          )}

          {vista === 'perfil' && (
            <PerfilPaciente 
              paciente={paciente} 
              setPaciente={setPaciente} 
              setNotificaciones={setNotificaciones}
              notificaciones={notificaciones}
            />
          )}

        </section>
      </main>
    </div>
  )
}

function Dashboard({ citas, setVista, cancelarCita }) {
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

        {citas.map((cita) => (
          <div className="appointment" key={cita.id}>
            <div>
              <h4>{cita.medico}</h4>
              <p>{cita.especialidad}</p>
              <span>{cita.fecha} - {cita.hora}</span>
            </div>

            <span className={cita.estado === 'Cancelada' ? 'estado cancelada' : 'estado'}>
              {cita.estado}
              {cita.estado !== 'Cancelada' && (
                <button 
                  className="cancel-btn" 
                  onClick={() => cancelarCita(cita.id)}
                >
                  Cancelar cita
                </button>
              )}
            </span>
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

  const medicos = {
    'Medicina General': ['Dra. Emily Roberts'],
    'Cardiología': ['Dr. Michael Chen'],
    'Dermatología': ['Dra. Valeria Torres'],
    'Pediatría': ['Dr. Luis Herrera']
  }

  function enviarFormulario(e) {
    e.preventDefault()

    if (!especialidad || !medico || !fecha || !hora) {
      alert('Completa todos los campos para reservar la cita.')
      return
    }

    const nuevaCita = {
      id: Date.now(),
      medico,
      especialidad,
      fecha,
      hora,
      estado: 'Confirmada'
    }

    reservarCita(nuevaCita)
    alert('Cita reservada correctamente.')
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
          }}>
            <option value="">Seleccionar especialidad</option>
            <option value="Medicina General">Medicina General</option>
            <option value="Cardiología">Cardiología</option>
            <option value="Dermatología">Dermatología</option>
            <option value="Pediatría">Pediatría</option>
          </select>

          <label>Médico</label>
          <select value={medico} onChange={(e) => setMedico(e.target.value)}>
            <option value="">Seleccionar médico</option>
            {especialidad &&
              medicos[especialidad].map((nombre) => (
                <option key={nombre} value={nombre}>{nombre}</option>
              ))
            }
          </select>

          <label>Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />

          <label>Hora</label>
          <select value={hora} onChange={(e) => setHora(e.target.value)}>
            <option value="">Seleccionar hora</option>
            <option value="08:00 AM">08:00 AM</option>
            <option value="10:00 AM">10:00 AM</option>
            <option value="2:30 PM">2:30 PM</option>
            <option value="4:00 PM">4:00 PM</option>
          </select>

          <button type="submit">Reservar cita</button>
        </form>

        <div className="summary-card">
          <h3>Resumen de reserva</h3>
          <p><strong>Especialidad:</strong> {especialidad || 'No seleccionada'}</p>
          <p><strong>Médico:</strong> {medico || 'No seleccionado'}</p>
          <p><strong>Fecha:</strong> {fecha || 'No seleccionada'}</p>
          <p><strong>Hora:</strong> {hora || 'No seleccionada'}</p>
        </div>
      </div>
    </>
  )
}

function HistorialMedico() {
  const [pestana, setPestana] = useState('consultas')

  function descargarReporte(nombreReporte) {
    const contenido = `
MEDILINK - REPORTE MÉDICO

Paciente: Yashira Rojas
Reporte: ${nombreReporte}
Fecha de descarga: ${new Date().toLocaleDateString()}

Este documento corresponde a una constancia generada por el sistema MediLink.
La información mostrada pertenece al historial médico digital del paciente.
`

    const archivo = new Blob([contenido], { type: 'text/plain' })
    const url = URL.createObjectURL(archivo)

    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `${nombreReporte}.txt`
    enlace.click()

    URL.revokeObjectURL(url)
  }

  return (
    <>
      <h1>Historial médico</h1>
      <p className="subtitle">
        Consulta tus registros médicos, recetas digitales y resultados de laboratorio.
      </p>

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

          <div className="history-item">
            <div className="history-top">
              <div>
                <h4>Dra. Emily Roberts</h4>
                <p>Medicina General</p>
              </div>
              <span className="estado">Completado</span>
            </div>

            <span>15 mayo 2026</span>
            <p>Chequeo anual. Signos vitales normales.</p>
            <p><strong>Diagnóstico:</strong> Paciente estable, sin hallazgos de alarma.</p>

            <button onClick={() => descargarReporte('reporte-consulta-medicina-general')}>
              Descargar reporte
            </button>
          </div>

          <div className="history-item">
            <div className="history-top">
              <div>
                <h4>Dr. Michael Chen</h4>
                <p>Cardiología</p>
              </div>
              <span className="estado">Completado</span>
            </div>

            <span>20 abril 2026</span>
            <p>Evaluación cardiológica preventiva.</p>
            <p><strong>Diagnóstico:</strong> Frecuencia cardiaca dentro de rangos normales.</p>

            <button onClick={() => descargarReporte('reporte-consulta-cardiologia')}>
              Descargar reporte
            </button>
          </div>
        </div>
      )}

      {pestana === 'recetas' && (
        <div className="panel">
          <h3>Recetas digitales</h3>

          <div className="history-item">
            <h4>Paracetamol 500 mg</h4>
            <p><strong>Indicación:</strong> Tomar solo en caso de dolor o fiebre.</p>
            <p><strong>Médico:</strong> Dra. Emily Roberts</p>
            <p><strong>Fecha:</strong> 15 mayo 2026</p>

            <button onClick={() => descargarReporte('receta-paracetamol')}>
              Descargar receta
            </button>
          </div>

          <div className="history-item">
            <h4>Control preventivo</h4>
            <p><strong>Indicación:</strong> Mantener hábitos saludables y asistir a control periódico.</p>
            <p><strong>Médico:</strong> Dr. Michael Chen</p>
            <p><strong>Fecha:</strong> 20 abril 2026</p>

            <button onClick={() => descargarReporte('receta-control-preventivo')}>
              Descargar receta
            </button>
          </div>
        </div>
      )}

      {pestana === 'resultados' && (
        <div className="panel">
          <h3>Resultados de laboratorio</h3>

          <div className="history-item">
            <h4>Hemograma completo</h4>
            <p><strong>Resultado:</strong> Valores dentro del rango normal.</p>
            <p><strong>Fecha:</strong> 15 mayo 2026</p>
            <span className="estado">Disponible</span>

            <br />

            <button onClick={() => descargarReporte('resultado-hemograma-completo')}>
              Descargar resultado
            </button>
          </div>

          <div className="history-item">
            <h4>Perfil lipídico</h4>
            <p><strong>Resultado:</strong> Colesterol total en rango aceptable.</p>
            <p><strong>Fecha:</strong> 20 abril 2026</p>
            <span className="estado">Disponible</span>

            <br />

            <button onClick={() => descargarReporte('resultado-perfil-lipidico')}>
              Descargar resultado
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function AsistenteIA() {
  const [mensajes, setMensajes] = useState([
    {
      tipo: 'bot',
      texto: 'Hola, soy el asistente virtual de MediLink. Puedo orientarte sobre citas, especialidades, recetas y uso del sistema.'
    }
  ])

  const [texto, setTexto] = useState('')

  function responder(pregunta) {
    const preguntaMinuscula = pregunta.toLowerCase()

    if (preguntaMinuscula.includes('cita')) {
      return 'Para reservar una cita, ingresa a la sección Reservar cita, selecciona especialidad, médico, fecha y hora.'
    }

    if (preguntaMinuscula.includes('receta')) {
      return 'Puedes revisar tus recetas digitales en la sección Historial médico. Recuerda que toda indicación médica debe ser validada por un profesional.'
    }

    if (preguntaMinuscula.includes('especialidad')) {
      return 'Las especialidades disponibles son Medicina General, Cardiología, Dermatología y Pediatría.'
    }

    if (preguntaMinuscula.includes('emergencia') || preguntaMinuscula.includes('dolor fuerte')) {
      return 'Si tienes una emergencia médica, acude al centro de salud más cercano o comunícate con servicios de emergencia. Este asistente no realiza diagnósticos.'
    }

    return 'Puedo darte orientación general sobre el uso del sistema. Si tu consulta es clínica, debes reservar una cita con un médico.'
  }

  function enviarMensaje(e) {
    e.preventDefault()

    if (!texto.trim()) return

    const respuesta = responder(texto)

    setMensajes([
      ...mensajes,
      { tipo: 'usuario', texto },
      { tipo: 'bot', texto: respuesta }
    ])

    setTexto('')
  }

  return (
    <>
      <h1>Asistente IA</h1>
      <p className="subtitle">Chat de orientación básica para el paciente.</p>

      <div className="chat-layout">
        <div className="chat-card">
          <div className="chat-header">
            <strong>MediLink Assistant</strong>
            <span>Online • Orientación general</span>
          </div>

          <div className="chat-body">
            {mensajes.map((mensaje, index) => (
              <div
                key={index}
                className={mensaje.tipo === 'bot' ? 'message bot' : 'message user'}
              >
                {mensaje.texto}
              </div>
            ))}
          </div>

          <form className="chat-input" onSubmit={enviarMensaje}>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe tu mensaje..."
            />
            <button type="submit">➤</button>
          </form>
        </div>

        <div className="summary-card">
          <h3>Preguntas rápidas</h3>
          <button onClick={() => setTexto('¿Cómo reservo una cita?')}>¿Cómo reservo una cita?</button>
          <button onClick={() => setTexto('¿Qué especialidades hay?')}>¿Qué especialidades hay?</button>
          <button onClick={() => setTexto('¿Dónde veo mi receta?')}>¿Dónde veo mi receta?</button>

          <div className="important-note">
            <h4>Nota importante</h4>
            <p>Este asistente no realiza diagnósticos médicos ni reemplaza la atención de un profesional de salud.</p>
          </div>
        </div>
      </div>
    </>
  )
}

function Notificaciones({ notificaciones }) {
  return (
    <>
      <h1>Notificaciones</h1>
      <p className="subtitle">Recordatorios y avisos del sistema.</p>

      <div className="panel">
        {notificaciones.map((notificacion, index) => (
          <div className="notification" key={index}>
            <div className="notification-icon">🔔</div>
            <p>{notificacion}</p>
          </div>
        ))}
      </div>
    </>
  )
}

function PerfilPaciente({ paciente, setPaciente, setNotificaciones, notificaciones }) {
  const [formulario, setFormulario] = useState(paciente)

  function actualizarCampo(campo, valor) {
    setFormulario({
      ...formulario,
      [campo]: valor
    })
  }

  function guardarPerfil(e) {
    e.preventDefault()

    setPaciente(formulario)

    setNotificaciones([
      'Tus datos personales fueron actualizados correctamente.',
      ...notificaciones
    ])

    alert('Perfil actualizado correctamente.')
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
            type="date"
            value={formulario.fechaNacimiento}
            onChange={(e) => actualizarCampo('fechaNacimiento', e.target.value)}
          />

          <label>Dirección</label>
          <input
            value={formulario.direccion}
            onChange={(e) => actualizarCampo('direccion', e.target.value)}
          />

          <button type="submit">Guardar cambios</button>
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
    </>
  )
}

function LoginRegistro({ iniciarSesion, registrarPaciente }) {
  const [modo, setModo] = useState('login')

  const [formulario, setFormulario] = useState({
    nombres: '',
    apellidos: '',
    dni: '',
    correo: '',
    telefono: '',
    fechaNacimiento: '',
    direccion: '',
    password: ''
  })

  function actualizarCampo(campo, valor) {
    setFormulario({
      ...formulario,
      [campo]: valor
    })
  }

  function enviarLogin(e) {
    e.preventDefault()

    if (!formulario.correo || !formulario.password) {
      alert('Ingresa tu correo y contraseña.')
      return
    }

    iniciarSesion(formulario.correo, formulario.password)
  }

  function enviarRegistro(e) {
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

    registrarPaciente(formulario)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">〽 MediLink</div>

        <h1>{modo === 'login' ? 'Inicio de sesión' : 'Registro de paciente'}</h1>

        <p>
          {modo === 'login'
            ? 'Ingresa a tu perfil paciente.'
            : 'Crea tu cuenta para acceder al sistema.'}
        </p>

        <form onSubmit={modo === 'login' ? enviarLogin : enviarRegistro}>
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

          <label>Correo electrónico</label>
          <input
            type="email"
            value={formulario.correo}
            onChange={(e) => actualizarCampo('correo', e.target.value)}
            placeholder="paciente@medilink.pe"
          />

          <label>Contraseña</label>
          <input
            type="password"
            value={formulario.password}
            onChange={(e) => actualizarCampo('password', e.target.value)}
            placeholder="123456"
          />

          <button type="submit">
            {modo === 'login' ? 'Ingresar' : 'Registrar paciente'}
          </button>
        </form>

        <button
          className="change-mode"
          onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
        >
          {modo === 'login'
            ? 'Crear una cuenta nueva'
            : 'Ya tengo una cuenta'}
        </button>

        {modo === 'login' && (
          <div className="demo-user">
            <strong>Usuario de prueba</strong>
            <span>Correo: paciente@medilink.pe</span>
            <span>Contraseña: 123456</span>
          </div>
        )}
      </div>
    </div>
  )
}

function MisCitas({ citas, cancelarCita, reprogramarCita }) {
  const [citaEditando, setCitaEditando] = useState(null)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora] = useState('')

  function abrirReprogramacion(cita) {
    setCitaEditando(cita.id)
    setNuevaFecha('')
    setNuevaHora('')
  }

  function guardarReprogramacion(id) {
    reprogramarCita(id, nuevaFecha, nuevaHora)
    setCitaEditando(null)
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
            <div>
              <h4>{cita.medico}</h4>
              <p>{cita.especialidad}</p>
              <span>{cita.fecha} - {cita.hora}</span>
            </div>

            <div className="cita-actions">
              <span className={cita.estado === 'Cancelada' ? 'estado cancelada' : 'estado'}>
                {cita.estado}
              </span>

              {cita.estado !== 'Cancelada' && (
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
                  onChange={(e) => setNuevaFecha(e.target.value)}
                />

                <label>Nueva hora</label>
                <select
                  value={nuevaHora}
                  onChange={(e) => setNuevaHora(e.target.value)}
                >
                  <option value="">Seleccionar hora</option>
                  <option value="08:00 AM">08:00 AM</option>
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="2:30 PM">2:30 PM</option>
                  <option value="4:00 PM">4:00 PM</option>
                </select>

                <button onClick={() => guardarReprogramacion(cita.id)}>
                  Guardar cambio
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