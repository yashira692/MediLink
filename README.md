# MediLink - Perfil Paciente

Aplicación web del perfil paciente de MediLink. Incluye frontend React, API
Express y persistencia MySQL.

## Requisitos

- Node.js 20 o superior.
- MySQL 8.

## Configuración inicial

1. Instala las dependencias:

   ```powershell
   npm.cmd install
   ```

2. Crea la base de datos desde MySQL Workbench:

   - Abre MySQL Workbench.
   - Conéctate a tu servidor local.
   - Abre el archivo `database/schema.sql`.
   - Ejecuta todo el script.

3. Copia `.env.example` como `.env` y completa `DB_PASSWORD` con la contraseña
   de tu MySQL. Cambia también `JWT_SECRET` por una frase larga y privada.

4. Prepara el catálogo inicial de especialidades, médicos y horarios:

   ```powershell
   npm.cmd run db:setup
   ```

5. Inicia frontend y backend:

   ```powershell
   npm.cmd run dev
   ```

6. Abre `http://localhost:5173` y registra una cuenta de paciente.

## Comandos

- `npm.cmd run dev`: inicia frontend y API.
- `npm.cmd run db:setup`: actualiza el esquema y crea el catálogo médico inicial.
- `npm.cmd run build`: genera la versión de producción del frontend.
- `npm.cmd run lint`: comprueba la calidad del código.
- `npm.cmd start`: inicia solamente la API.

## Estructura

- `src/`: interfaz React.
- `server/`: API REST con Express y autenticación JWT.
- `database/schema.sql`: estructura inicial de MySQL.
- `storage/medical-documents/`: PDFs médicos privados, fuera de Git y de la
  carpeta pública del frontend.

El archivo `.env` contiene información privada y no se incluye en Git.

## Perfil médico

Los médicos inician sesión en la misma pantalla que los pacientes y la app los
lleva a su panel según el rol. Desde allí pueden:

- Ver la agenda por día o por semana.
- Aprobar, reprogramar o cancelar citas; el paciente recibe una notificación.
- Registrar la consulta (el día de la cita o después), con diagnóstico y receta
  opcional. Se generan los PDF y la cita pasa a `completada`.
- Consultar el historial solo de los pacientes con los que tienen citas.
- Subir un PDF de hasta 10 MB al historial del paciente: un resultado de
  laboratorio, o el informe o la receta de una consulta propia. El paciente
  recibe un aviso. Si ya había un informe o receta, descarga el PDF más reciente.
  Los archivos se guardan en `storage/`, que no pasa a otro equipo con Git.

`npm.cmd run db:setup` crea cuatro médicos de demostración, por ejemplo
`emily.roberts@medilink.pe`, con la contraseña `Medilink2026!`. Son solo para
desarrollo y no deben usarse en producción.

Con la API iniciada, `node server/scripts/testMedico.js` prueba este perfil.

## Panel de administrador

El administrador usa la misma pantalla de inicio de sesión. Desde su panel puede:

- Ver el dashboard del mes: citas, atendidas, canceladas, por atender, pacientes,
  médicos y especialidades más demandadas.
- Agregar, editar, desactivar y activar médicos. Un médico nuevo atiende de lunes
  a sábado de 8:00 a 17:00.
- Agregar, editar, desactivar y activar especialidades.
- Generar reportes de citas por período, médico o especialidad, y descargarlos
  en PDF o Excel. Los reportes no incluyen el motivo de consulta.

Un médico con citas por atender o una especialidad con médicos activos no se
puede desactivar.

`npm.cmd run db:setup` crea la cuenta de demostración `admin@medilink.pe`, con la
contraseña `Medilink2026!`. No debe usarse en producción.

Con la API iniciada, `node server/scripts/testAdministrador.js` prueba este panel.

## Documentos médicos

Los informes, recetas y resultados se registran en `documentos_medicos`. La API
comprueba que el documento pertenezca al paciente autenticado antes de permitir
su descarga. En el futuro, el perfil médico podrá subir PDFs y asociarlos a una
consulta, receta o resultado utilizando esta misma estructura.

## Notificaciones

Las notificaciones se almacenan en MySQL y se generan al registrar una cuenta,
reservar, cancelar o reprogramar una cita y actualizar el perfil. La campana
muestra únicamente la cantidad pendiente y el paciente puede marcar cada aviso
o todos los avisos como leídos.

El servidor revisa al iniciar y cada 15 minutos las citas de los próximos 30
minutos, así que el aviso llega entre 15 y 30 minutos antes de la cita. Genera
un recordatorio único por cita y horario; cancelar o
reprogramar elimina el recordatorio anterior pendiente.

## Asistente virtual

El asistente funciona desde el backend, consulta las especialidades activas y
guarda el historial en `chatbot_consultas`. Sus respuestas están limitadas a
orientación sobre el uso del sistema y selección general de especialidades; no
realiza diagnósticos, no receta medicamentos y redirige las posibles
emergencias a atención inmediata.

Dialogflow se integra únicamente desde el backend mediante credenciales
privadas de Google Cloud, nunca desde el frontend.

### Dialogflow ES

La integración con Dialogflow se activa mediante:

```env
DIALOGFLOW_PROJECT_ID=medilink-tesis
DIALOGFLOW_LANGUAGE_CODE=es
DIALOGFLOW_ENABLED=true
```

El backend usa Application Default Credentials de Google Cloud y
`@google-cloud/dialogflow`. Las consultas normales se envían a Dialogflow; si
el agente usa su intención de fallback, no tiene respuesta o el servicio falla,
MediLink conserva el motor local como respaldo. Las emergencias y solicitudes
de diagnóstico, medicación o dosis se interceptan localmente antes de consultar
Dialogflow.

## Privacidad y bitácora

- Registrarse exige aceptar el aviso de privacidad; se guarda la fecha y la
  versión. Las cuentas anteriores lo ven al iniciar sesión.
- La bitácora guarda qué hicieron médicos y administradores con datos de
  pacientes: ver historiales, descargar y subir documentos, registrar consultas,
  cambiar citas y generar reportes. El administrador la consulta en su panel.
  No hay rutas para editarla ni borrarla.
- La API usa `helmet` y límites de solicitudes: 600 por minuto en general y 100
  cada 15 minutos en autenticación.

Para usar datos reales de pacientes aún hace falta HTTPS, cifrado de la base y
de `storage/`, respaldos, un usuario de MySQL con permisos limitados, cambiar
las contraseñas de demostración, `NODE_ENV=production` y revisión legal del
aviso según la Ley 29733.

## Seguridad de la cuenta

- Las contraseñas requieren al menos 8 caracteres, una mayúscula, una minúscula
  y un número.
- El paciente puede cambiar su contraseña desde `Mi perfil`.
- Los enlaces de recuperación vencen después de 30 minutos, se guardan como
  hash y solo pueden utilizarse una vez.
- Cambiar o restablecer la contraseña invalida las sesiones anteriores.
- Después de varios intentos fallidos, el inicio de sesión se bloquea
  temporalmente.

En desarrollo, el enlace de recuperación se muestra en la propia pantalla para
permitir pruebas locales. En producción debe enviarse por correo mediante un
proveedor como SendGrid, Resend o Amazon SES y nunca devolverse al navegador.
