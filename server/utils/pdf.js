import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'

export async function crearPdfMedico({
  ruta,
  titulo,
  paciente,
  medico,
  fecha,
  secciones,
}) {
  await fs.promises.mkdir(path.dirname(ruta), { recursive: true })

  return new Promise((resolve, reject) => {
    const documento = new PDFDocument({
      size: 'A4',
      margins: { top: 60, right: 60, bottom: 60, left: 60 },
      info: {
        Title: titulo,
        Author: 'MediLink',
      },
    })
    const salida = fs.createWriteStream(ruta)

    documento.pipe(salida)
    documento
      .fontSize(22)
      .fillColor('#2f7fc1')
      .text('MediLink', { align: 'center' })
    documento
      .moveDown(0.4)
      .fontSize(16)
      .fillColor('#0b2b55')
      .text(titulo, { align: 'center' })
    documento.moveDown(1.5)
    documento.fontSize(11).fillColor('#333333')
    documento.text(`Paciente: ${paciente}`)
    documento.text(`Profesional: ${medico}`)
    documento.text(`Fecha: ${fecha}`)
    documento.moveDown()

    for (const seccion of secciones) {
      documento
        .fontSize(12)
        .fillColor('#0b2b55')
        .text(seccion.titulo, { continued: false })
      documento
        .moveDown(0.25)
        .fontSize(11)
        .fillColor('#333333')
        .text(seccion.contenido)
      documento.moveDown()
    }

    documento
      .moveDown()
      .fontSize(9)
      .fillColor('#68798c')
      .text(
        'Documento digital generado por MediLink. Esta demostración no reemplaza un documento médico con firma digital.',
        { align: 'center' },
      )
    documento.end()

    salida.on('finish', async () => {
      try {
        const estadisticas = await fs.promises.stat(ruta)
        resolve(estadisticas.size)
      } catch (error) {
        reject(error)
      }
    })
    salida.on('error', reject)
    documento.on('error', reject)
  })
}
