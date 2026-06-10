const C = {
  navy: "#0B2B4F",
  blue: "#287DBA",
  blue2: "#5AA5D8",
  pale: "#EAF4FC",
  pale2: "#F5FAFE",
  ink: "#173A5E",
  muted: "#637D99",
  white: "#FFFFFF",
  green: "#1A8B64",
  greenPale: "#E8F7F1",
  red: "#CB3B46",
  redPale: "#FDEBED",
  amber: "#E6A12A",
  amberPale: "#FFF4DA",
  line: "#CFE0EE",
};

const A = "C:/Users/hp/Desktop/medilink-paciente/outputs/manual-20260610-medilink/presentations/sustentacion-medilink/assets";

function rect(ctx, slide, x, y, w, h, fill, radius = 0, line = "#00000000", width = 0) {
  const s = ctx.addShape(slide, {
    left: x, top: y, width: w, height: h,
    geometry: "rect", fill, line: ctx.line(line, width),
  });
  if (radius) s.borderRadius = radius;
  return s;
}

function text(ctx, slide, value, x, y, w, h, size = 24, color = C.ink, bold = false, align = "left", valign = "top") {
  return ctx.addText(slide, {
    text: value, left: x, top: y, width: w, height: h,
    fontSize: size, color, bold, align, valign,
    insets: { left: 0, right: 0, top: 0, bottom: 0 },
  });
}

function title(ctx, slide, value, kicker) {
  if (kicker) text(ctx, slide, kicker.toUpperCase(), 64, 34, 500, 24, 14, C.blue, true);
  text(ctx, slide, value, 64, 66, 1120, 52, 34, C.navy, true);
  rect(ctx, slide, 64, 126, 78, 5, C.blue, 3);
}

function footer(ctx, slide, n, label = "MediLink") {
  text(ctx, slide, label, 64, 680, 300, 18, 11, C.muted, false);
  text(ctx, slide, String(n).padStart(2, "0"), 1160, 680, 56, 18, 11, C.muted, true, "right");
}

function pill(ctx, slide, value, x, y, w, fill = C.pale, color = C.blue) {
  rect(ctx, slide, x, y, w, 34, fill, 17);
  text(ctx, slide, value, x + 12, y + 8, w - 24, 18, 13, color, true, "center");
}

function card(ctx, slide, x, y, w, h, options = {}) {
  const s = rect(ctx, slide, x, y, w, h, options.fill ?? C.white, options.radius ?? 18, options.line ?? C.line, options.lineWidth ?? 1);
  return s;
}

function iconCircle(ctx, slide, label, x, y, fill = C.blue, color = C.white) {
  const s = rect(ctx, slide, x, y, 52, 52, fill, 26);
  text(ctx, slide, label, x, y + 12, 52, 24, 20, color, true, "center");
  return s;
}

function bullet(ctx, slide, value, x, y, w, color = C.ink, dot = C.blue, size = 18) {
  rect(ctx, slide, x, y + 7, 8, 8, dot, 4);
  text(ctx, slide, value, x + 20, y, w - 20, 38, size, color, false);
}

function browserFrame(ctx, slide, x, y, w, h) {
  card(ctx, slide, x, y, w, h, { fill: C.white, radius: 16, line: C.line, shadow: true });
  rect(ctx, slide, x, y, w, 32, "#E9EFF5", 16);
  rect(ctx, slide, x, y + 16, w, 16, "#E9EFF5");
  for (let i = 0; i < 3; i++) rect(ctx, slide, x + 15 + i * 17, y + 11, 8, 8, ["#EE6B65", "#F2C14E", "#60B878"][i], 4);
}

function connect(slide, a, b, color = C.blue) {
  const line = slide.shapes.connect(a, b, {
    kind: "straight",
    line: { style: "solid", fill: color, width: 3 },
  });
  return line;
}

function node(ctx, slide, label, sub, x, y, w, h, fill = C.white, accent = C.blue) {
  const s = card(ctx, slide, x, y, w, h, { fill, radius: 16, line: C.line, shadow: false });
  rect(ctx, slide, x, y, 7, h, accent, 4);
  text(ctx, slide, label, x + 22, y + 17, w - 34, 25, 18, C.navy, true);
  if (sub) text(ctx, slide, sub, x + 22, y + 49, w - 34, h - 70, 13, C.muted);
  return s;
}

function addNotes(slide, notes) {
  slide.speakerNotes.setText(notes);
}

async function cover(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.navy;
  rect(ctx, s, 0, 0, 1280, 720, C.navy);
  rect(ctx, s, 850, 0, 430, 440, "#174C78", 220);
  rect(ctx, s, 1000, 390, 280, 330, "#216897", 150);
  pill(ctx, s, "PROYECTO DE INVESTIGACIÓN APLICADA", 70, 62, 315, "#1D5A86", "#D8EEFF");
  text(ctx, s, "MediLink", 70, 150, 760, 86, 58, C.white, true);
  text(ctx, s, "Sistema de gestión para clínicas y consultorios médicos con asistente virtual inteligente", 70, 245, 760, 150, 28, "#D8EAF7", false);
  rect(ctx, s, 70, 420, 680, 1, "#5C8EB0");
  text(ctx, s, "Yashira Massiel Rojas Alarcón", 70, 456, 650, 34, 22, C.white, true);
  text(ctx, s, "Diseño y Desarrollo de Software · TECSUP", 70, 500, 650, 28, 17, "#BFD9EB");
  text(ctx, s, "Asesor: Juan León", 70, 540, 500, 25, 15, "#BFD9EB");
  text(ctx, s, "Perfil demostrado: Paciente", 890, 555, 270, 30, 18, C.white, true, "center");
  text(ctx, s, "Aplicación web funcional", 890, 590, 270, 26, 14, "#D8EAF7", false, "center");
  addNotes(s, "Presentar MediLink como proyecto de investigación aplicada. Aclarar desde el inicio que la demostración funcional corresponde al perfil paciente.");
  return s;
}

async function problem(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.pale2;
  title(ctx, s, "La atención fragmentada genera demoras y pérdida de información", "Problemática");
  card(ctx, s, 64, 165, 470, 445, { fill: C.navy, radius: 22, line: C.navy });
  text(ctx, s, "Situación observada", 96, 196, 360, 30, 21, C.white, true);
  text(ctx, s, "Consultorios pequeños y medianos dependen de llamadas, agendas manuales y documentos dispersos.", 96, 246, 365, 120, 22, "#D6E8F6");
  rect(ctx, s, 96, 398, 110, 4, C.blue2, 2);
  text(ctx, s, "Resultado", 96, 430, 200, 24, 15, "#9CC8E7", true);
  text(ctx, s, "Menor trazabilidad, más carga administrativa y una experiencia deficiente para el paciente.", 96, 462, 365, 100, 20, C.white, true);
  const issues = [
    ["01", "Reserva manual", "Confusión, cruces de horario y espera innecesaria."],
    ["02", "Historial disperso", "Acceso lento a antecedentes, recetas y resultados."],
    ["03", "Sin orientación digital", "El paciente no sabe cómo prepararse o qué especialidad elegir."],
    ["04", "Seguimiento limitado", "No existen recordatorios ni acceso posterior a documentos."],
  ];
  issues.forEach((it, i) => {
    const y = 165 + i * 108;
    iconCircle(ctx, s, it[0], 575, y + 10, i === 0 ? C.red : C.blue);
    text(ctx, s, it[1], 650, y + 8, 470, 27, 19, C.navy, true);
    text(ctx, s, it[2], 650, y + 40, 490, 50, 15, C.muted);
  });
  footer(ctx, s, 2, "Fuente: Tesis MediLink, capítulo I");
  addNotes(s, "Enfatizar que el problema no es solo reservar una cita: es la falta de integración de todo el recorrido del paciente.");
  return s;
}

async function objectives(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.white;
  title(ctx, s, "Centralizar el recorrido del paciente en una sola plataforma", "Objetivo y alcance");
  card(ctx, s, 64, 164, 1152, 116, { fill: C.pale, radius: 20, line: C.pale });
  text(ctx, s, "OBJETIVO GENERAL", 92, 188, 210, 22, 13, C.blue, true);
  text(ctx, s, "Desarrollar una aplicación web que integre citas, historial, documentos médicos, notificaciones y orientación inteligente.", 92, 218, 1070, 54, 21, C.navy, true);
  const cols = [
    ["Alcance funcional", ["Registro y autenticación segura", "Reserva, cancelación y reprogramación", "Historial, recetas y resultados PDF", "Notificaciones y asistente virtual"]],
    ["Alcance actual", ["Perfil paciente 100% funcional", "Aplicación web responsive", "Backend y base de datos reales", "Dialogflow integrado desde el servidor"]],
    ["Fuera de alcance", ["Videollamadas", "Validez legal DIGEMID", "Integración hospitalaria externa", "Despliegue en hospitales nacionales"]],
  ];
  cols.forEach((col, i) => {
    const x = 64 + i * 390;
    card(ctx, s, x, 320, 360, 290, { fill: i === 2 ? "#FFF9F3" : C.white, radius: 18, line: i === 2 ? "#F4D8B6" : C.line });
    text(ctx, s, col[0], x + 24, 346, 312, 30, 19, i === 2 ? "#A66A16" : C.navy, true);
    col[1].forEach((v, j) => bullet(ctx, s, v, x + 26, 394 + j * 49, 310, C.ink, i === 2 ? C.amber : C.blue, 15));
  });
  footer(ctx, s, 3);
  addNotes(s, "Aclarar que el documento conceptual contempla tres perfiles, pero el entregable funcional evaluado se concentra en paciente.");
  return s;
}

async function requirements(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.pale2;
  title(ctx, s, "Los requerimientos forman un flujo completo, no funciones aisladas", "Requerimientos principales");
  const items = [
    ["01", "Cuenta segura", "Registro, login JWT, recuperación y cambio de contraseña."],
    ["02", "Gestión de citas", "Consultar disponibilidad, reservar, cancelar y reprogramar."],
    ["03", "Información clínica", "Consultar historial, recetas, resultados y descargar PDF."],
    ["04", "Seguimiento", "Notificaciones, recordatorios automáticos y estados de cita."],
    ["05", "Asistente IA", "Orientación general con Dialogflow y límites clínicos."],
    ["06", "Perfil protegido", "Identidad bloqueada; correo, teléfono y dirección editables."],
  ];
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 64 + col * 576, y = 160 + row * 150;
    card(ctx, s, x, y, 544, 126, { fill: C.white, radius: 18, line: C.line, shadow: true });
    iconCircle(ctx, s, it[0], x + 22, y + 23, row === 2 ? C.green : C.blue);
    text(ctx, s, it[1], x + 92, y + 20, 420, 28, 19, C.navy, true);
    text(ctx, s, it[2], x + 92, y + 56, 420, 52, 15, C.muted);
  });
  footer(ctx, s, 4);
  addNotes(s, "Relacionar cada requisito con una parte de la demo. No leer la lista completa; explicar el recorrido.");
  return s;
}

async function journey(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.white;
  title(ctx, s, "El paciente gestiona su atención antes, durante y después de la cita", "Flujo de la solución");
  const stages = [
    ["1", "Acceso", "Registro e inicio de sesión"],
    ["2", "Orientación", "Asistente y especialidad"],
    ["3", "Reserva", "Médico, fecha y horario"],
    ["4", "Seguimiento", "Estados y recordatorios"],
    ["5", "Postconsulta", "Historial y documentos PDF"],
  ];
  const nodes = [];
  stages.forEach((st, i) => {
    const x = 54 + i * 242;
    const n = card(ctx, s, x, 220, 196, 230, { fill: i === 4 ? C.greenPale : C.pale2, radius: 20, line: i === 4 ? "#A9DCC8" : C.line });
    nodes.push(n);
    iconCircle(ctx, s, st[0], x + 72, 245, i === 4 ? C.green : C.blue);
    text(ctx, s, st[1], x + 18, 320, 160, 30, 19, C.navy, true, "center");
    text(ctx, s, st[2], x + 22, 362, 152, 58, 14, C.muted, false, "center");
  });
  for (let i = 0; i < nodes.length - 1; i++) connect(s, nodes[i], nodes[i + 1], C.blue2);
  card(ctx, s, 210, 505, 860, 94, { fill: C.navy, radius: 18, line: C.navy });
  text(ctx, s, "Valor generado", 240, 528, 140, 24, 14, "#9CC8E7", true);
  text(ctx, s, "Autonomía para el paciente + trazabilidad para el consultorio + menor carga administrativa", 400, 516, 640, 52, 19, C.white, true, "center");
  footer(ctx, s, 5);
  addNotes(s, "Usar esta diapositiva como puente hacia la arquitectura y posteriormente hacia la demo.");
  return s;
}

async function architecture(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.pale2;
  title(ctx, s, "Arquitectura de tres capas con integración segura de Dialogflow", "Arquitectura de despliegue");
  const client = node(ctx, s, "Navegador del paciente", "Interfaz React + Vite\nDiseño responsive", 70, 225, 270, 150, C.white, C.blue);
  const api = node(ctx, s, "API MediLink", "Node.js + Express\nAutenticación JWT\nReglas de negocio", 505, 205, 270, 190, C.white, C.navy);
  const db = node(ctx, s, "Base de datos", "MySQL 8\nUsuarios, citas, historial,\nrecetas y notificaciones", 940, 150, 270, 150, C.white, C.green);
  const docs = node(ctx, s, "Documentos privados", "PDF médicos protegidos\npor autorización", 940, 345, 270, 130, C.white, C.amber);
  const df = node(ctx, s, "Dialogflow ES", "Procesamiento de lenguaje natural\nCredenciales solo en backend", 505, 485, 270, 130, C.white, C.blue2);
  connect(s, client, api, C.blue);
  connect(s, api, db, C.green);
  connect(s, api, docs, C.amber);
  connect(s, api, df, C.blue2);
  pill(ctx, s, "HTTPS / REST", 356, 260, 130);
  pill(ctx, s, "SQL", 798, 205, 92, C.greenPale, C.green);
  pill(ctx, s, "API", 595, 425, 92);
  text(ctx, s, "La clave: React nunca accede directamente a MySQL ni a las credenciales de Google.", 130, 625, 1020, 34, 18, C.navy, true, "center");
  footer(ctx, s, 6);
  addNotes(s, "Explicar la separación de responsabilidades. Destacar que Dialogflow y los PDFs se consumen únicamente mediante el backend.");
  return s;
}

async function tools(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.white;
  title(ctx, s, "La selección tecnológica prioriza integración, soporte y mantenibilidad", "Evaluación de herramientas");
  const headers = ["Capa", "Seleccionada", "Alternativas", "Criterio decisivo"];
  const rows = [
    ["Frontend", "React", "Angular · Vue", "Componentes reutilizables y comunidad"],
    ["Backend", "Node + Express", "Django", "Un solo lenguaje y API REST ligera"],
    ["Datos", "MySQL", "PostgreSQL · MongoDB", "Modelo clínico relacional"],
    ["Asistente", "Dialogflow", "Rasa · Bot Framework", "Español e integración rápida"],
    ["Método", "Scrum", "Cascada", "Iteración y adaptación del alcance"],
  ];
  const xs = [64, 280, 510, 760], ws = [216, 230, 250, 456];
  headers.forEach((h, i) => {
    rect(ctx, s, xs[i], 165, ws[i], 50, C.navy);
    text(ctx, s, h, xs[i] + 14, 181, ws[i] - 28, 22, 15, C.white, true);
  });
  rows.forEach((r, ri) => {
    const y = 215 + ri * 74;
    r.forEach((v, ci) => {
      rect(ctx, s, xs[ci], y, ws[ci], 74, ri % 2 ? C.pale2 : C.white, 0, C.line, 1);
      text(ctx, s, v, xs[ci] + 14, y + 19, ws[ci] - 28, 42, ci === 1 ? 16 : 14, ci === 1 ? C.blue : C.ink, ci === 1);
    });
  });
  pill(ctx, s, "Resultado: stack coherente de extremo a extremo", 390, 618, 500, C.greenPale, C.green);
  footer(ctx, s, 7);
  addNotes(s, "Esta tabla resume la evaluación del capítulo II. No afirmar que una herramienta es universalmente mejor; explicar que fue adecuada para MediLink.");
  return s;
}

async function gantt(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.pale2;
  title(ctx, s, "La planificación organiza el desarrollo en 12 semanas y seis sprints", "Gantt y cronograma");
  const activities = [
    ["Análisis y alcance", 1, 2, C.navy],
    ["Diseño y entorno", 2, 3, C.blue2],
    ["Autenticación y perfil", 3, 4, C.blue],
    ["Reserva de citas", 4, 5, C.blue],
    ["Historial y recetas", 5, 6, C.green],
    ["Chatbot y notificaciones", 6, 7, C.green],
    ["Administración prevista", 7, 8, C.amber],
    ["Pruebas y correcciones", 8, 10, C.red],
    ["Documentación y entrega", 10, 12, C.navy],
  ];
  const gx = 390, cell = 66;
  for (let w = 1; w <= 12; w++) {
    text(ctx, s, `S${w}`, gx + (w - 1) * cell, 160, cell, 24, 12, C.muted, true, "center");
    rect(ctx, s, gx + (w - 1) * cell, 190, 1, 390, "#DCE8F1");
  }
  activities.forEach((a, i) => {
    const y = 200 + i * 43;
    text(ctx, s, a[0], 64, y + 7, 300, 24, 14, C.ink, i < 7);
    rect(ctx, s, gx + (a[1] - 1) * cell + 5, y + 4, (a[2] - a[1] + 1) * cell - 10, 28, a[3], 14);
  });
  rect(ctx, s, gx, 595, cell * 12, 1, C.line);
  text(ctx, s, "Avance demostrado", 64, 610, 170, 25, 15, C.green, true);
  text(ctx, s, "Perfil paciente funcional: autenticación, citas, historial, PDFs, notificaciones y asistente.", 250, 606, 900, 35, 17, C.navy, true);
  footer(ctx, s, 8);
  addNotes(s, "Explicar que el cronograma original cubre el sistema completo. Para la sustentación actual, el incremento terminado es el perfil paciente.");
  return s;
}

async function demoDashboard(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.navy;
  text(ctx, s, "DEMO 01", 64, 34, 180, 24, 14, "#8CC8EC", true);
  text(ctx, s, "Panel principal del paciente", 64, 68, 660, 48, 34, C.white, true);
  text(ctx, s, "Acceso rápido al recorrido completo y próximas citas.", 64, 122, 700, 30, 17, "#C7DEED");
  browserFrame(ctx, s, 64, 180, 850, 450);
  await ctx.addImage(s, { path: `${A}/demo-dashboard.png`, left: 72, top: 212, width: 834, height: 410, fit: "cover", alt: "Panel principal real de MediLink" });
  const facts = [
    ["✓", "Sesión protegida", "JWT y perfil paciente"],
    ["✓", "Navegación centralizada", "Citas, historial e IA"],
    ["✓", "Información útil", "Próximas citas visibles"],
  ];
  facts.forEach((f, i) => {
    iconCircle(ctx, s, f[0], 960, 205 + i * 125, C.green);
    text(ctx, s, f[1], 1025, 205 + i * 125, 210, 25, 17, C.white, true);
    text(ctx, s, f[2], 1025, 237 + i * 125, 210, 42, 14, "#BFD9EB");
  });
  footer(ctx, s, 9, "Captura real · localhost");
  addNotes(s, "Iniciar la demostración desde el panel principal. Señalar navegación, próxima cita y acceso al perfil.");
  return s;
}

async function demoCitas(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.white;
  title(ctx, s, "Reservar, cancelar y reprogramar sin intervención administrativa", "DEMO 02 · Gestión de citas");
  browserFrame(ctx, s, 64, 170, 800, 450);
  await ctx.addImage(s, { path: `${A}/demo-citas.png`, left: 72, top: 202, width: 784, height: 410, fit: "cover", alt: "Pantalla real de citas MediLink" });
  const steps = [
    ["1", "Consulta", "Médico, especialidad, fecha, hora y motivo."],
    ["2", "Control", "Estados visibles y confirmaciones integradas."],
    ["3", "Cambio", "Reprogramación según disponibilidad real."],
  ];
  steps.forEach((st, i) => {
    iconCircle(ctx, s, st[0], 925, 185 + i * 135, i === 2 ? C.green : C.blue);
    text(ctx, s, st[1], 990, 184 + i * 135, 220, 25, 17, C.navy, true);
    text(ctx, s, st[2], 990, 216 + i * 135, 205, 58, 14, C.muted);
  });
  footer(ctx, s, 10, "Captura real · módulo Mis citas");
  addNotes(s, "Durante la demo, reservar una cita y mostrar que los horarios ocupados no se duplican. Luego mostrar reprogramación o cancelación.");
  return s;
}

async function demoProfile(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.pale2;
  title(ctx, s, "El paciente actualiza datos de contacto sin alterar su identidad", "DEMO 03 · Perfil y seguridad");
  browserFrame(ctx, s, 64, 170, 790, 455);
  await ctx.addImage(s, { path: `${A}/demo-perfil.png`, left: 72, top: 202, width: 774, height: 415, fit: "cover", alt: "Perfil real del paciente MediLink" });
  card(ctx, s, 900, 185, 310, 200, { fill: C.greenPale, radius: 18, line: "#B8DECF" });
  text(ctx, s, "Editable", 925, 210, 250, 25, 17, C.green, true);
  bullet(ctx, s, "Correo electrónico", 925, 248, 245, C.ink, C.green, 15);
  bullet(ctx, s, "Teléfono celular", 925, 288, 245, C.ink, C.green, 15);
  bullet(ctx, s, "Dirección", 925, 328, 245, C.ink, C.green, 15);
  card(ctx, s, 900, 395, 310, 200, { fill: C.redPale, radius: 18, line: "#F0C1C6" });
  text(ctx, s, "Protegido", 925, 420, 250, 25, 17, C.red, true);
  bullet(ctx, s, "Nombres y apellidos", 925, 462, 245, C.ink, C.red, 15);
  bullet(ctx, s, "DNI", 925, 502, 245, C.ink, C.red, 15);
  bullet(ctx, s, "Fecha de nacimiento", 925, 542, 245, C.ink, C.red, 15);
  footer(ctx, s, 11, "Protección aplicada en interfaz y API");
  addNotes(s, "Explicar que el bloqueo no es solo visual: el backend ignora modificaciones manuales a identidad.");
  return s;
}

async function conclusion(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.navy;
  text(ctx, s, "CONCLUSIONES", 64, 42, 260, 24, 14, "#8CC8EC", true);
  text(ctx, s, "MediLink demuestra que el recorrido del paciente puede digitalizarse de extremo a extremo", 64, 84, 1080, 100, 34, C.white, true);
  const cs = [
    ["01", "Funcionalidad", "El perfil paciente integra cuenta, citas, historial, documentos, avisos y asistente."],
    ["02", "Arquitectura", "La separación React–Express–MySQL facilita seguridad, mantenimiento y expansión."],
    ["03", "Experiencia", "La autonomía del paciente reduce gestiones manuales y mejora la trazabilidad."],
  ];
  cs.forEach((v, i) => {
    const x = 64 + i * 390;
    card(ctx, s, x, 250, 355, 230, { fill: "#123B60", radius: 20, line: "#315C7E" });
    text(ctx, s, v[0], x + 24, 274, 70, 38, 27, "#70B9E4", true);
    text(ctx, s, v[1], x + 24, 330, 300, 30, 20, C.white, true);
    text(ctx, s, v[2], x + 24, 375, 300, 75, 15, "#C7DEED");
  });
  rect(ctx, s, 64, 530, 1135, 1, "#315C7E");
  text(ctx, s, "Recomendación", 64, 565, 150, 25, 15, "#8CC8EC", true);
  text(ctx, s, "Continuar con los perfiles médico y administrador, pruebas con usuarios reales y despliegue seguro en la nube.", 240, 557, 920, 55, 21, C.white, true);
  text(ctx, s, "Gracias", 64, 640, 200, 25, 15, "#8CC8EC", true);
  footer(ctx, s, 12);
  addNotes(s, "Cerrar remarcando el incremento funcional entregado y la ruta de evolución. Luego pasar a preguntas y usar los anexos cuando corresponda.");
  return s;
}

async function ishikawa(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.white;
  title(ctx, s, "Causas de una gestión médica manual y poco integrada", "ANEXO A · Ishikawa");
  rect(ctx, s, 215, 380, 765, 6, C.navy, 3);
  card(ctx, s, 970, 330, 250, 110, { fill: C.redPale, radius: 18, line: "#F0C1C6" });
  text(ctx, s, "Gestión de atención\nineficiente", 995, 354, 200, 60, 19, C.red, true, "center");
  const upper = [
    ["Personas", "Capacitación limitada", 100],
    ["Métodos", "Reservas por llamada", 370],
    ["Tecnología", "Sistemas aislados", 640],
  ];
  const lower = [
    ["Información", "Historial disperso", 235],
    ["Comunicación", "Sin orientación digital", 505],
    ["Administración", "Reportes manuales", 775],
  ];
  upper.forEach((c) => {
    card(ctx, s, c[2], 190, 200, 82, { fill: C.pale, radius: 14, line: C.line });
    text(ctx, s, c[0], c[2] + 18, 205, 164, 22, 15, C.navy, true, "center");
    text(ctx, s, c[1], c[2] + 18, 235, 164, 22, 12, C.muted, false, "center");
    rect(ctx, s, c[2] + 98, 272, 4, 108, C.blue2, 2);
  });
  lower.forEach((c) => {
    rect(ctx, s, c[2] + 98, 386, 4, 84, C.blue2, 2);
    card(ctx, s, c[2], 470, 200, 82, { fill: C.pale2, radius: 14, line: C.line });
    text(ctx, s, c[0], c[2] + 18, 485, 164, 22, 15, C.navy, true, "center");
    text(ctx, s, c[1], c[2] + 18, 515, 164, 22, 12, C.muted, false, "center");
  });
  footer(ctx, s, 13, "Fuente: elaboración propia basada en capítulo I");
  addNotes(s, "Anexo para preguntas sobre diagnóstico del problema. Las categorías resumen el Ishikawa incluido en la tesis.");
  return s;
}

async function erd(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.pale2;
  title(ctx, s, "El modelo relacional conserva trazabilidad entre usuario, cita y atención", "ANEXO B · Modelo DER");
  const user = node(ctx, s, "USUARIOS", "PK id_usuario\nrol · correo · DNI", 485, 145, 260, 105, C.white, C.navy);
  const paciente = node(ctx, s, "PACIENTES", "FK id_usuario\nfecha_nacimiento · dirección", 100, 300, 255, 110, C.white, C.blue);
  const medico = node(ctx, s, "MÉDICOS", "FK id_usuario · especialidad\nCMP · horario", 925, 300, 255, 110, C.white, C.blue);
  const citas = node(ctx, s, "CITAS", "FK paciente · médico\nfecha · hora · estado", 485, 320, 260, 115, C.white, C.green);
  const historial = node(ctx, s, "HISTORIAL MÉDICO", "FK paciente · médico · cita\ndiagnóstico · observaciones", 485, 515, 260, 115, C.white, C.amber);
  const recetas = node(ctx, s, "RECETAS", "FK historial\nmedicamento · indicación", 145, 520, 250, 105, C.white, C.blue2);
  const resultados = node(ctx, s, "RESULTADOS", "FK paciente\nexamen · resultado · estado", 880, 520, 250, 105, C.white, C.blue2);
  connect(s, user, paciente); connect(s, user, medico); connect(s, paciente, citas); connect(s, medico, citas);
  connect(s, citas, historial, C.green); connect(s, historial, recetas, C.amber); connect(s, paciente, resultados, C.blue2);
  footer(ctx, s, 14, "Vista simplificada del ERD completo");
  addNotes(s, "Anexo para explicar relaciones principales. El ERD completo también incluye administradores, especialidades, notificaciones y consultas del chatbot.");
  return s;
}

async function useCases(p, ctx) {
  const s = p.slides.add();
  s.background.fill = C.white;
  title(ctx, s, "Casos de uso y proceso principal del perfil paciente", "ANEXO C · Épicas y procesos");
  card(ctx, s, 64, 165, 410, 470, { fill: C.pale2, radius: 20, line: C.line });
  text(ctx, s, "Actor: Paciente", 94, 195, 340, 30, 20, C.navy, true);
  const cases = ["Registrarse e iniciar sesión", "Gestionar datos de contacto", "Reservar / reprogramar cita", "Consultar historial y PDFs", "Recibir notificaciones", "Consultar al asistente"];
  cases.forEach((v, i) => {
    card(ctx, s, 94, 248 + i * 57, 340, 42, { fill: C.white, radius: 14, line: C.line });
    text(ctx, s, v, 112, 260 + i * 57, 305, 20, 14, C.ink, i === 2 || i === 3);
  });
  text(ctx, s, "Proceso de reserva", 535, 180, 620, 30, 20, C.navy, true);
  const flow = [
    ["1", "Elegir especialidad"],
    ["2", "Seleccionar médico"],
    ["3", "Consultar horarios"],
    ["4", "Registrar motivo"],
    ["5", "Confirmar cita"],
    ["6", "Generar notificación"],
  ];
  flow.forEach((f, i) => {
    const x = 535 + (i % 2) * 330, y = 235 + Math.floor(i / 2) * 125;
    iconCircle(ctx, s, f[0], x, y, i === 5 ? C.green : C.blue);
    text(ctx, s, f[1], x + 68, y + 13, 235, 30, 16, C.ink, true);
    if (i < flow.length - 1) text(ctx, s, "↓", x + 15, y + 68, 22, 25, 20, C.blue2, true, "center");
  });
  card(ctx, s, 535, 570, 630, 58, { fill: C.greenPale, radius: 16, line: "#B8DECF" });
  text(ctx, s, "Validaciones: disponibilidad, cita futura, no duplicidad y paciente autenticado.", 555, 588, 590, 24, 15, C.green, true, "center");
  footer(ctx, s, 15);
  addNotes(s, "Anexo para responder preguntas sobre casos de uso, épicas y proceso de reserva.");
  return s;
}

export async function buildSlide(index, presentation, ctx) {
  const builders = [cover, problem, objectives, requirements, journey, architecture, tools, gantt, demoDashboard, demoCitas, demoProfile, conclusion, ishikawa, erd, useCases];
  return builders[index - 1](presentation, ctx);
}
