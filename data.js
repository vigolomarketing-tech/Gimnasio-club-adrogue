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
    foto: "img/academia.webp",
  },

  tienda: {
    titulo: "Sport Shop",
    texto: "Todo lo que necesitás para entrenar y recuperarte, en el mismo gimnasio. Consultá stock y precios por WhatsApp.",
    categorias: [
      { id: "equipamiento", nombre: "Sport Gear – Equipamiento", texto: "Mochilas, shakers, protectores y accesorios para entrenar.", foto: "img/tienda-equipamiento.webp" },
      { id: "cintas", nombre: "Cintas – Sport Tape", texto: "Cintas para taping deportivo y kinesiológico.", foto: "img/tienda-cintas.webp" },
      { id: "recovery", nombre: "Recovery – Liberación miofascial", texto: "Rodillos, pistolas de masaje y todo para recuperarte mejor.", foto: "img/tienda-recovery.webp" },
      { id: "nutricion", nombre: "Sport Nutrition", texto: "Creatinas, whey protein y suplementos deportivos.", foto: "img/tienda-nutricion.webp" },
    ],
    // Vacío a propósito: no hay precios confirmados. Si se cargan productos,
    // la web arma el catálogo solo. Ejemplo de formato:
    // { categoria: "nutricion", nombre: "Creatina monohidrato 300 g", precio: 25000, foto: "img/creatina.webp" },
    productos: [],
  },

  // Si "foto" queda vacío se muestran las iniciales.
  equipo: [
    { nombre: "Lic. Leandro Rey", rol: "Fundador y director · Kinesiólogo", foto: "" }, // PENDIENTE CLIENTE: foto
    { nombre: "Nombre a confirmar", rol: "Profe de sala", foto: "" }, // PENDIENTE CLIENTE: nombre, rol y foto
    { nombre: "Nombre a confirmar", rol: "Profe de sala", foto: "" }, // PENDIENTE CLIENTE: nombre, rol y foto
  ],
  equipoTexto:
    "Un equipo de profes y kinesiología que te acompaña en cada entrenamiento. Y seguimos creciendo: pronto sumamos más servicios de kinesiología para los socios.",

  // PENDIENTE CLIENTE: fotos de stock provisorias (Unsplash). Reemplazar por fotos del GIM
  // (instalaciones, pesas, zona funcional, cajón GIM, fachada celeste) con los mismos nombres o cambiando la ruta.
  galeria: [
    { src: "img/galeria-sala-musculacion.webp", thumb: "img/galeria-sala-musculacion-thumb.webp", alt: "Sala de musculación con máquinas y bancos" },
    { src: "img/galeria-rack-sentadillas.webp", thumb: "img/galeria-rack-sentadillas-thumb.webp", alt: "Rack de sentadillas y discos de pesas" },
    { src: "img/galeria-zona-funcional.webp", thumb: "img/galeria-zona-funcional-thumb.webp", alt: "Entrenamiento funcional con sogas de batalla" },
    { src: "img/galeria-mancuernas.webp", thumb: "img/galeria-mancuernas-thumb.webp", alt: "Mancuernas en el soporte" },
    { src: "img/galeria-sentadilla.webp", thumb: "img/galeria-sentadilla-thumb.webp", alt: "Socia haciendo sentadilla con barra" },
    { src: "img/galeria-salon-amplio.webp", thumb: "img/galeria-salon-amplio-thumb.webp", alt: "Salón amplio de entrenamiento" },
    { src: "img/galeria-peso-muerto.webp", thumb: "img/galeria-peso-muerto-thumb.webp", alt: "Levantamiento de peso muerto con barra" },
    { src: "img/galeria-entrenamiento-fuerza.webp", thumb: "img/galeria-entrenamiento-fuerza-thumb.webp", alt: "Socio entrenando fuerza con barra" },
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

  seo: {
    // Título, descripción y Open Graph también están escritos en index.html
    // (las redes no leen JavaScript). Si cambiás algo acá, cambialo allá también.
    url: "https://vigolomarketing-tech.github.io/Gimnasio-club-adrogue/", // PENDIENTE CLIENTE: dominio final
    ogImage: "img/og.jpg",
    tipoSchema: ["HealthClub", "ExerciseGym"],
  },
};
