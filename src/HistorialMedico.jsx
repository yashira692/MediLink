import { useEffect, useState } from 'react'
import { api, descargarArchivo } from './services/api.js'
import { etiquetaEstado, formatearFecha } from './utils/formato.js'

function HistorialMedico({
  rutaHistorial = '/historial',
  rutaDocumentos = '/historial/documentos',
  titulo = 'Historial médico',
  subtitulo = 'Consulta tus registros médicos, recetas digitales y resultados de laboratorio.',
  renderAcciones,
}) {
  const [pestana, setPestana] = useState('consultas')
  const [historial, setHistorial] = useState({
    consultas: [],
    recetas: [],
    resultados: [],
  })
  const [cargando, setCargando] = useState(true)
  const [descargando, setDescargando] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    api(rutaHistorial)
      .then(setHistorial)
      .catch((error) => alert(error.message))
      .finally(() => setCargando(false))
  }, [rutaHistorial, recarga])

  async function descargarDocumento(idDocumento) {
    setDescargando(idDocumento)

    try {
      await descargarArchivo(`${rutaDocumentos}/${idDocumento}/descargar`)
    } catch (error) {
      alert(error.message)
    } finally {
      setDescargando(null)
    }
  }

  return (
    <>
      <h1>{titulo}</h1>
      <p className="subtitle">{subtitulo}</p>

      {cargando && <div className="panel">Cargando historial médico...</div>}

      {!cargando && (
        <>
      {renderAcciones?.(historial, () => setRecarga((actual) => actual + 1))}

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
            <p>No hay consultas médicas registradas.</p>
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
            <p>No hay recetas digitales registradas.</p>
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
            <p>No hay resultados de laboratorio registrados.</p>
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

              {resultado.resultado && (
                <p><strong>Resultado:</strong> {resultado.resultado}</p>
              )}

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

export default HistorialMedico
