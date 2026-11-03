import { useEffect, useState } from 'react'
import CambiarPassword from './CambiarPassword.jsx'
import HistorialMedico from './HistorialMedico.jsx'
import { api } from './services/api.js'
import {
  claseEstado,
  etiquetaEstado,
  fechaActual,
  formatearFecha,
  formatearHora,
  lunesDeLaSemana,
  sumarDias,
} from './utils/formato.js'

const ESTADOS_ACTIVOS = ['pendiente', 'confirmada', 'reprogramada']
const MAX_TAMANO_PDF = 10 * 1024 * 1024
const MEDICAMENTO_VACIO = {
  medicamento: '',
  dosis: '',
  frecuencia: '',
  duracion: '',
  indicacion: '',
}

function PanelMedico({ medico, cerrarSesion, solicitarConfirmacion }) {
  const [vista, setVista] = useState('agenda')
  const [menuUsuario, setMenuUsuario] = useState(false)
  const [citaEnConsulta, setCitaEnConsulta] = useState(null)
  const [pacienteVisto, setPacienteVisto] = useState(null)

  function irA(nuevaVista) {
    setVista(nuevaVista)
    setCitaEnConsulta(null)
    setPacienteVisto(null)
  }

  function verHistorial(idPaciente, nombre) {
    setCitaEnConsulta(null)
    setPacienteVisto({ id: idPaciente, nombre })
    setVista('pacientes')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo"><i className="logo-mark">M</i>MediLink</div>

        <button
          className={vista === 'agenda' ? 'menu active' : 'menu'}
          onClick={() => irA('agenda')}
        >
          Agenda
        </button>

        <button
          className={vista === 'pacientes' ? 'menu active' : 'menu'}
          onClick={() => irA('pacientes')}
        >
          Mis pacientes
        </button>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <h2>{medico.nombres} {medico.apellidos}</h2>
            <p>{medico.especialidad} · {medico.cmp}</p>
          </div>

          <div className="header-actions">
            <div className="user-menu">
              <button
                className="avatar avatar-button"
                onClick={() => setMenuUsuario(!menuUsuario)}
              >
                {medico.nombres.charAt(0)}{medico.apellidos.charAt(0)}
              </button>

              {menuUsuario && (
                <div className="user-dropdown">
                  <button
                    onClick={() => {
                      irA('password')
                      setMenuUsuario(false)
                    }}
                  >
                    Cambiar contraseña
                  </button>

                  <button className="dropdown-logout" onClick={cerrarSesion}>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="content">
          {vista === 'agenda' && !citaEnConsulta && (
            <AgendaMedico
              solicitarConfirmacion={solicitarConfirmacion}
              registrarConsulta={setCitaEnConsulta}
              verHistorial={verHistorial}
            />
          )}

          {vista === 'agenda' && citaEnConsulta && (
            <RegistrarConsulta
              cita={citaEnConsulta}
              volver={() => setCitaEnConsulta(null)}
            />
          )}

          {vista === 'password' && (
            <CambiarPassword ruta="/medico/password" cerrarSesion={cerrarSesion} />
          )}

          {vista === 'pacientes' && !pacienteVisto && (
            <MisPacientes verHistorial={verHistorial} />
          )}

          {vista === 'pacientes' && pacienteVisto && (
            <>
              <button
                className="edit-btn volver-btn"
                onClick={() => setPacienteVisto(null)}
              >
                ← Volver a mis pacientes
              </button>

              <HistorialMedico
                key={pacienteVisto.id}
                rutaHistorial={`/medico/pacientes/${pacienteVisto.id}/historial`}
                rutaDocumentos="/medico/documentos"
                titulo={`Historial de ${pacienteVisto.nombre}`}
                subtitulo="Consultas, recetas digitales y resultados de laboratorio del paciente."
                renderAcciones={(historial, recargar) => (
                  <SubirDocumento
                    idPaciente={pacienteVisto.id}
                    historial={historial}
                    recargar={recargar}
                  />
                )}
              />
            </>
          )}
        </section>
      </main>
    </div>
  )
}

function AgendaMedico({ solicitarConfirmacion, registrarConsulta, verHistorial }) {
  const [modo, setModo] = useState('semana')
  const [fechaBase, setFechaBase] = useState(fechaActual())
  const [recarga, setRecarga] = useState(0)
  const [resultado, setResultado] = useState({ clave: null, citas: [] })
  const [procesando, setProcesando] = useState(null)

  const desde = modo === 'semana' ? lunesDeLaSemana(fechaBase) : fechaBase
  const hasta = modo === 'semana' ? sumarDias(desde, 6) : fechaBase
  const clave = `${desde}|${hasta}|${recarga}`
  const cargando = resultado.clave !== clave
  const hoy = fechaActual()

  useEffect(() => {
    let vigente = true

    api(`/medico/citas?desde=${desde}&hasta=${hasta}`)
      .then((datos) => {
        if (vigente) setResultado({ clave, citas: datos.citas })
      })
      .catch((error) => {
        if (vigente) setResultado({ clave, citas: [] })
        alert(error.message)
      })

    return () => {
      vigente = false
    }
  }, [clave, desde, hasta])

  function recargar() {
    setRecarga((actual) => actual + 1)
  }

  function mover(direccion) {
    setFechaBase(sumarDias(fechaBase, direccion * (modo === 'semana' ? 7 : 1)))
  }

  async function aprobar(cita) {
    setProcesando(cita.id)

    try {
      const datos = await api(`/medico/citas/${cita.id}/aprobar`, {
        method: 'PATCH',
      })
      alert(datos.mensaje)
      recargar()
    } catch (error) {
      alert(error.message)
    } finally {
      setProcesando(null)
    }
  }

  function cancelar(cita) {
    solicitarConfirmacion({
      titulo: 'Cancelar cita',
      mensaje: `¿Confirmas que deseas cancelar la cita de ${cita.paciente}? Se notificará al paciente.`,
      textoConfirmar: 'Sí, cancelar cita',
      textoProcesando: 'Cancelando...',
      accion: async () => {
        const datos = await api(`/medico/citas/${cita.id}/cancelar`, {
          method: 'PATCH',
          body: JSON.stringify({ motivo: 'Cancelada por el médico' }),
        })
        alert(datos.mensaje)
        recargar()
      },
    })
  }

  const fechas = [...new Set(resultado.citas.map((cita) => cita.fecha))]

  return (
    <>
      <h1>Agenda médica</h1>
      <p className="subtitle">
        Aprueba, reprograma o cancela tus citas y registra cada consulta.
      </p>

      <div className="tabs">
        <button
          className={modo === 'dia' ? 'tab active-tab' : 'tab'}
          onClick={() => setModo('dia')}
        >
          Día
        </button>

        <button
          className={modo === 'semana' ? 'tab active-tab' : 'tab'}
          onClick={() => setModo('semana')}
        >
          Semana
        </button>
      </div>

      <div className="agenda-nav">
        <button className="edit-btn" onClick={() => mover(-1)}>← Anterior</button>
        <button className="edit-btn" onClick={() => setFechaBase(hoy)}>Hoy</button>
        <button className="edit-btn" onClick={() => mover(1)}>Siguiente →</button>
        <strong>
          {modo === 'semana'
            ? `${formatearFecha(desde)} al ${formatearFecha(hasta)}`
            : formatearFecha(desde)}
        </strong>
      </div>

      <div className="panel">
        {cargando && <p>Cargando agenda...</p>}

        {!cargando && fechas.length === 0 && (
          <p>No tienes citas en este período.</p>
        )}

        {!cargando && fechas.map((fecha) => (
          <div className="agenda-dia" key={fecha}>
            <h3>{formatearFecha(fecha)}</h3>

            {resultado.citas
              .filter((cita) => cita.fecha === fecha)
              .map((cita) => (
                <CitaAgenda
                  key={cita.id}
                  cita={cita}
                  hoy={hoy}
                  procesando={procesando === cita.id}
                  aprobar={aprobar}
                  cancelar={cancelar}
                  recargar={recargar}
                  registrarConsulta={registrarConsulta}
                  verHistorial={verHistorial}
                />
              ))}
          </div>
        ))}
      </div>
    </>
  )
}

function CitaAgenda({
  cita,
  hoy,
  procesando,
  aprobar,
  cancelar,
  recargar,
  registrarConsulta,
  verHistorial,
}) {
  const [editando, setEditando] = useState(false)
  const activa = ESTADOS_ACTIVOS.includes(cita.estado)
  const puedeAprobar = ['pendiente', 'reprogramada'].includes(cita.estado)
  const puedeAtender =
    ['confirmada', 'reprogramada', 'vencida'].includes(cita.estado) &&
    cita.fecha <= hoy

  return (
    <div className="appointment cita-completa">
      <div className="cita-info">
        <h4>{formatearHora(cita.hora)} - {cita.paciente}</h4>
        <p>DNI {cita.dni} · Tel. {cita.telefono}</p>
        <p className="cita-motivo"><strong>Motivo:</strong> {cita.motivo}</p>
        {cita.motivoCancelacion && (
          <p className="cita-motivo">
            <strong>Cancelación:</strong> {cita.motivoCancelacion}
          </p>
        )}
      </div>

      <div className="cita-actions">
        <span className={claseEstado(cita.estado)}>
          {etiquetaEstado(cita.estado)}
        </span>

        {puedeAprobar && (
          <button
            className="edit-btn"
            disabled={procesando}
            onClick={() => aprobar(cita)}
          >
            {procesando ? 'Aprobando...' : 'Aprobar'}
          </button>
        )}

        {puedeAtender && (
          <button className="edit-btn" onClick={() => registrarConsulta(cita)}>
            Registrar consulta
          </button>
        )}

        {activa && (
          <button className="edit-btn" onClick={() => setEditando(!editando)}>
            Reprogramar
          </button>
        )}

        <button
          className="edit-btn"
          onClick={() => verHistorial(cita.idPaciente, cita.paciente)}
        >
          Ver historial
        </button>

        {activa && (
          <button className="cancel-btn" onClick={() => cancelar(cita)}>
            Cancelar
          </button>
        )}
      </div>

      {editando && (
        <ReprogramarCita
          cita={cita}
          cerrar={() => setEditando(false)}
          recargar={recargar}
        />
      )}
    </div>
  )
}

function ReprogramarCita({ cita, cerrar, recargar }) {
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [horarios, setHorarios] = useState([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function buscarHorarios(nuevaFecha) {
    setFecha(nuevaFecha)
    setHora('')
    setHorarios([])

    if (!nuevaFecha) return

    setCargandoHorarios(true)

    try {
      const datos = await api(`/medico/horarios?fecha=${nuevaFecha}`)
      setHorarios(datos.horarios)
    } catch (error) {
      alert(error.message)
    } finally {
      setCargandoHorarios(false)
    }
  }

  async function guardar() {
    if (!fecha || !hora) {
      alert('Selecciona una nueva fecha y hora.')
      return
    }

    setGuardando(true)

    try {
      const datos = await api(`/medico/citas/${cita.id}/reprogramar`, {
        method: 'PUT',
        body: JSON.stringify({ fecha, hora }),
      })
      alert(datos.mensaje)
      recargar()
    } catch (error) {
      alert(error.message)
      setGuardando(false)
    }
  }

  return (
    <div className="reprogramar-box">
      <label>Nueva fecha</label>
      <input
        type="date"
        value={fecha}
        min={fechaActual()}
        onChange={(e) => buscarHorarios(e.target.value)}
      />

      <label>Nueva hora</label>
      <select value={hora} onChange={(e) => setHora(e.target.value)}>
        <option value="">
          {cargandoHorarios ? 'Consultando horarios...' : 'Seleccionar hora'}
        </option>
        {horarios.map((horaDisponible) => (
          <option key={horaDisponible} value={horaDisponible}>
            {formatearHora(horaDisponible)}
          </option>
        ))}
      </select>

      {fecha && !cargandoHorarios && horarios.length === 0 && (
        <p className="form-help">No hay horarios disponibles para esta fecha.</p>
      )}

      <button disabled={guardando} onClick={guardar}>
        {guardando ? 'Guardando...' : 'Guardar cambio'}
      </button>

      <button className="secondary-btn" onClick={cerrar}>
        Cancelar edición
      </button>
    </div>
  )
}

function RegistrarConsulta({ cita, volver }) {
  const [descripcion, setDescripcion] = useState(cita.motivo)
  const [diagnostico, setDiagnostico] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [indicaciones, setIndicaciones] = useState('')
  const [medicamentos, setMedicamentos] = useState([])
  const [guardando, setGuardando] = useState(false)

  function actualizarMedicamento(indice, campo, valor) {
    setMedicamentos(
      medicamentos.map((item, posicion) =>
        posicion === indice ? { ...item, [campo]: valor } : item,
      ),
    )
  }

  async function guardar(e) {
    e.preventDefault()

    if (!diagnostico.trim()) {
      alert('Registra el diagnóstico de la consulta.')
      return
    }

    setGuardando(true)

    try {
      const datos = await api(`/medico/citas/${cita.id}/consulta`, {
        method: 'POST',
        body: JSON.stringify({
          descripcion,
          diagnostico,
          observaciones,
          indicacionesGenerales: indicaciones,
          medicamentos,
        }),
      })
      alert(datos.mensaje)
      volver()
    } catch (error) {
      alert(error.message)
      setGuardando(false)
    }
  }

  return (
    <>
      <button className="edit-btn volver-btn" onClick={volver}>
        ← Volver a la agenda
      </button>

      <h1>Registrar consulta</h1>
      <p className="subtitle">
        El paciente verá el diagnóstico y la receta en su historial médico.
      </p>

      <div className="booking">
        <form className="form-card" onSubmit={guardar}>
          <h3>Datos de la consulta</h3>

          <label>Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />

          <label>Diagnóstico</label>
          <textarea
            value={diagnostico}
            onChange={(e) => setDiagnostico(e.target.value)}
            placeholder="Diagnóstico de la consulta"
          />

          <label>Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones (opcional)"
          />

          <h3 className="receta-titulo">Receta digital</h3>

          {medicamentos.length === 0 && (
            <p className="nota-suave">
              Sin medicamentos: la consulta se registrará sin receta.
            </p>
          )}

          {medicamentos.map((item, indice) => (
            <div className="medicamento-box" key={indice}>
              <label>Medicamento</label>
              <input
                value={item.medicamento}
                maxLength={150}
                onChange={(e) =>
                  actualizarMedicamento(indice, 'medicamento', e.target.value)
                }
              />

              <label>Dosis</label>
              <input
                value={item.dosis}
                maxLength={100}
                placeholder="500 mg"
                onChange={(e) =>
                  actualizarMedicamento(indice, 'dosis', e.target.value)
                }
              />

              <label>Frecuencia</label>
              <input
                value={item.frecuencia}
                maxLength={100}
                placeholder="Cada 8 horas"
                onChange={(e) =>
                  actualizarMedicamento(indice, 'frecuencia', e.target.value)
                }
              />

              <label>Duración</label>
              <input
                value={item.duracion}
                maxLength={100}
                placeholder="3 días"
                onChange={(e) =>
                  actualizarMedicamento(indice, 'duracion', e.target.value)
                }
              />

              <label>Indicación</label>
              <input
                value={item.indicacion}
                placeholder="Opcional"
                onChange={(e) =>
                  actualizarMedicamento(indice, 'indicacion', e.target.value)
                }
              />

              <button
                type="button"
                className="cancel-btn"
                onClick={() =>
                  setMedicamentos(
                    medicamentos.filter((_, posicion) => posicion !== indice),
                  )
                }
              >
                Quitar medicamento
              </button>
            </div>
          ))}

          <button
            type="button"
            className="secondary-btn"
            onClick={() => setMedicamentos([...medicamentos, MEDICAMENTO_VACIO])}
          >
            Agregar medicamento
          </button>

          {medicamentos.length > 0 && (
            <>
              <label>Indicaciones generales</label>
              <textarea
                value={indicaciones}
                onChange={(e) => setIndicaciones(e.target.value)}
                placeholder="Indicaciones generales (opcional)"
              />
            </>
          )}

          <button type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar consulta'}
          </button>
        </form>

        <div className="summary-card">
          <h3>Resumen de la cita</h3>
          <p><strong>Paciente:</strong> {cita.paciente}</p>
          <p><strong>DNI:</strong> {cita.dni}</p>
          <p><strong>Fecha:</strong> {formatearFecha(cita.fecha)}</p>
          <p><strong>Hora:</strong> {formatearHora(cita.hora)}</p>
          <p><strong>Motivo:</strong> {cita.motivo}</p>
        </div>
      </div>
    </>
  )
}

function SubirDocumento({ idPaciente, historial, recargar }) {
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState('resultado')
  const [nombreExamen, setNombreExamen] = useState('')
  const [fechaResultado, setFechaResultado] = useState(fechaActual())
  const [resumen, setResumen] = useState('')
  const [idHistorial, setIdHistorial] = useState('')
  const [idReceta, setIdReceta] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [enviando, setEnviando] = useState(false)

  function cerrar() {
    setAbierto(false)
    setTipo('resultado')
    setNombreExamen('')
    setFechaResultado(fechaActual())
    setResumen('')
    setIdHistorial('')
    setIdReceta('')
    setArchivo(null)
  }

  async function enviar(e) {
    e.preventDefault()

    if (!archivo) {
      alert('Selecciona un archivo PDF.')
      return
    }

    if (archivo.size > MAX_TAMANO_PDF) {
      alert('El PDF no puede superar los 10 MB.')
      return
    }

    const datos = new FormData()
    datos.append('tipo', tipo)

    if (tipo === 'resultado') {
      datos.append('nombreExamen', nombreExamen)
      datos.append('fechaResultado', fechaResultado)
      datos.append('resumen', resumen)
    }
    if (tipo === 'informe') datos.append('idHistorial', idHistorial)
    if (tipo === 'receta') datos.append('idReceta', idReceta)
    datos.append('archivo', archivo)

    setEnviando(true)

    try {
      const respuesta = await api(`/medico/pacientes/${idPaciente}/documentos`, {
        method: 'POST',
        body: datos,
      })
      alert(respuesta.mensaje)
      cerrar()
      recargar()
    } catch (error) {
      alert(error.message)
    } finally {
      setEnviando(false)
    }
  }

  if (!abierto) {
    return (
      <button className="edit-btn volver-btn" onClick={() => setAbierto(true)}>
        Subir documento PDF
      </button>
    )
  }

  return (
    <form className="form-card subir-documento" onSubmit={enviar}>
      <h3>Subir documento PDF</h3>
      <p className="nota-suave">
        El paciente recibirá un aviso y podrá descargarlo desde su historial.
      </p>

      <label>Tipo de documento</label>
      <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="resultado">Resultado de laboratorio</option>
        <option value="informe">Informe de una consulta</option>
        <option value="receta">Receta</option>
      </select>

      {tipo === 'resultado' && (
        <>
          <label>Nombre del examen</label>
          <input
            value={nombreExamen}
            maxLength={150}
            onChange={(e) => setNombreExamen(e.target.value)}
            placeholder="Hemograma completo"
          />

          <label>Fecha del resultado</label>
          <input
            type="date"
            value={fechaResultado}
            max={fechaActual()}
            onChange={(e) => setFechaResultado(e.target.value)}
          />

          <label>Resumen</label>
          <textarea
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            placeholder="Resumen del resultado (opcional)"
          />
        </>
      )}

      {tipo === 'informe' && (
        <>
          <label>Consulta</label>
          <select
            value={idHistorial}
            onChange={(e) => setIdHistorial(e.target.value)}
          >
            <option value="">Seleccionar consulta</option>
            {historial.consultas.map((consulta) => (
              <option key={consulta.id} value={consulta.id}>
                {formatearFecha(consulta.fecha)} - {consulta.medico}
              </option>
            ))}
          </select>
          <p className="nota-suave">
            Este PDF será el que descargue el paciente en lugar del informe actual.
          </p>
        </>
      )}

      {tipo === 'receta' && (
        <>
          <label>Receta</label>
          <select value={idReceta} onChange={(e) => setIdReceta(e.target.value)}>
            <option value="">Seleccionar receta</option>
            {historial.recetas.map((receta) => (
              <option key={receta.id} value={receta.id}>
                {formatearFecha(receta.fecha)} - {receta.medico}
              </option>
            ))}
          </select>
          <p className="nota-suave">
            Este PDF será el que descargue el paciente en lugar de la receta actual.
          </p>
        </>
      )}

      <label>Archivo PDF (máximo 10 MB)</label>
      <input
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => setArchivo(e.target.files[0] || null)}
      />

      <button type="submit" disabled={enviando}>
        {enviando ? 'Subiendo...' : 'Subir documento'}
      </button>

      <button
        type="button"
        className="secondary-btn"
        disabled={enviando}
        onClick={cerrar}
      >
        Cancelar
      </button>
    </form>
  )
}

function MisPacientes({ verHistorial }) {
  const [pacientes, setPacientes] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api('/medico/pacientes')
      .then((datos) => setPacientes(datos.pacientes))
      .catch((error) => alert(error.message))
      .finally(() => setCargando(false))
  }, [])

  return (
    <>
      <h1>Mis pacientes</h1>
      <p className="subtitle">
        Pacientes con citas contigo y acceso a su historial clínico.
      </p>

      <div className="panel">
        {cargando && <p>Cargando pacientes...</p>}

        {!cargando && pacientes.length === 0 && (
          <p>Todavía no tienes pacientes con citas registradas.</p>
        )}

        {pacientes.map((paciente) => (
          <div className="appointment cita-completa" key={paciente.id}>
            <div className="cita-info">
              <h4>{paciente.nombre}</h4>
              <p>DNI {paciente.dni} · Tel. {paciente.telefono}</p>
              <span>Última cita: {formatearFecha(paciente.ultimaCita)}</span>
            </div>

            <div className="cita-actions">
              <button
                className="edit-btn"
                onClick={() => verHistorial(paciente.id, paciente.nombre)}
              >
                Ver historial
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default PanelMedico
