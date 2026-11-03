import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'
import fs from 'node:fs'
import { opcionesConexion, zonaHorariaBase } from '../config/db.js'
import { crearPdfMedico } from '../utils/pdf.js'
import { VERSION_AVISO_PRIVACIDAD } from '../utils/validacion.js'

// La clave pública del repositorio solo sirve en desarrollo.
if (process.env.NODE_ENV === 'production' && !process.env.DEMO_PASSWORD) {
  console.error('Falta configurar DEMO_PASSWORD para preparar la base.')
  process.exit(1)
}

const passwordDemo = process.env.DEMO_PASSWORD || 'Medilink2026!'
const connection = await mysql.createConnection(opcionesConexion)

if (zonaHorariaBase) {
  await connection.query('SET time_zone = ?', [zonaHorariaBase])
}

// El nombre de la base lo define cada servidor (DB_NAME), no el script.
const esquema = fs
  .readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
  .replace(/^[\s\S]*?USE medilink;/, '')

for (const sentencia of esquema.split(';')) {
  if (sentencia.trim()) await connection.query(sentencia)
}

const medicosIniciales = [
  {
    nombres: 'Emily',
    apellidos: 'Roberts',
    dni: '70000001',
    correo: 'emily.roberts@medilink.pe',
    telefono: '900000001',
    cmp: 'CMP10001',
    especialidad: 'Medicina General',
  },
  {
    nombres: 'Michael',
    apellidos: 'Chen',
    dni: '70000002',
    correo: 'michael.chen@medilink.pe',
    telefono: '900000002',
    cmp: 'CMP10002',
    especialidad: 'Cardiología',
  },
  {
    nombres: 'Valeria',
    apellidos: 'Torres',
    dni: '70000003',
    correo: 'valeria.torres@medilink.pe',
    telefono: '900000003',
    cmp: 'CMP10003',
    especialidad: 'Dermatología',
  },
  {
    nombres: 'Luis',
    apellidos: 'Herrera',
    dni: '70000004',
    correo: 'luis.herrera@medilink.pe',
    telefono: '900000004',
    cmp: 'CMP10004',
    especialidad: 'Pediatría',
  },
]

const pacientesDemo = [
  {
    nombres: 'Ana',
    apellidos: 'Torres Quispe',
    dni: '40000001',
    correo: 'ana.torres@medilink.test',
    telefono: '900100001',
    citas: [
      { especialidad: 'Medicina General', dias: 1, hora: '09:00:00', motivo: 'Control general anual', estado: 'confirmada' },
      { especialidad: 'Pediatría', dias: 9, hora: '11:30:00', motivo: 'Control pediátrico', estado: 'pendiente' },
    ],
  },
  {
    nombres: 'Carlos',
    apellidos: 'Mendoza Ríos',
    dni: '40000002',
    correo: 'carlos.mendoza@medilink.test',
    telefono: '900100002',
    citas: [
      { especialidad: 'Medicina General', dias: 2, hora: '10:30:00', motivo: 'Dolor de garganta', estado: 'pendiente' },
      { especialidad: 'Cardiología', dias: 3, hora: '08:30:00', motivo: 'Control de presión arterial', estado: 'pendiente' },
    ],
  },
  {
    nombres: 'Lucía',
    apellidos: 'Paredes Vega',
    dni: '40000003',
    correo: 'lucia.paredes@medilink.test',
    telefono: '900100003',
    citas: [
      { especialidad: 'Medicina General', dias: 4, hora: '15:00:00', motivo: 'Revisión de exámenes', estado: 'confirmada' },
    ],
  },
]

// Los médicos no atienden domingos.
function fechaAtencion(dias) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  if (fecha.getDay() === 0) fecha.setDate(fecha.getDate() + 1)
  return fecha.toLocaleDateString('en-CA')
}

const especialidades = [
  ['Medicina General', 'Atención médica general y preventiva.'],
  ['Cardiología', 'Prevención y atención de enfermedades cardiovasculares.'],
  ['Dermatología', 'Atención de la piel, cabello y uñas.'],
  ['Pediatría', 'Atención médica de niños y adolescentes.'],
]

try {
  await connection.beginTransaction()

  const [columnas] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'citas'
       AND COLUMN_NAME = 'reserva_activa'`,
    [process.env.DB_NAME],
  )

  if (columnas.length === 0) {
    await connection.query(
      `ALTER TABLE citas
       ADD COLUMN reserva_activa TINYINT
       GENERATED ALWAYS AS (
         CASE
           WHEN estado IN ('pendiente', 'confirmada', 'reprogramada') THEN 1
           ELSE NULL
         END
       ) STORED`,
    )
  }

  const [indices] = await connection.execute(
    `SELECT INDEX_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'citas'
       AND INDEX_NAME = 'uq_cita_medico_horario'`,
    [process.env.DB_NAME],
  )

  if (indices.length === 0) {
    await connection.query(
      `CREATE UNIQUE INDEX uq_cita_medico_horario
       ON citas (id_medico, fecha, hora, reserva_activa)`,
    )
  }

  const [columnaHistorialResultado] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'resultados_laboratorio'
       AND COLUMN_NAME = 'id_historial'`,
    [process.env.DB_NAME],
  )

  if (columnaHistorialResultado.length === 0) {
    await connection.query(
      `ALTER TABLE resultados_laboratorio
       ADD COLUMN id_historial INT UNSIGNED NULL AFTER id_paciente,
       ADD CONSTRAINT fk_resultados_historial
         FOREIGN KEY (id_historial) REFERENCES historial_medico(id_historial)`,
    )
  }

  await connection.query(
    `CREATE TABLE IF NOT EXISTS documentos_medicos (
      id_documento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      id_paciente INT UNSIGNED NOT NULL,
      id_historial INT UNSIGNED NULL,
      id_receta INT UNSIGNED NULL,
      id_resultado INT UNSIGNED NULL,
      tipo ENUM('informe', 'receta', 'resultado') NOT NULL,
      nombre_original VARCHAR(255) NOT NULL,
      nombre_archivo VARCHAR(255) NOT NULL UNIQUE,
      ruta_relativa VARCHAR(500) NULL,
      contenido MEDIUMBLOB NULL,
      mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
      tamano_bytes BIGINT UNSIGNED NOT NULL,
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_documentos_paciente
        FOREIGN KEY (id_paciente) REFERENCES pacientes(id_paciente)
        ON DELETE CASCADE,
      CONSTRAINT fk_documentos_historial
        FOREIGN KEY (id_historial) REFERENCES historial_medico(id_historial),
      CONSTRAINT fk_documentos_receta
        FOREIGN KEY (id_receta) REFERENCES recetas(id_receta),
      CONSTRAINT fk_documentos_resultado
        FOREIGN KEY (id_resultado) REFERENCES resultados_laboratorio(id_resultado)
    )`,
  )

  const [columnaContenido] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'documentos_medicos'
       AND COLUMN_NAME = 'contenido'`,
    [process.env.DB_NAME],
  )

  if (columnaContenido.length === 0) {
    await connection.query(
      `ALTER TABLE documentos_medicos
       MODIFY COLUMN ruta_relativa VARCHAR(500) NULL,
       ADD COLUMN contenido MEDIUMBLOB NULL AFTER ruta_relativa`,
    )
  }

  const [columnasChatbot] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'chatbot_consultas'`,
    [process.env.DB_NAME],
  )
  const nombresColumnasChatbot = new Set(
    columnasChatbot.map((columna) => columna.COLUMN_NAME),
  )

  if (!nombresColumnasChatbot.has('proveedor')) {
    await connection.query(
      `ALTER TABLE chatbot_consultas
       ADD COLUMN proveedor ENUM('local', 'dialogflow')
         NOT NULL DEFAULT 'local' AFTER intent_detectado`,
    )
  }

  if (!nombresColumnasChatbot.has('confianza')) {
    await connection.query(
      `ALTER TABLE chatbot_consultas
       ADD COLUMN confianza DECIMAL(5,4) NULL AFTER proveedor`,
    )
  }

  const [columnasUsuario] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios'
       AND COLUMN_NAME = 'token_version'`,
    [process.env.DB_NAME],
  )

  if (columnasUsuario.length === 0) {
    await connection.query(
      `ALTER TABLE usuarios
       ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0
       AFTER password_hash`,
    )
  }

  const [columnasNotificacion] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'notificaciones'`,
    [process.env.DB_NAME],
  )
  const nombresColumnasNotificacion = new Set(
    columnasNotificacion.map((columna) => columna.COLUMN_NAME),
  )

  if (!nombresColumnasNotificacion.has('id_cita')) {
    await connection.query(
      `ALTER TABLE notificaciones
       ADD COLUMN id_cita INT UNSIGNED NULL AFTER id_paciente,
       ADD CONSTRAINT fk_notificaciones_cita
         FOREIGN KEY (id_cita) REFERENCES citas(id_cita)
         ON DELETE CASCADE`,
    )
  }

  if (!nombresColumnasNotificacion.has('clave_evento')) {
    await connection.query(
      `ALTER TABLE notificaciones
       ADD COLUMN clave_evento VARCHAR(190) NULL UNIQUE AFTER tipo`,
    )
  }

  await connection.query(
    `CREATE TABLE IF NOT EXISTS notificacion_envios (
      id_envio INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      id_notificacion INT UNSIGNED NOT NULL,
      canal ENUM('correo', 'whatsapp') NOT NULL,
      destino VARCHAR(190) NOT NULL,
      asunto VARCHAR(190) NULL,
      mensaje TEXT NOT NULL,
      enlace VARCHAR(700) NULL,
      estado ENUM('preparado', 'enviado', 'fallido') NOT NULL DEFAULT 'preparado',
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_envio TIMESTAMP NULL,
      error_envio VARCHAR(500) NULL,
      CONSTRAINT fk_envios_notificacion
        FOREIGN KEY (id_notificacion) REFERENCES notificaciones(id_notificacion)
        ON DELETE CASCADE
    )`,
  )

  await connection.query(
    `ALTER TABLE citas MODIFY COLUMN estado ENUM(
      'pendiente', 'confirmada', 'reprogramada', 'cancelada', 'completada',
      'rechazada', 'vencida'
    ) NOT NULL DEFAULT 'pendiente'`,
  )

  const [columnasConsentimiento] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pacientes'
       AND COLUMN_NAME = 'consentimiento_fecha'`,
    [process.env.DB_NAME],
  )

  if (columnasConsentimiento.length === 0) {
    await connection.query(
      `ALTER TABLE pacientes
       ADD COLUMN consentimiento_fecha DATETIME NULL AFTER direccion,
       ADD COLUMN consentimiento_version VARCHAR(20) NULL
         AFTER consentimiento_fecha`,
    )
  }

  await connection.query(
    `CREATE TABLE IF NOT EXISTS bitacora_accesos (
      id_bitacora BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      id_usuario INT UNSIGNED NOT NULL,
      usuario VARCHAR(201) NOT NULL,
      rol VARCHAR(20) NOT NULL,
      accion VARCHAR(50) NOT NULL,
      id_paciente INT UNSIGNED NULL,
      detalle VARCHAR(255) NULL,
      ip VARCHAR(45) NULL,
      fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bitacora_fecha (fecha),
      INDEX idx_bitacora_paciente (id_paciente)
    )`,
  )

  for (const [nombre, descripcion] of especialidades) {
    await connection.execute(
      `INSERT INTO especialidades (nombre, descripcion, estado)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE id_especialidad = id_especialidad`,
      [nombre, descripcion],
    )
  }

  const passwordHash = await bcrypt.hash(passwordDemo, 12)

  for (const medico of medicosIniciales) {
    await connection.execute(
      `INSERT INTO usuarios
        (nombres, apellidos, dni, correo, telefono, password_hash, rol, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'medico', 1)
       ON DUPLICATE KEY UPDATE id_usuario = id_usuario`,
      [
        medico.nombres,
        medico.apellidos,
        medico.dni,
        medico.correo,
        medico.telefono,
        passwordHash,
      ],
    )

    const [[usuario]] = await connection.execute(
      'SELECT id_usuario FROM usuarios WHERE dni = ?',
      [medico.dni],
    )
    const [[especialidad]] = await connection.execute(
      'SELECT id_especialidad FROM especialidades WHERE nombre = ?',
      [medico.especialidad],
    )

    await connection.execute(
      `INSERT INTO medicos (id_usuario, id_especialidad, cmp)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE id_medico = id_medico`,
      [usuario.id_usuario, especialidad.id_especialidad, medico.cmp],
    )

    const [[medicoCreado]] = await connection.execute(
      'SELECT id_medico FROM medicos WHERE id_usuario = ?',
      [usuario.id_usuario],
    )

    for (let dia = 1; dia <= 6; dia += 1) {
      const [disponibilidad] = await connection.execute(
        `SELECT id_disponibilidad
         FROM disponibilidad_medica
         WHERE id_medico = ? AND dia_semana = ? LIMIT 1`,
        [medicoCreado.id_medico, dia],
      )

      if (disponibilidad.length === 0) {
        await connection.execute(
          `INSERT INTO disponibilidad_medica
            (id_medico, dia_semana, hora_inicio, hora_fin, duracion_minutos)
           VALUES (?, ?, '08:00:00', '17:00:00', 30)`,
          [medicoCreado.id_medico, dia],
        )
      }
    }
  }

  await connection.execute(
    `INSERT INTO usuarios
      (nombres, apellidos, dni, correo, telefono, password_hash, rol, estado)
     VALUES ('Administrador', 'MediLink', '70000000', 'admin@medilink.pe',
       '900000000', ?, 'administrador', 1)
     ON DUPLICATE KEY UPDATE id_usuario = id_usuario`,
    [passwordHash],
  )

  if (process.env.DEMO_DATA === 'true') {
    for (const persona of pacientesDemo) {
      await connection.execute(
        `INSERT INTO usuarios
          (nombres, apellidos, dni, correo, telefono, password_hash, rol, estado)
         VALUES (?, ?, ?, ?, ?, ?, 'paciente', 1)
         ON DUPLICATE KEY UPDATE id_usuario = id_usuario`,
        [
          persona.nombres,
          persona.apellidos,
          persona.dni,
          persona.correo,
          persona.telefono,
          passwordHash,
        ],
      )

      const [[usuario]] = await connection.execute(
        'SELECT id_usuario FROM usuarios WHERE dni = ?',
        [persona.dni],
      )

      await connection.execute(
        `INSERT INTO pacientes
          (id_usuario, consentimiento_fecha, consentimiento_version)
         VALUES (?, NOW(), ?)
         ON DUPLICATE KEY UPDATE id_paciente = id_paciente`,
        [usuario.id_usuario, VERSION_AVISO_PRIVACIDAD],
      )

      const [[{ id_paciente: idPaciente }]] = await connection.execute(
        'SELECT id_paciente FROM pacientes WHERE id_usuario = ?',
        [usuario.id_usuario],
      )
      const [citasActivas] = await connection.execute(
        `SELECT id_cita FROM citas
         WHERE id_paciente = ? AND fecha >= CURDATE()
           AND estado IN ('pendiente', 'confirmada', 'reprogramada')
         LIMIT 1`,
        [idPaciente],
      )

      // Cada despliegue repone las citas si las anteriores ya pasaron.
      if (citasActivas.length === 0) {
        for (const cita of persona.citas) {
          await connection.execute(
            `INSERT IGNORE INTO citas
              (id_paciente, id_medico, fecha, hora, motivo, estado)
             SELECT ?, m.id_medico, ?, ?, ?, ?
             FROM medicos m
             INNER JOIN especialidades e ON e.id_especialidad = m.id_especialidad
             WHERE e.nombre = ?
             LIMIT 1`,
            [
              idPaciente,
              fechaAtencion(cita.dias),
              cita.hora,
              cita.motivo,
              cita.estado,
              cita.especialidad,
            ],
          )
        }
      }
    }
  }

  await connection.commit()
  const [[medicoGeneral]] = await connection.execute(
    `SELECT m.id_medico, CONCAT(u.nombres, ' ', u.apellidos) AS nombre
     FROM medicos m
     INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
     INNER JOIN especialidades e ON e.id_especialidad = m.id_especialidad
     WHERE e.nombre = 'Medicina General'
     LIMIT 1`,
  )
  const [pacientes] = await connection.execute(
    `SELECT
      p.id_paciente,
      CONCAT(u.nombres, ' ', u.apellidos) AS nombre
     FROM pacientes p
     INNER JOIN usuarios u ON u.id_usuario = p.id_usuario`,
  )

  for (const paciente of pacientes) {
    const [notificacionesBienvenida] = await connection.execute(
      `SELECT id_notificacion
       FROM notificaciones
       WHERE id_paciente = ? AND tipo = 'sistema'
         AND mensaje = 'Bienvenido a MediLink. Tu cuenta fue creada correctamente.'
       LIMIT 1`,
      [paciente.id_paciente],
    )

    if (notificacionesBienvenida.length === 0) {
      await connection.execute(
        `INSERT INTO notificaciones (id_paciente, tipo, mensaje)
         VALUES (?, 'sistema', 'Bienvenido a MediLink. Tu cuenta fue creada correctamente.')`,
        [paciente.id_paciente],
      )
    }

    const [historialExistente] = await connection.execute(
      `SELECT id_historial
       FROM historial_medico
       WHERE id_paciente = ? AND descripcion = 'Chequeo general de demostración'
       LIMIT 1`,
      [paciente.id_paciente],
    )

    let idHistorial = historialExistente[0]?.id_historial

    if (!idHistorial) {
      const [cita] = await connection.execute(
        `INSERT INTO citas
          (id_paciente, id_medico, fecha, hora, motivo, estado)
         VALUES (?, ?, '2026-05-15', '10:00:00', ?, 'completada')`,
        [
          paciente.id_paciente,
          medicoGeneral.id_medico,
          'Chequeo preventivo anual',
        ],
      )
      const [historial] = await connection.execute(
        `INSERT INTO historial_medico
          (id_paciente, id_medico, id_cita, fecha_consulta, descripcion,
           diagnostico, observaciones)
         VALUES (?, ?, ?, '2026-05-15 10:00:00', ?, ?, ?)`,
        [
          paciente.id_paciente,
          medicoGeneral.id_medico,
          cita.insertId,
          'Chequeo general de demostración',
          'Paciente estable, sin hallazgos de alarma.',
          'Mantener hábitos saludables y realizar control anual.',
        ],
      )
      idHistorial = historial.insertId
    }

    const [recetasExistentes] = await connection.execute(
      'SELECT id_receta FROM recetas WHERE id_historial = ? LIMIT 1',
      [idHistorial],
    )
    let idReceta = recetasExistentes[0]?.id_receta

    if (!idReceta) {
      const [receta] = await connection.execute(
        `INSERT INTO recetas (id_historial, fecha_emision, indicaciones_generales)
         VALUES (?, '2026-05-15 10:30:00', ?)`,
        [idHistorial, 'Usar únicamente si presenta dolor o fiebre.'],
      )
      idReceta = receta.insertId
      await connection.execute(
        `INSERT INTO detalle_receta
          (id_receta, medicamento, dosis, frecuencia, duracion, indicacion)
         VALUES (?, 'Paracetamol', '500 mg', 'Cada 8 horas', '3 días',
           'Tomar después de los alimentos si fuera necesario.')`,
        [idReceta],
      )
    }

    const [resultadosExistentes] = await connection.execute(
      `SELECT id_resultado
       FROM resultados_laboratorio
       WHERE id_paciente = ? AND id_historial = ? LIMIT 1`,
      [paciente.id_paciente, idHistorial],
    )
    let idResultado = resultadosExistentes[0]?.id_resultado

    if (!idResultado) {
      const [resultado] = await connection.execute(
        `INSERT INTO resultados_laboratorio
          (id_paciente, id_historial, nombre_examen, resultado,
           fecha_resultado, estado)
         VALUES (?, ?, 'Hemograma completo',
           'Valores dentro del rango normal.', '2026-05-15', 'disponible')`,
        [paciente.id_paciente, idHistorial],
      )
      idResultado = resultado.insertId
    }

    const documentos = [
      {
        tipo: 'informe',
        nombreOriginal: 'informe-consulta.pdf',
        nombreArchivo: `paciente-${paciente.id_paciente}-informe-${idHistorial}.pdf`,
        idReceta: null,
        idResultado: null,
        titulo: 'Informe de consulta médica',
        secciones: [
          {
            titulo: 'Descripción',
            contenido: 'Chequeo general preventivo anual.',
          },
          {
            titulo: 'Diagnóstico',
            contenido: 'Paciente estable, sin hallazgos de alarma.',
          },
          {
            titulo: 'Observaciones',
            contenido: 'Mantener hábitos saludables y realizar control anual.',
          },
        ],
      },
      {
        tipo: 'receta',
        nombreOriginal: 'receta-digital.pdf',
        nombreArchivo: `paciente-${paciente.id_paciente}-receta-${idReceta}.pdf`,
        idReceta,
        idResultado: null,
        titulo: 'Receta digital',
        secciones: [
          {
            titulo: 'Medicamento',
            contenido: 'Paracetamol 500 mg.',
          },
          {
            titulo: 'Indicaciones',
            contenido:
              'Tomar cada 8 horas durante 3 días, después de los alimentos, solo si presenta dolor o fiebre.',
          },
        ],
      },
      {
        tipo: 'resultado',
        nombreOriginal: 'resultado-hemograma.pdf',
        nombreArchivo: `paciente-${paciente.id_paciente}-resultado-${idResultado}.pdf`,
        idReceta: null,
        idResultado,
        titulo: 'Resultado de laboratorio',
        secciones: [
          {
            titulo: 'Examen',
            contenido: 'Hemograma completo.',
          },
          {
            titulo: 'Resultado',
            contenido: 'Valores dentro del rango normal.',
          },
        ],
      },
    ]

    for (const documento of documentos) {
      const contenido = await crearPdfMedico({
        titulo: documento.titulo,
        paciente: paciente.nombre,
        medico: medicoGeneral.nombre,
        fecha: '15 de mayo de 2026',
        secciones: documento.secciones,
      })

      await connection.execute(
        `INSERT INTO documentos_medicos
          (id_paciente, id_historial, id_receta, id_resultado, tipo,
           nombre_original, nombre_archivo, contenido, mime_type,
           tamano_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'application/pdf', ?)
         ON DUPLICATE KEY UPDATE
           nombre_original = VALUES(nombre_original),
           contenido = VALUES(contenido),
           ruta_relativa = NULL,
           tamano_bytes = VALUES(tamano_bytes)`,
        [
          paciente.id_paciente,
          idHistorial,
          documento.idReceta,
          documento.idResultado,
          documento.tipo,
          documento.nombreOriginal,
          documento.nombreArchivo,
          contenido,
          contenido.length,
        ],
      )
    }
  }

  console.log(
    'Base actualizada; catálogo médico, historial y PDFs de demostración creados.',
  )
} catch (error) {
  await connection.rollback()
  console.error('No se pudo preparar la base de datos:', error.message)
  process.exitCode = 1
} finally {
  await connection.end()
}
