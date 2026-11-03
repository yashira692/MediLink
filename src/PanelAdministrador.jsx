import { useEffect, useState } from 'react'
import CambiarPassword from './CambiarPassword.jsx'
import { api, descargarArchivo } from './services/api.js'
import {
  etiquetaEstado,
  fechaActual,
  formatearFecha,
  formatearHora,
} from './utils/formato.js'

const MEDICO_VACIO = {
  nombres: '',
  apellidos: '',
  dni: '',
  correo: '',
  telefono: '',
  cmp: '',
  idEspecialidad: '',
  password: '',
}
const ESPECIALIDAD_VACIA = { nombre: '', descripcion: '' }
const ACCIONES_BITACORA = {
  ver_historial: 'Vio el historial',
  descargar_documento: 'Descargó un documento',
  subir_documento: 'Subió un documento',
  registrar_consulta: 'Registró una consulta',
  aprobar_cita: 'Aprobó una cita',
  cancelar_cita: 'Canceló una cita',
  reprogramar_cita: 'Reprogramó una cita',
  ver_reporte: 'Generó un reporte',
  exportar_reporte: 'Exportó un reporte',
  cambiar_password: 'Cambió su contraseña',
}

function PanelAdministrador({ administrador, cerrarSesion, solicitarConfirmacion }) {
  const [vista, setVista] = useState('dashboard')
  const [menuUsuario, setMenuUsuario] = useState(false)

  const opciones = [
    ['dashboard', 'Dashboard'],
    ['medicos', 'Médicos'],
    ['especialidades', 'Especialidades'],
    ['reportes', 'Reportes'],
    ['bitacora', 'Bitácora'],
  ]

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo"><i className="logo-mark">M</i>MediLink</div>

        {opciones.map(([id, texto]) => (
          <button
            key={id}
            className={vista === id ? 'menu active' : 'menu'}
            onClick={() => setVista(id)}
          >
            {texto}
          </button>
        ))}
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <h2>{administrador.nombres} {administrador.apellidos}</h2>
            <p>Administrador</p>
          </div>

          <div className="header-actions">
            <div className="user-menu">
              <button
                className="avatar avatar-button"
                onClick={() => setMenuUsuario(!menuUsuario)}
              >
                {administrador.nombres.charAt(0)}{administrador.apellidos.charAt(0)}
              </button>

              {menuUsuario && (
                <div className="user-dropdown">
                  <button
                    onClick={() => {
                      setVista('password')
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
          {vista === 'dashboard' && <Dashboard />}
          {vista === 'medicos' && (
            <GestionMedicos solicitarConfirmacion={solicitarConfirmacion} />
          )}
          {vista === 'especialidades' && (
            <GestionEspecialidades solicitarConfirmacion={solicitarConfirmacion} />
          )}
          {vista === 'reportes' && <Reportes />}
          {vista === 'bitacora' && <Bitacora />}
          {vista === 'password' && (
            <CambiarPassword ruta="/admin/password" cerrarSesion={cerrarSesion} />
          )}
        </section>
      </main>
    </div>
  )
}

function Dashboard() {
  const [mes, setMes] = useState(fechaActual().slice(0, 7))
  const [resultado, setResultado] = useState({ mes: null, datos: null })

  useEffect(() => {
    if (!mes) return undefined

    let vigente = true

    api(`/admin/dashboard?mes=${mes}`)
      .then((datos) => {
        if (vigente) setResultado({ mes, datos })
      })
      .catch((error) => {
        if (vigente) setResultado({ mes, datos: null })
        alert(error.message)
      })

    return () => {
      vigente = false
    }
  }, [mes])

  const datos = resultado.mes === mes ? resultado.datos : null
  const maximo = Math.max(1, ...(datos?.especialidades || []).map((item) => item.citas))
  const indicadores = datos
    ? [
        ['Citas del mes', datos.citas],
        ['Atendidas', datos.atendidas],
        ['Canceladas', datos.canceladas],
        ['Por atender', datos.activas],
        ['Vencidas', datos.vencidas],
        ['Pacientes activos', datos.pacientes],
        ['Médicos activos', datos.medicos],
      ]
    : []

  return (
    <>
      <h1>Dashboard</h1>
      <p className="subtitle">Indicadores de atención del consultorio.</p>

      <div className="filtros-admin">
        <div>
          <label>Mes</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </div>
      </div>

      {!datos && <div className="panel">Cargando indicadores...</div>}

      {datos && (
        <>
          <div className="indicadores">
            {indicadores.map(([titulo, valor]) => (
              <div className="indicador" key={titulo}>
                <strong>{valor}</strong>
                <span>{titulo}</span>
              </div>
            ))}
          </div>

          <div className="panel">
            <h3>Especialidades más demandadas</h3>
            <p className="nota-suave">Citas del mes por especialidad.</p>

            {datos.especialidades.map((item) => (
              <div
                className="barra-fila"
                key={item.id}
                title={`${item.nombre}: ${item.citas} cita(s)`}
              >
                <span className="barra-nombre">{item.nombre}</span>
                <div className="barra-pista">
                  {item.citas > 0 && (
                    <div
                      className="barra-valor"
                      style={{ width: `${(item.citas / maximo) * 100}%` }}
                    />
                  )}
                </div>
                <strong className="barra-numero">{item.citas}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function GestionMedicos({ solicitarConfirmacion }) {
  const [medicos, setMedicos] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [recarga, setRecarga] = useState(0)
  const [formulario, setFormulario] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    Promise.all([api('/admin/medicos'), api('/admin/especialidades')])
      .then(([datosMedicos, datosEspecialidades]) => {
        setMedicos(datosMedicos.medicos)
        setEspecialidades(datosEspecialidades.especialidades)
      })
      .catch((error) => alert(error.message))
      .finally(() => setCargando(false))
  }, [recarga])

  function actualizar(campo, valor) {
    setFormulario({ ...formulario, [campo]: valor })
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)

    try {
      const datos = formulario.id
        ? await api(`/admin/medicos/${formulario.id}`, {
            method: 'PUT',
            body: JSON.stringify(formulario),
          })
        : await api('/admin/medicos', {
            method: 'POST',
            body: JSON.stringify(formulario),
          })
      alert(datos.mensaje)
      setFormulario(null)
      setRecarga((actual) => actual + 1)
    } catch (error) {
      alert(error.message)
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(medico, activo) {
    const datos = await api(`/admin/medicos/${medico.id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ activo }),
    })
    alert(datos.mensaje)
    setRecarga((actual) => actual + 1)
  }

  function solicitarCambioEstado(medico) {
    if (medico.estado) {
      solicitarConfirmacion({
        titulo: 'Desactivar médico',
        mensaje: `${medico.nombres} ${medico.apellidos} no podrá ingresar ni recibir citas nuevas.`,
        textoConfirmar: 'Sí, desactivar',
        textoProcesando: 'Desactivando...',
        accion: () => cambiarEstado(medico, false),
      })
      return
    }

    cambiarEstado(medico, true).catch((error) => alert(error.message))
  }

  const especialidadesDisponibles = especialidades.filter(
    (item) =>
      item.estado || String(item.id) === String(formulario?.idEspecialidad),
  )

  return (
    <>
      <h1>Médicos</h1>
      <p className="subtitle">Administra el catálogo de médicos del consultorio.</p>

      {!formulario && (
        <button
          className="edit-btn volver-btn"
          onClick={() => setFormulario(MEDICO_VACIO)}
        >
          Agregar médico
        </button>
      )}

      {formulario && (
        <form className="form-card subir-documento" onSubmit={guardar}>
          <h3>{formulario.id ? 'Editar médico' : 'Agregar médico'}</h3>

          <label>Nombres</label>
          <input
            value={formulario.nombres}
            maxLength={100}
            onChange={(e) => actualizar('nombres', e.target.value)}
          />

          <label>Apellidos</label>
          <input
            value={formulario.apellidos}
            maxLength={100}
            onChange={(e) => actualizar('apellidos', e.target.value)}
          />

          <label>DNI</label>
          <input
            value={formulario.dni}
            maxLength={8}
            onChange={(e) => actualizar('dni', e.target.value)}
          />

          <label>Correo electrónico</label>
          <input
            type="email"
            value={formulario.correo}
            maxLength={150}
            onChange={(e) => actualizar('correo', e.target.value)}
          />

          <label>Teléfono</label>
          <input
            value={formulario.telefono}
            maxLength={9}
            onChange={(e) => actualizar('telefono', e.target.value)}
          />

          <label>CMP</label>
          <input
            value={formulario.cmp}
            maxLength={20}
            onChange={(e) => actualizar('cmp', e.target.value)}
          />

          <label>Especialidad</label>
          <select
            value={formulario.idEspecialidad}
            onChange={(e) => actualizar('idEspecialidad', e.target.value)}
          >
            <option value="">Seleccionar especialidad</option>
            {especialidadesDisponibles.map((item) => (
              <option key={item.id} value={item.id}>{item.nombre}</option>
            ))}
          </select>

          {!formulario.id && (
            <>
              <label>Contraseña inicial</label>
              <input
                type="password"
                autoComplete="new-password"
                value={formulario.password}
                onChange={(e) => actualizar('password', e.target.value)}
              />
              <p className="nota-suave">
                Mínimo 8 caracteres, mayúscula, minúscula y número. Por defecto,
                atenderá de lunes a sábado de 8:00 a. m. a 5:00 p. m.
              </p>
            </>
          )}

          <button type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar médico'}
          </button>

          <button
            type="button"
            className="secondary-btn"
            disabled={guardando}
            onClick={() => setFormulario(null)}
          >
            Cancelar
          </button>
        </form>
      )}

      <div className="panel">
        <h3>Médicos registrados</h3>

        {cargando && <p>Cargando médicos...</p>}

        {!cargando && medicos.length === 0 && <p>No hay médicos registrados.</p>}

        {medicos.map((medico) => (
          <div className="appointment cita-completa" key={medico.id}>
            <div className="cita-info">
              <h4>{medico.nombres} {medico.apellidos}</h4>
              <p>{medico.especialidad} · {medico.cmp}</p>
              <span>DNI {medico.dni} · {medico.correo} · Tel. {medico.telefono}</span>
            </div>

            <div className="cita-actions">
              <span className={medico.estado ? 'estado' : 'estado cancelada'}>
                {medico.estado ? 'Activo' : 'Inactivo'}
              </span>

              <button
                className="edit-btn"
                onClick={() => setFormulario({ ...MEDICO_VACIO, ...medico })}
              >
                Editar
              </button>

              <button
                className={medico.estado ? 'cancel-btn' : 'edit-btn'}
                onClick={() => solicitarCambioEstado(medico)}
              >
                {medico.estado ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function GestionEspecialidades({ solicitarConfirmacion }) {
  const [especialidades, setEspecialidades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [recarga, setRecarga] = useState(0)
  const [formulario, setFormulario] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    api('/admin/especialidades')
      .then((datos) => setEspecialidades(datos.especialidades))
      .catch((error) => alert(error.message))
      .finally(() => setCargando(false))
  }, [recarga])

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)

    try {
      const datos = formulario.id
        ? await api(`/admin/especialidades/${formulario.id}`, {
            method: 'PUT',
            body: JSON.stringify(formulario),
          })
        : await api('/admin/especialidades', {
            method: 'POST',
            body: JSON.stringify(formulario),
          })
      alert(datos.mensaje)
      setFormulario(null)
      setRecarga((actual) => actual + 1)
    } catch (error) {
      alert(error.message)
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(especialidad, activo) {
    const datos = await api(`/admin/especialidades/${especialidad.id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ activo }),
    })
    alert(datos.mensaje)
    setRecarga((actual) => actual + 1)
  }

  function solicitarCambioEstado(especialidad) {
    if (especialidad.estado) {
      solicitarConfirmacion({
        titulo: 'Desactivar especialidad',
        mensaje: `${especialidad.nombre} dejará de aparecer al reservar citas.`,
        textoConfirmar: 'Sí, desactivar',
        textoProcesando: 'Desactivando...',
        accion: () => cambiarEstado(especialidad, false),
      })
      return
    }

    cambiarEstado(especialidad, true).catch((error) => alert(error.message))
  }

  return (
    <>
      <h1>Especialidades</h1>
      <p className="subtitle">Administra las especialidades que ofrece el consultorio.</p>

      {!formulario && (
        <button
          className="edit-btn volver-btn"
          onClick={() => setFormulario(ESPECIALIDAD_VACIA)}
        >
          Agregar especialidad
        </button>
      )}

      {formulario && (
        <form className="form-card subir-documento" onSubmit={guardar}>
          <h3>{formulario.id ? 'Editar especialidad' : 'Agregar especialidad'}</h3>

          <label>Nombre</label>
          <input
            value={formulario.nombre}
            maxLength={100}
            onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
          />

          <label>Descripción</label>
          <textarea
            value={formulario.descripcion || ''}
            maxLength={255}
            onChange={(e) =>
              setFormulario({ ...formulario, descripcion: e.target.value })
            }
          />

          <button type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar especialidad'}
          </button>

          <button
            type="button"
            className="secondary-btn"
            disabled={guardando}
            onClick={() => setFormulario(null)}
          >
            Cancelar
          </button>
        </form>
      )}

      <div className="panel">
        <h3>Especialidades registradas</h3>

        {cargando && <p>Cargando especialidades...</p>}

        {!cargando && especialidades.length === 0 && (
          <p>No hay especialidades registradas.</p>
        )}

        {especialidades.map((especialidad) => (
          <div className="appointment cita-completa" key={especialidad.id}>
            <div className="cita-info">
              <h4>{especialidad.nombre}</h4>
              <p>{especialidad.descripcion}</p>
              <span>Médicos activos: {especialidad.medicosActivos}</span>
            </div>

            <div className="cita-actions">
              <span className={especialidad.estado ? 'estado' : 'estado cancelada'}>
                {especialidad.estado ? 'Activa' : 'Inactiva'}
              </span>

              <button
                className="edit-btn"
                onClick={() => setFormulario(especialidad)}
              >
                Editar
              </button>

              <button
                className={especialidad.estado ? 'cancel-btn' : 'edit-btn'}
                onClick={() => solicitarCambioEstado(especialidad)}
              >
                {especialidad.estado ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function Reportes() {
  const hoy = fechaActual()
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`)
  const [hasta, setHasta] = useState(hoy)
  const [idMedico, setIdMedico] = useState('')
  const [idEspecialidad, setIdEspecialidad] = useState('')
  const [medicos, setMedicos] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [reporte, setReporte] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [exportando, setExportando] = useState(null)

  useEffect(() => {
    Promise.all([api('/admin/medicos'), api('/admin/especialidades')])
      .then(([datosMedicos, datosEspecialidades]) => {
        setMedicos(datosMedicos.medicos)
        setEspecialidades(datosEspecialidades.especialidades)
      })
      .catch((error) => alert(error.message))
  }, [])

  function parametros() {
    const consulta = new URLSearchParams({ desde, hasta })

    if (idMedico) consulta.set('idMedico', idMedico)
    if (idEspecialidad) consulta.set('idEspecialidad', idEspecialidad)

    return consulta
  }

  async function generar(e) {
    e.preventDefault()
    setGenerando(true)

    try {
      const datos = await api(`/admin/reportes?${parametros()}`)
      setReporte({ ...datos, consulta: parametros().toString() })
    } catch (error) {
      alert(error.message)
    } finally {
      setGenerando(false)
    }
  }

  async function exportar(formato) {
    setExportando(formato)

    try {
      await descargarArchivo(
        `/admin/reportes/exportar?${reporte.consulta}&formato=${formato}`,
      )
    } catch (error) {
      alert(error.message)
    } finally {
      setExportando(null)
    }
  }

  const indicadores = reporte
    ? [
        ['Total', reporte.resumen.total],
        ['Atendidas', reporte.resumen.atendidas],
        ['Canceladas', reporte.resumen.canceladas],
        ['Por atender', reporte.resumen.activas],
        ['Vencidas', reporte.resumen.vencidas],
      ]
    : []

  return (
    <>
      <h1>Reportes</h1>
      <p className="subtitle">Genera y exporta reportes de citas por período.</p>

      <form className="filtros-admin" onSubmit={generar}>
        <div>
          <label>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>

        <div>
          <label>Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>

        <div>
          <label>Médico</label>
          <select value={idMedico} onChange={(e) => setIdMedico(e.target.value)}>
            <option value="">Todos</option>
            {medicos.map((medico) => (
              <option key={medico.id} value={medico.id}>
                {medico.nombres} {medico.apellidos}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Especialidad</label>
          <select
            value={idEspecialidad}
            onChange={(e) => setIdEspecialidad(e.target.value)}
          >
            <option value="">Todas</option>
            {especialidades.map((especialidad) => (
              <option key={especialidad.id} value={especialidad.id}>
                {especialidad.nombre}
              </option>
            ))}
          </select>
        </div>

        <button className="edit-btn" type="submit" disabled={generando}>
          {generando ? 'Generando...' : 'Generar reporte'}
        </button>
      </form>

      {reporte && (
        <>
          <div className="indicadores">
            {indicadores.map(([titulo, valor]) => (
              <div className="indicador" key={titulo}>
                <strong>{valor}</strong>
                <span>{titulo}</span>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="reporte-acciones">
              <button
                className="edit-btn"
                disabled={Boolean(exportando)}
                onClick={() => exportar('pdf')}
              >
                {exportando === 'pdf' ? 'Exportando...' : 'Descargar PDF'}
              </button>
              <button
                className="edit-btn"
                disabled={Boolean(exportando)}
                onClick={() => exportar('excel')}
              >
                {exportando === 'excel' ? 'Exportando...' : 'Descargar Excel'}
              </button>
            </div>

            {reporte.filas.length === 0 && (
              <p>No hay citas para los filtros seleccionados.</p>
            )}

            {reporte.filas.length > 0 && (
              <div className="tabla-contenedor">
                <table className="tabla-reporte">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Hora</th>
                      <th>Paciente</th>
                      <th>Médico</th>
                      <th>Especialidad</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.filas.map((fila) => (
                      <tr key={fila.id}>
                        <td>{formatearFecha(fila.fecha)}</td>
                        <td>{formatearHora(fila.hora)}</td>
                        <td>{fila.paciente}</td>
                        <td>{fila.medico}</td>
                        <td>{fila.especialidad}</td>
                        <td>{etiquetaEstado(fila.estado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

function Bitacora() {
  const hoy = fechaActual()
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`)
  const [hasta, setHasta] = useState(hoy)
  const [registros, setRegistros] = useState(null)
  const [consultando, setConsultando] = useState(false)

  async function consultar(e) {
    e.preventDefault()
    setConsultando(true)

    try {
      const datos = await api(`/admin/bitacora?desde=${desde}&hasta=${hasta}`)
      setRegistros(datos.registros)
    } catch (error) {
      alert(error.message)
    } finally {
      setConsultando(false)
    }
  }

  return (
    <>
      <h1>Bitácora de accesos</h1>
      <p className="subtitle">
        Registro de quién consultó o cambió información de pacientes.
      </p>

      <form className="filtros-admin" onSubmit={consultar}>
        <div>
          <label>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>

        <div>
          <label>Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>

        <button className="edit-btn" type="submit" disabled={consultando}>
          {consultando ? 'Consultando...' : 'Consultar'}
        </button>
      </form>

      {registros && (
        <div className="panel">
          {registros.length === 0 && <p>No hay registros en este período.</p>}

          {registros.length > 0 && (
            <>
              <p className="nota-suave">
                Se muestran los {registros.length} registros más recientes (máximo 500).
              </p>

              <div className="tabla-contenedor">
                <table className="tabla-reporte">
                  <thead>
                    <tr>
                      <th>Fecha y hora</th>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Acción</th>
                      <th>Paciente</th>
                      <th>Detalle</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((registro) => (
                      <tr key={registro.id}>
                        <td>{registro.fecha.replace('T', ' ')}</td>
                        <td>{registro.usuario}</td>
                        <td>{registro.rol === 'medico' ? 'Médico' : 'Administrador'}</td>
                        <td>{ACCIONES_BITACORA[registro.accion] || registro.accion}</td>
                        <td>{registro.paciente || '-'}</td>
                        <td>{registro.detalle || '-'}</td>
                        <td>{registro.ip || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

export default PanelAdministrador
