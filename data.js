// =====================================================================
// GIM – Gimnasio Club Atlético Adrogué
// Todo el contenido de la web vive acá. Para cambiar un texto, un
// horario o una foto, editá este archivo y listo (no hace falta tocar
// index.html ni app.js).
// Lo marcado con "// PENDIENTE CLIENTE" falta confirmar o reemplazar.
// =====================================================================

const CONFIG = {
  negocio: {
    nombre: "Gimnasio Club Atlético Adrogué",
    nombreCorto: "GIM",
    localidad: "Adrogué",
    eslogan: "Entrená. Mejorá. Rendí.",
    subtitulo:
      "El gimnasio del Club Atlético Adrogué, a pasos de la estación. Entrenamiento 100% personalizado, todos los días y en todos los horarios.",
    // Logo: si subís el logo oficial a /img (ej. "img/logo.webp" o "img/logo.svg"),
    // poné la ruta acá y reemplaza al logotipo provisorio en texto.
    logo: "", // PENDIENTE CLIENTE: subir logo oficial (GIM celeste + símbolo del club)
    badges: ["Ambiente climatizado", "Entrenamiento personalizado", "Kinesiología"],
    fundador: "Lic. Leandro Rey",
  },

  contacto: {
    whatsapp: "5491159902139", // 549 + área + número, sin + ni espacios
    mensajeWhatsapp: "¡Hola! Vi la web de GIM Adrogué y quería hacer una consulta.",
    telefono: "+54 9 11 5990-2139",
    instagram: "https://www.instagram.com/gimnasioclubadrogue/",
    instagramUsuario: "@gimnasioclubadrogue",
    // PENDIENTE CLIENTE: reemplazar por el link exacto de la página de Facebook
    facebook: "https://www.facebook.com/search/top?q=Gimnasio%20Club%20Atl%C3%A9tico%20Adrogu%C3%A9",
    facebookNombre: "Gimnasio Club Atlético Adrogué",
    direccion: "Seguí 886, Adrogué",
    direccionDetalle: "A pasos de la estación Adrogué",
    direccionCompleta: { calle: "Seguí 886", localidad: "Adrogué", provincia: "Buenos Aires", cp: "1846", pais: "AR" },
    mapsEmbed: "https://www.google.com/maps?q=Segu%C3%AD%20886%2C%20Adrogu%C3%A9%2C%20Buenos%20Aires&output=embed",
    mapsLink: "https://www.google.com/maps/dir/?api=1&destination=Segu%C3%AD%20886%2C%20Adrogu%C3%A9%2C%20Buenos%20Aires",
  },

  // 0 = domingo ... 6 = sábado. Varios turnos por día permitidos.
  horarios: {
    0: [],
    1: [["07:30", "22:00"]],
    2: [["07:30", "22:00"]],
    3: [["07:30", "22:00"]],
    4: [["07:30", "22:00"]],
    5: [["07:30", "22:00"]],
    6: [["09:00", "18:00"]],
  },
  // Resumen que se muestra en la tabla
  horariosTabla: [
    { dias: "Lunes a viernes", horas: "07:30 a 22:00 hs" },
    { dias: "Sábados", horas: "09:00 a 18:00 hs" },
    { dias: "Domingos", horas: "Cerrado" },
  ],

  // Contadores animados
  numeros: [
    { valor: 100, sufijo: "%", texto: "Entrenamiento personalizado" },
    { valor: 6, texto: "Días a la semana" },
    { valor: 2000, prefijo: "+", texto: "Seguidores en Instagram" }, // PENDIENTE CLIENTE: confirmar número actual
    { valor: 14, sufijo: ",5 hs", texto: "Abierto de lunes a viernes" },
  ],

  // Sección "Entrená". icono: fuerza | plan | preparacion | readaptacion | returnplay | evaluacion
  servicios: [
    { icono: "plan", titulo: "Planificaciones personalizadas", texto: "Tu rutina armada según tu objetivo, tu nivel y tus tiempos." },
    { icono: "fuerza", titulo: "Fuerza y acondicionamiento", texto: "Ganá fuerza, masa muscular y resistencia con un plan progresivo." },
    { icono: "preparacion", titulo: "Preparación física", texto: "Para deportistas que quieren rendir más en la cancha y en la pista." },
    { icono: "readaptacion", titulo: "Readaptación post kinesiológica", texto: "Volvé a entrenar seguro después de una lesión, con seguimiento profesional." },
    { icono: "returnplay", titulo: "Return to play", texto: "El puente entre el alta kinesiológica y la vuelta a tu deporte." },
    { icono: "evaluacion", titulo: "Evaluaciones", texto: "Medimos dónde estás para planificar y ver tu progreso con datos." },
  ],

  academia: {
    institucion: "IAAF – Instituto Argentino de Actividades Físicas",
    curso: "Curso de Instructor de Musculación y Personal Trainer",
    duracion: "4 meses",
    lugar: "Ahora en Adrogué · Seguí 886",
    // Formato libre, ej: "Sábado 7 de marzo". Si queda vacío se muestra "Consultá próxima fecha de inicio".
    fechaInicio: "", // PENDIENTE CLIENTE: la fecha del flyer (3 de octubre) ya pasó
    temario: [
      "Anatomía y fisiología del ejercicio",
      "Entrenamiento clásico y moderno",
      "Análisis técnico y del movimiento",
      "Entrenamiento funcional aplicado",
      "Evaluación y planificación del entrenamiento",
      "Certificación IAAF",
    ],
    nota: "Cupos limitados",
    contactoNombre: "Mauro",
    contactoWhatsapp: "5491151082937",
    foto: "img/galeria-pesas.webp",
  },

  tienda: {
    titulo: "Sport Shop",
    texto: "Todo lo que necesitás para entrenar y recuperarte, en el mismo gimnasio. Consultá stock y precios por WhatsApp.",
    avisoPrecios: "Precios sujetos a cambios, consultá por WhatsApp.",
    // filtro = texto del botón de filtro. acento = color puntual de la categoría (el celeste sigue siendo la marca).
    categorias: [
      { id: "nutricion", nombre: "Sport Nutrition", filtro: "Nutrición", texto: "Proteínas, creatinas, pre-entrenos, barritas y geles.", acento: "#B6F000" },
      { id: "recovery", nombre: "Recovery", filtro: "Recovery", texto: "Rodillos, pistola de masaje y liberación miofascial." },
      { id: "cintas", nombre: "Cintas – Sport Tape", filtro: "Cintas", texto: "Taping deportivo y kinesiológico." },
      { id: "equipamiento", nombre: "Sport Gear – Equipamiento", filtro: "Equipamiento", texto: "Mochilas, shakers, botellas y protectores." },
    ],
    // Cada producto es un afiche oficial del GIM (se muestra completo, sin recortar).
    // precioVigente: los afiches marcados con conPrecio traen un precio impreso que puede quedar viejo.
    //   Dejalo vacío ("") para no mostrar precio, o poné el número actual (ej. 24000) y la web lo muestra como $ 24.000.
    productos: [
      { id: "suplementos-pre-entreno", categoria: "nutricion", nombre: "Suplementos y pre-entrenos", alt: "Afiche de suplementos que impulsan: pre-entrenos, colágeno y suplementos deportivos en la tienda del GIM", imagen: "img/suplementos-pre-entreno.webp", ancho: 1125, alto: 1450 },
      { id: "proteina-en-polvo", categoria: "nutricion", nombre: "Proteína en polvo Granger", alt: "Afiche de proteína en polvo Granger: pancakes y puré proteico, nutrición que te acompaña", imagen: "img/proteina-en-polvo.webp", ancho: 1125, alto: 1500, conPrecio: true, precioVigente: "" }, // PENDIENTE CLIENTE: precio vigente
      { id: "barritas-geles", categoria: "nutricion", nombre: "Barritas y geles energéticos", alt: "Afiche de barritas proteicas y geles energéticos disponibles en el GIM", imagen: "img/barritas-geles.webp", ancho: 1125, alto: 1500 },
      { id: "proteinas-whey", categoria: "nutricion", nombre: "Proteínas whey", alt: "Afiche de proteínas whey: más fuerza, más músculo y mejor recuperación", imagen: "img/proteinas-whey.webp", ancho: 1125, alto: 1500 },
      { id: "creatinas", categoria: "nutricion", nombre: "Creatinas", alt: "Afiche de creatinas monohidrato para fuerza, potencia y rendimiento", imagen: "img/creatinas.webp", ancho: 1125, alto: 1500 },
      { id: "recovery", categoria: "recovery", nombre: "Recovery: rodillos y pistola de masaje", alt: "Afiche de recovery: rodillos de liberación miofascial y mini pistola de masaje", imagen: "img/recovery.webp", ancho: 1125, alto: 1125 },
      { id: "sport-tape", categoria: "cintas", nombre: "Sport Tape d3", alt: "Afiche de cinta deportiva d3 Sport Tape para vendaje funcional de tobillo, mano y rodilla", imagen: "img/sport-tape.webp", ancho: 1125, alto: 1651 },
      { id: "kinesio-taping", categoria: "cintas", nombre: "Kinesio taping K5.0", alt: "Afiche de cinta kinesiológica K5.0 para kinesio taping", imagen: "img/kinesio-taping.webp", ancho: 1125, alto: 1652 },
      { id: "d3-sportplast", categoria: "cintas", nombre: "d3 Sportplast", alt: "Afiche de d3 Sportplast, cinta rígida para estribos más firmes en vendajes", imagen: "img/d3-sportplast.webp", ancho: 1125, alto: 1625 },
      { id: "d3-lighrip", categoria: "cintas", nombre: "d3 Lighrip", alt: "Afiche de d3 Lighrip, venda elástica de cierre seguro para vendajes", imagen: "img/d3-lighrip.webp", ancho: 1125, alto: 1641 },
      { id: "promo-line-out", categoria: "cintas", nombre: "Promo Line Out", alt: "Afiche de la promo Line Out: cinta d3 más cinta aisladora en 7,5 y 10 cm", imagen: "img/promo-line-out.webp", ancho: 1125, alto: 1458, conPrecio: true, precioVigente: "" }, // PENDIENTE CLIENTE: precio vigente
      { id: "promo-athletic-tape", categoria: "cintas", nombre: "Promo Athletic Sports Tape", alt: "Afiche de la promo Athletic Sports Tape, pack de 4 rollos de cinta deportiva", imagen: "img/promo-athletic-tape.webp", ancho: 1125, alto: 1350, conPrecio: true, precioVigente: "" }, // PENDIENTE CLIENTE: precio vigente
      { id: "equipamiento", categoria: "equipamiento", nombre: "Equipamiento para entrenar", alt: "Afiche de equipamiento: mochila Quechua, shaker, protector bucal y tijera kinesiológica", imagen: "img/equipamiento.webp", ancho: 1125, alto: 1457, conPrecio: true, precioVigente: "" }, // PENDIENTE CLIENTE: precio vigente
      { id: "botellas", categoria: "equipamiento", nombre: "Botellas y shakers", alt: "Afiche de botellas y shakers con el sello del Club Atlético Adrogué", imagen: "img/botellas.webp", ancho: 1125, alto: 1350 },
    ],
  },

  // Si "foto" queda vacío se muestran las iniciales.
  equipo: [
    { nombre: "Lic. Leandro Rey", rol: "Fundador y director · Kinesiólogo", foto: "" }, // PENDIENTE CLIENTE: foto
    { nombre: "Nombre a confirmar", rol: "Profe de sala", foto: "" }, // PENDIENTE CLIENTE: nombre, rol y foto
    { nombre: "Nombre a confirmar", rol: "Profe de sala", foto: "" }, // PENDIENTE CLIENTE: nombre, rol y foto
  ],
  equipoTexto:
    "Un equipo de profes y kinesiología que te acompaña en cada entrenamiento. Y seguimos creciendo: pronto sumamos más servicios de kinesiología para los socios.",

  // Fotos oficiales del GIM (las 5 salen del collage; el collage completo va primero).
  galeria: [
    // forma: "ancho" ocupa 2 columnas, "alto" ocupa 2 filas (solo cambia la miniatura; el lightbox muestra la foto entera)
    { src: "img/galeria-fachada.webp", thumb: "img/galeria-fachada-thumb.webp", alt: "Fachada celeste del Club Atlético Adrogué en Seguí 886", ancho: 548, alto: 420, forma: "ancho" },
    { src: "img/gimnasio-collage.webp", thumb: "img/gimnasio-collage-thumb.webp", alt: "Collage del GIM: fachada celeste del Club Atlético Adrogué, pesas, zona funcional, cajón GIM y una socia entrenando", ancho: 1125, alto: 1902, forma: "alto" },
    { src: "img/galeria-pesas.webp", thumb: "img/galeria-pesas-thumb.webp", alt: "Discos de pesas y plataforma en la sala de musculación", ancho: 525, alto: 840 },
    { src: "img/galeria-funcional.webp", thumb: "img/galeria-funcional-thumb.webp", alt: "Zona funcional con bolsas de entrenamiento y pesas rusas", ancho: 330, alto: 680 },
    { src: "img/galeria-cajon-gim.webp", thumb: "img/galeria-cajon-gim-thumb.webp", alt: "Cajón de saltos de madera con el logo GIM Club Atlético Adrogué", ancho: 296, alto: 690 },
    { src: "img/galeria-socia-entrenando.webp", thumb: "img/galeria-socia-entrenando-thumb.webp", alt: "Socia entrenando en la sala del GIM", ancho: 270, alto: 780 },
  ],

  // PENDIENTE CLIENTE: opiniones DE EJEMPLO. Reemplazar por reseñas reales de Google antes de publicar.
  testimonios: [
    { autor: "Socio de ejemplo", texto: "Volví a entrenar después de una lesión de rodilla y me acompañaron en cada paso. Hoy estoy mejor que antes.", estrellas: 5, ejemplo: true },
    { autor: "Socia de ejemplo", texto: "La rutina es 100% para mí y los profes siempre están atentos. Y el ambiente climatizado se agradece en verano.", estrellas: 5, ejemplo: true },
    { autor: "Socio de ejemplo", texto: "Me queda a pasos de la estación, así que entreno antes del laburo. Buena onda y mucho conocimiento.", estrellas: 5, ejemplo: true },
  ],

  faq: [
    { pregunta: "¿Puedo probar una clase?", respuesta: "¡Sí! Escribinos por WhatsApp, coordinamos día y horario y venís a conocer el gimnasio.", mensaje: "¡Hola! Quiero coordinar una clase de prueba en GIM Adrogué." },
    { pregunta: "¿Hay entrenamiento personalizado?", respuesta: "Sí, el entrenamiento es 100% personalizado en todos los horarios y todos los días. Cada socio tiene su planificación.", mensaje: "¡Hola! Quiero consultar por el entrenamiento personalizado en GIM Adrogué." },
    { pregunta: "¿Qué horarios tienen?", respuesta: "Lunes a viernes de 07:30 a 22:00 hs y sábados de 09:00 a 18:00 hs. Los domingos está cerrado.", mensaje: "¡Hola! Quiero consultar por los horarios de GIM Adrogué." },
    { pregunta: "¿Tienen kinesiología?", respuesta: "El gimnasio lo dirige el Lic. Leandro Rey, kinesiólogo. Trabajamos readaptación post kinesiológica y return to play, y estamos sumando servicios de kinesiología para los socios.", mensaje: "¡Hola! Quiero consultar por kinesiología y readaptación en GIM Adrogué." },
    { pregunta: "¿Cómo me anoto?", respuesta: "Mandanos un WhatsApp con tu nombre y tu objetivo, y te pasamos toda la info para arrancar.", mensaje: "¡Hola! Quiero anotarme en GIM Adrogué." },
  ],

  // ===================================================================
  // SISTEMA DE TURNOS (app /app/ y panel /app/admin/)
  // ===================================================================
  reservas: {
    // "local" = demo en el navegador (localStorage). "supabase" = fase 2 (ver supabase/README.md).
    backend: "local",
    supabase: { url: "", anonKey: "", workerUrl: "" }, // PENDIENTE CLIENTE (fase 2)

    zonaHoraria: "America/Argentina/Buenos_Aires",
    anticipacionDias: 14,   // hasta cuántos días para adelante se puede reservar
    cancelacionHoras: 3,    // no se puede cancelar ni reprogramar si faltan menos de estas horas
    listaEspera: true,      // si un turno está completo, el socio se puede anotar en espera
    venceProntoDias: 5,     // a partir de cuántos días antes del vencimiento se marca "vence pronto"
    recordatorioHorasAntes: 2, // fase 2: recordatorio automático por WhatsApp

    // Horario del gimnasio (0 = domingo ... 6 = sábado). Fuera de esto no se puede reservar.
    // Se toma de CONFIG.horarios (más arriba) para no duplicarlo.

    // Precios de ejemplo. PENDIENTE CLIENTE: confirmar planes y precios reales.
    planes: [
      { id: "libre", nombre: "Pase libre", precio: 38000, dias: 30, reservasSemana: null, detalle: "Todos los días, todas las actividades de sala" },
      { id: "3x", nombre: "3 veces por semana", precio: 32000, dias: 30, reservasSemana: 3, detalle: "Hasta 3 turnos por semana" },
      { id: "2x", nombre: "2 veces por semana", precio: 26000, dias: 30, reservasSemana: 2, detalle: "Hasta 2 turnos por semana" },
      { id: "readaptacion", nombre: "Readaptación", precio: 60000, dias: 30, reservasSemana: 3, detalle: "Readaptación post kinesiológica con seguimiento" },
    ],

    // PENDIENTE CLIENTE: Camila y Matías son nombres de ejemplo para la demo.
    profes: [
      { id: "leandro", nombre: "Lic. Leandro Rey", rol: "Kinesiólogo · Director" },
      { id: "camila", nombre: "Camila Ferreyra", rol: "Profe de sala y preparación física" }, // EJEMPLO
      { id: "matias", nombre: "Matías Godoy", rol: "Profe de sala y funcional" }, // EJEMPLO
    ],

    // Actividades y franjas semanales (plantilla). Desde el panel se pueden editar.
    // dias: 1 = lunes ... 6 = sábado. cupo = lugares por turno.
    // profe: profe fijo de la clase. eligeProfe: true = el socio elige con quién.
    actividades: [
      {
        id: "musculacion", corto: "Musculación", nombre: "Musculación", icono: "fuerza", duracion: 60, cupo: 12,
        descripcion: "Sala de musculación con tu planificación personalizada.",
        profes: ["camila", "matias"], eligeProfe: false,
        franjas: [
          { dias: [1, 2, 3, 4, 5], horas: ["07:30", "08:30", "09:30", "10:30", "11:30", "12:30", "13:30", "14:30", "15:30", "16:30", "17:30", "18:30", "19:30", "20:30"] },
          { dias: [6], horas: ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"] },
        ],
      },
      {
        id: "personalizado", corto: "Personalizado", nombre: "Entrenamiento personalizado", icono: "plan", duracion: 60, cupo: 4,
        descripcion: "Grupo reducido, con un profe al lado en cada ejercicio.",
        profes: ["camila", "matias", "leandro"], eligeProfe: true,
        franjas: [
          { dias: [1, 2, 3, 4, 5], horas: ["08:00", "10:00", "17:00", "18:00", "19:00"] },
          { dias: [6], horas: ["10:00", "11:00"] },
        ],
      },
      {
        id: "funcional", corto: "Funcional", nombre: "Funcional", icono: "preparacion", duracion: 50, cupo: 10,
        descripcion: "Circuitos de fuerza, potencia y resistencia en grupo.",
        profes: ["matias"], eligeProfe: false,
        franjas: [
          { dias: [1, 3, 5], horas: ["09:00", "19:00", "20:00"] },
          { dias: [6], horas: ["10:00"] },
        ],
      },
      {
        id: "kinesiologia", corto: "Kinesio", nombre: "Kinesiología / Readaptación", icono: "readaptacion", duracion: 45, cupo: 2,
        descripcion: "Readaptación post kinesiológica y return to play con el Lic. Rey.",
        profes: ["leandro"], eligeProfe: false,
        franjas: [
          { dias: [2, 4], horas: ["14:00", "15:00", "16:00", "17:00"] },
        ],
      },
      {
        id: "preparacion", corto: "Prep. física", nombre: "Preparación física", icono: "returnplay", duracion: 60, cupo: 8,
        descripcion: "Para deportistas: fuerza, velocidad y prevención de lesiones.",
        profes: ["camila"], eligeProfe: false,
        franjas: [
          { dias: [2, 4], horas: ["18:00", "19:00"] },
          { dias: [6], horas: ["11:00"] },
        ],
      },
    ],

    // Textos de WhatsApp. Variables: {nombre} {plan} {precio} {vence} {actividad} {fecha} {hora} {profe}
    textos: {
      renovar: "¡Hola! Soy {nombre}. Quiero renovar mi plan {plan} ({precio}) en GIM Adrogué.",
      cambiarPlan: "¡Hola! Soy {nombre}. Quiero pasarme al plan {plan} ({precio}) en GIM Adrogué.",
      avisoReserva: "¡Hola! Soy {nombre}. Reservé {actividad} el {fecha} a las {hora} hs. ¿Me avisan por acá antes del turno?",
      recordatorio: "¡Hola {nombre}! Te recordamos tu turno de {actividad} hoy a las {hora} hs en GIM Adrogué (Seguí 886). Si no podés venir, cancelalo desde la app así liberás el lugar. ¡Te esperamos!",
      vencimiento: "¡Hola {nombre}! Tu plan {plan} en GIM Adrogué vence el {vence}. Podés renovarlo por acá o en recepción. ¡Seguimos entrenando!",
      vencido: "¡Hola {nombre}! Tu plan {plan} en GIM Adrogué venció el {vence}. Renovalo para seguir reservando turnos. ¡Te esperamos!",
      olvidePin: "¡Hola! No me acuerdo mi PIN de la app de turnos de GIM Adrogué. Mi DNI es ",
    },

    // Panel del gimnasio. En la demo la clave se valida en el navegador:
    // NO es seguro para producción (en fase 2 se usa Supabase Auth con rol admin).
    admin: { claveDemo: "gim2026" },

    // Datos de ejemplo para la demo (fase 1). Se ignoran con backend "supabase".
    demo: {
      mostrarAccesos: true, // muestra los socios de prueba en la pantalla de ingreso
      socios: [
        { id: "s-martina", nombre: "Martina", apellido: "López", dni: "35123456", whatsapp: "5491155550101", email: "martina@example.com", pin: "1234", plan: "libre", venceEnDias: 18, objetivo: "Ganar fuerza" },
        { id: "s-lucas", nombre: "Lucas", apellido: "Fernández", dni: "38987654", whatsapp: "5491155550102", email: "lucas@example.com", pin: "2345", plan: "3x", venceEnDias: 3, objetivo: "Rendimiento deportivo" },
        { id: "s-sofia", nombre: "Sofía", apellido: "Martínez", dni: "41222333", whatsapp: "5491155550103", email: "sofia@example.com", pin: "3456", plan: "readaptacion", venceEnDias: -5, objetivo: "Readaptación de una lesión" },
      ],
      cantidadSociosExtra: 230, // socios generados para que la agenda y los reportes tengan volumen
    },
  },

  seo: {
    // Título, descripción y Open Graph también están escritos en index.html
    // (las redes no leen JavaScript). Si cambiás algo acá, cambialo allá también.
    url: "https://vigolomarketing-tech.github.io/Gimnasio-club-adrogue/", // PENDIENTE CLIENTE: dominio final
    ogImage: "img/og.jpg",
    tipoSchema: ["HealthClub", "ExerciseGym"],
  },
};
