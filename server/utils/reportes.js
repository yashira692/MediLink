import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

const COLUMNAS = [
  { titulo: 'Fecha', clave: 'fecha', ancho: 75, anchoExcel: 12 },
  { titulo: 'Hora', clave: 'hora', ancho: 50, anchoExcel: 8 },
  { titulo: 'Paciente', clave: 'paciente', ancho: 200, anchoExcel: 32 },
  { titulo: 'Médico', clave: 'medico', ancho: 190, anchoExcel: 30 },
  { titulo: 'Especialidad', clave: 'especialidad', ancho: 145, anchoExcel: 22 },
  { titulo: 'Estado', clave: 'estado', ancho: 100, anchoExcel: 14 },
]
const ALTO_FILA = 20
const MARGEN = 40

function etiquetaEstado(estado) {
  return estado.charAt(0).toUpperCase() + estado.slice(1)
}

function descripcionFiltros({ desde, hasta, medico, especialidad }) {
  return [
    `Período: ${desde} al ${hasta}`,
    `Médico: ${medico || 'Todos'}`,
    `Especialidad: ${especialidad || 'Todas'}`,
  ].join('   |   ')
}

function descripcionResumen(resumen) {
  return [
    `Total: ${resumen.total}`,
    `Atendidas: ${resumen.atendidas}`,
    `Canceladas: ${resumen.canceladas}`,
    `Activas: ${resumen.activas}`,
  ].join('   |   ')
}

function dibujarFila(documento, fila, y, encabezado) {
  let x = MARGEN

  documento
    .font(encabezado ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(9)
    .fillColor(encabezado ? '#ffffff' : '#333333')

  for (const columna of COLUMNAS) {
    documento.text(String(fila[columna.clave]), x + 5, y + 6, {
      width: columna.ancho - 10,
      height: ALTO_FILA - 6,
      lineBreak: false,
      ellipsis: true,
    })
    x += columna.ancho
  }
}

function dibujarEncabezado(documento, y) {
  const ancho = COLUMNAS.reduce((total, columna) => total + columna.ancho, 0)
  const titulos = Object.fromEntries(
    COLUMNAS.map((columna) => [columna.clave, columna.titulo]),
  )

  documento.rect(MARGEN, y, ancho, ALTO_FILA).fill('#2f7fc1')
  dibujarFila(documento, titulos, y, true)
}

export function enviarReportePdf(res, { filas, resumen, filtros }) {
  const documento = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: MARGEN,
    info: { Title: 'Reporte de citas', Author: 'MediLink' },
  })

  documento.pipe(res)
  documento.fontSize(20).fillColor('#2f7fc1').text('MediLink')
  documento.fontSize(14).fillColor('#0b2b55').text('Reporte de citas')
  documento.moveDown(0.5)
  documento.fontSize(10).fillColor('#333333').text(descripcionFiltros(filtros))
  documento.text(descripcionResumen(resumen))

  let y = documento.y + 12
  const limite = documento.page.height - MARGEN - ALTO_FILA

  dibujarEncabezado(documento, y)
  y += ALTO_FILA

  if (filas.length === 0) {
    documento
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#333333')
      .text('No hay citas para los filtros seleccionados.', MARGEN, y + 8)
  }

  for (const fila of filas) {
    if (y > limite) {
      documento.addPage()
      y = MARGEN
      dibujarEncabezado(documento, y)
      y += ALTO_FILA
    }

    dibujarFila(
      documento,
      { ...fila, estado: etiquetaEstado(fila.estado) },
      y,
      false,
    )
    y += ALTO_FILA
  }

  documento.end()
}

export async function enviarReporteExcel(res, { filas, resumen, filtros }) {
  const libro = new ExcelJS.Workbook()
  const hoja = libro.addWorksheet('Citas')

  libro.creator = 'MediLink'
  hoja.addRow(['Reporte de citas de MediLink']).font = { bold: true, size: 14 }
  hoja.addRow([descripcionFiltros(filtros)])
  hoja.addRow([descripcionResumen(resumen)])
  hoja.addRow([])

  const encabezado = hoja.addRow(COLUMNAS.map((columna) => columna.titulo))
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  encabezado.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2F7FC1' },
  }

  COLUMNAS.forEach((columna, indice) => {
    hoja.getColumn(indice + 1).width = columna.anchoExcel
  })

  for (const fila of filas) {
    hoja.addRow(
      COLUMNAS.map((columna) =>
        columna.clave === 'estado'
          ? etiquetaEstado(fila.estado)
          : fila[columna.clave],
      ),
    )
  }

  hoja.views = [{ state: 'frozen', ySplit: 5 }]
  await libro.xlsx.write(res)
  res.end()
}
