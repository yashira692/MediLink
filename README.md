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

El servidor revisa al iniciar y cada 15 minutos las citas previstas para las
próximas 24 horas. Genera un recordatorio único por cita y horario; cancelar o
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
