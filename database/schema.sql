CREATE DATABASE IF NOT EXISTS medilink
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE medilink;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  dni CHAR(8) NOT NULL UNIQUE,
  correo VARCHAR(150) NOT NULL UNIQUE,
  telefono VARCHAR(15) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  rol ENUM('paciente', 'medico', 'administrador') NOT NULL DEFAULT 'paciente',
  estado TINYINT(1) NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pacientes (
  id_paciente INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT UNSIGNED NOT NULL UNIQUE,
  fecha_nacimiento DATE NULL,
  direccion VARCHAR(255) NULL,
  CONSTRAINT fk_pacientes_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS especialidades (
  id_especialidad INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion VARCHAR(255) NULL,
  estado TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS medicos (
  id_medico INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT UNSIGNED NOT NULL UNIQUE,
  id_especialidad INT UNSIGNED NOT NULL,
  cmp VARCHAR(20) NOT NULL UNIQUE,
  CONSTRAINT fk_medicos_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_medicos_especialidad
    FOREIGN KEY (id_especialidad) REFERENCES especialidades(id_especialidad)
);

CREATE TABLE IF NOT EXISTS disponibilidad_medica (
  id_disponibilidad INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_medico INT UNSIGNED NOT NULL,
  dia_semana TINYINT UNSIGNED NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  duracion_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  estado TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT chk_dia_semana CHECK (dia_semana BETWEEN 1 AND 7),
  CONSTRAINT chk_rango_horario CHECK (hora_inicio < hora_fin),
  CONSTRAINT fk_disponibilidad_medico
    FOREIGN KEY (id_medico) REFERENCES medicos(id_medico)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS citas (
  id_cita INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT UNSIGNED NOT NULL,
  id_medico INT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  motivo VARCHAR(500) NOT NULL,
  estado ENUM(
    'pendiente',
    'confirmada',
    'reprogramada',
    'cancelada',
    'completada',
    'rechazada'
  ) NOT NULL DEFAULT 'pendiente',
  motivo_cancelacion VARCHAR(500) NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  reserva_activa TINYINT
    GENERATED ALWAYS AS (
      CASE
        WHEN estado IN ('pendiente', 'confirmada', 'reprogramada') THEN 1
        ELSE NULL
      END
    ) STORED,
  UNIQUE KEY uq_cita_medico_horario (
    id_medico,
    fecha,
    hora,
    reserva_activa
  ),
  CONSTRAINT fk_citas_paciente
    FOREIGN KEY (id_paciente) REFERENCES pacientes(id_paciente),
  CONSTRAINT fk_citas_medico
    FOREIGN KEY (id_medico) REFERENCES medicos(id_medico)
);

CREATE TABLE IF NOT EXISTS historial_medico (
  id_historial INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT UNSIGNED NOT NULL,
  id_medico INT UNSIGNED NOT NULL,
  id_cita INT UNSIGNED NOT NULL UNIQUE,
  fecha_consulta DATETIME NOT NULL,
  descripcion TEXT NULL,
  diagnostico TEXT NOT NULL,
  observaciones TEXT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_historial_paciente
    FOREIGN KEY (id_paciente) REFERENCES pacientes(id_paciente),
  CONSTRAINT fk_historial_medico
    FOREIGN KEY (id_medico) REFERENCES medicos(id_medico),
  CONSTRAINT fk_historial_cita
    FOREIGN KEY (id_cita) REFERENCES citas(id_cita)
);

CREATE TABLE IF NOT EXISTS recetas (
  id_receta INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_historial INT UNSIGNED NOT NULL,
  fecha_emision DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  indicaciones_generales TEXT NULL,
  CONSTRAINT fk_recetas_historial
    FOREIGN KEY (id_historial) REFERENCES historial_medico(id_historial)
);

CREATE TABLE IF NOT EXISTS detalle_receta (
  id_detalle INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_receta INT UNSIGNED NOT NULL,
  medicamento VARCHAR(150) NOT NULL,
  dosis VARCHAR(100) NOT NULL,
  frecuencia VARCHAR(100) NOT NULL,
  duracion VARCHAR(100) NOT NULL,
  indicacion TEXT NULL,
  CONSTRAINT fk_detalle_receta
    FOREIGN KEY (id_receta) REFERENCES recetas(id_receta)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resultados_laboratorio (
  id_resultado INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT UNSIGNED NOT NULL,
  id_historial INT UNSIGNED NULL,
  nombre_examen VARCHAR(150) NOT NULL,
  resultado TEXT NULL,
  fecha_resultado DATE NOT NULL,
  estado ENUM('pendiente', 'disponible', 'revisado') NOT NULL DEFAULT 'pendiente',
  CONSTRAINT fk_resultados_paciente
    FOREIGN KEY (id_paciente) REFERENCES pacientes(id_paciente),
  CONSTRAINT fk_resultados_historial
    FOREIGN KEY (id_historial) REFERENCES historial_medico(id_historial)
);

CREATE TABLE IF NOT EXISTS documentos_medicos (
  id_documento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT UNSIGNED NOT NULL,
  id_historial INT UNSIGNED NULL,
  id_receta INT UNSIGNED NULL,
  id_resultado INT UNSIGNED NULL,
  tipo ENUM('informe', 'receta', 'resultado') NOT NULL,
  nombre_original VARCHAR(255) NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL UNIQUE,
  ruta_relativa VARCHAR(500) NOT NULL,
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
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id_notificacion INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT UNSIGNED NOT NULL,
  id_cita INT UNSIGNED NULL,
  tipo ENUM('cita', 'receta', 'resultado', 'sistema') NOT NULL DEFAULT 'sistema',
  clave_evento VARCHAR(190) NULL UNIQUE,
  mensaje TEXT NOT NULL,
  leido TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_lectura TIMESTAMP NULL,
  CONSTRAINT fk_notificaciones_paciente
    FOREIGN KEY (id_paciente) REFERENCES pacientes(id_paciente)
    ON DELETE CASCADE,
  CONSTRAINT fk_notificaciones_cita
    FOREIGN KEY (id_cita) REFERENCES citas(id_cita)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chatbot_consultas (
  id_chatbot INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT UNSIGNED NOT NULL,
  pregunta TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  intent_detectado VARCHAR(150) NULL,
  proveedor ENUM('local', 'dialogflow') NOT NULL DEFAULT 'local',
  confianza DECIMAL(5,4) NULL,
  fecha_consulta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chatbot_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recuperacion_password (
  id_recuperacion INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  fecha_expiracion DATETIME NOT NULL,
  usado TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recuperacion_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE CASCADE
);
