/* GIM Adrogué · Sistema de turnos
 * ---------------------------------------------------------------
 * Capa de datos con UNA sola interfaz (window.GIMAPI). La app del socio
 * y el panel solo hablan con esto; nunca tocan localStorage ni Supabase.
 *
 *   Fase 1 (backend "local"):    todo en localStorage + datos de ejemplo.
 *   Fase 2 (backend "supabase"): js/api-supabase.js implementa los mismos
 *                                métodos contra Supabase (ver supabase/README.md).
 *
 * Todos los métodos son async y, ante un error de negocio, lanzan
 * GIMError { code, message } con un mensaje listo para mostrar.
 * Fechas: "YYYY-MM-DD" y horas "HH:MM", siempre en hora de Argentina.
 */
(function () {
  "use strict";
  const CFG = CONFIG;
  const R = CFG.reservas;

  class GIMError extends Error {
    constructor(code, message, extra) { super(message); this.code = code; Object.assign(this, extra || {}); }
  }

  // =================================================================
  // Tiempo (America/Argentina/Buenos_Aires, UTC-3 fijo: Argentina no
  // usa horario de verano desde 2009)
  // =================================================================
  const OFFSET_H = 3;
  const pad = (n) => String(n).padStart(2, "0");
  const T = {
    ahora() {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
        timeZone: R.zonaHoraria, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(new Date()).map((x) => [x.type, x.value]));
      const fecha = `${p.year}-${p.month}-${p.day}`, hora = `${p.hour}:${p.minute}`;
      return { fecha, hora, min: T.aMin(hora), dia: T.diaSemana(fecha), ms: Date.now() };
    },
    hoy: () => T.ahora().fecha,
    aMin: (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; },
    deMin: (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`,
    _utc: (f) => { const [y, m, d] = f.split("-").map(Number); return Date.UTC(y, m - 1, d); },
    _iso: (ms) => new Date(ms).toISOString().slice(0, 10),
    sumarDias: (f, n) => T._iso(T._utc(f) + n * 864e5),
    difDias: (a, b) => Math.round((T._utc(b) - T._utc(a)) / 864e5), // b - a
    diaSemana: (f) => new Date(T._utc(f)).getUTCDay(),
    lunes: (f) => T.sumarDias(f, -((T.diaSemana(f) + 6) % 7)),
    /** Instante absoluto (ms) de una fecha+hora de Argentina */
    ms: (f, h) => T._utc(f) + (T.aMin(h) + OFFSET_H * 60) * 6e4,
    fmt(f, opts) { return new Intl.DateTimeFormat("es-AR", Object.assign({ timeZone: "UTC" }, opts)).format(new Date(T._utc(f))); },
    largo: (f) => T.fmt(f, { weekday: "long", day: "numeric", month: "long" }),
    corto: (f) => T.fmt(f, { weekday: "short", day: "numeric", month: "short" }),
    ddmm: (f) => T.fmt(f, { day: "2-digit", month: "2-digit" }),
    ddmmaa: (f) => T.fmt(f, { day: "2-digit", month: "2-digit", year: "numeric" }),
    mes: (f) => f.slice(0, 7),
  };
  const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const precio = (n) => "$ " + Math.round(Number(n) || 0).toLocaleString("es-AR");
  const plantillaTexto = (txt, vars) => String(txt || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ""));
  const soloDigitos = (s) => String(s || "").replace(/\D/g, "");
  const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const codigo = () => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c = ""; for (let i = 0; i < 6; i++) c += a[Math.floor(Math.random() * a.length)]; return c; };
  const clon = (o) => JSON.parse(JSON.stringify(o));

  // =================================================================
  // Almacenamiento local
  // =================================================================
  const VERSION = 3;
  const KEY = "gim_turnos_v" + VERSION;
  const K_SESION = "gim_sesion", K_ADMIN = "gim_admin_sesion", K_INTENTOS = "gim_intentos";
  const canal = "BroadcastChannel" in window ? new BroadcastChannel("gim-turnos") : null;
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } },
  };
  let memoria = null; // respaldo si localStorage no está disponible (modo privado)

  function leer() {
    let st = ls.get(KEY) || memoria;
    if (!st || st.version !== VERSION) { st = sembrar(); guardar(st, true); }
    return st;
  }
  function guardar(st, silencioso) {
    st.actualizado = Date.now();
    if (!ls.set(KEY, st)) memoria = st;
    if (!silencioso) { canal && canal.postMessage({ t: st.actualizado }); oyentes.forEach((fn) => fn()); }
  }
  /** "Transacción": lee el estado fresco, aplica fn y guarda solo si no hubo error.
   *  En JS todo esto corre sin interrupciones, así que dos reservas desde la misma
   *  pestaña nunca se pisan. Entre pestañas/dispositivos el cupo real lo garantiza
   *  la función SQL reservar_turno() de Supabase (fase 2). */
  function tx(fn) {
    const st = leer();
    const r = fn(st);
    guardar(st);
    return r;
  }
  const oyentes = new Set();
  window.addEventListener("storage", (e) => { if (e.key === KEY) oyentes.forEach((fn) => fn()); });
  canal && canal.addEventListener("message", () => oyentes.forEach((fn) => fn()));

  // =================================================================
  // Configuración efectiva (CONFIG + cambios hechos desde el panel)
  // =================================================================
  function cfg(st) {
    const c = st.config || {};
    return {
      horarios: c.horarios || CFG.horarios,
      cancelacionHoras: c.cancelacionHoras != null ? c.cancelacionHoras : R.cancelacionHoras,
      anticipacionDias: c.anticipacionDias != null ? c.anticipacionDias : R.anticipacionDias,
      listaEspera: c.listaEspera != null ? c.listaEspera : R.listaEspera,
      venceProntoDias: R.venceProntoDias,
      textos: Object.assign({}, R.textos, c.textos || {}),
    };
  }
  const actividad = (id) => R.actividades.find((a) => a.id === id);
  const profe = (id) => R.profes.find((p) => p.id === id);
  const plan = (id) => R.planes.find((p) => p.id === id);

  // =================================================================
  // Franjas y turnos
  // =================================================================
  function plantillaInicial() {
    const out = [];
    R.actividades.forEach((a) => a.franjas.forEach((g) => g.dias.forEach((d) => g.horas.forEach((h) => {
      out.push({ id: `${a.id}-${d}-${h.replace(":", "")}`, actividadId: a.id, dia: d, hora: h, cupo: a.cupo, duracion: a.duracion, profeId: a.eligeProfe ? null : a.profes[0] });
    }))));
    return out;
  }
  function franjasSemana(st, lunes) { return st.semanas[lunes] || st.plantilla; }
  function dentroHorario(st, fecha, hora, duracion) {
    const turnos = cfg(st).horarios[T.diaSemana(fecha)] || [];
    const ini = T.aMin(hora), fin = ini + duracion;
    return turnos.some(([a, b]) => ini >= T.aMin(a) && fin <= T.aMin(b));
  }
  const bloqueo = (st, fecha) => st.bloqueos.find((b) => b.fecha === fecha);
  const activa = (r) => r.estado === "confirmada" || r.estado === "asistio" || r.estado === "ausente";

  function turnosDe(st, fecha, filtroAct) {
    if (bloqueo(st, fecha)) return [];
    const dia = T.diaSemana(fecha), now = T.ahora();
    const resDia = st.reservas.filter((r) => r.fecha === fecha);
    return franjasSemana(st, T.lunes(fecha))
      .filter((f) => f.dia === dia && (!filtroAct || f.actividadId === filtroAct) && dentroHorario(st, fecha, f.hora, f.duracion))
      .map((f) => {
        const id = `${f.actividadId}|${fecha}|${f.hora}`;
        const rs = resDia.filter((r) => r.turnoId === id);
        const ocupados = rs.filter(activa).length;
        const espera = rs.filter((r) => r.estado === "espera").length;
        const ini = T.ms(fecha, f.hora);
        const pasado = ini <= now.ms;
        const disponibles = Math.max(0, f.cupo - ocupados);
        return {
          id, franjaId: f.id, actividadId: f.actividadId, fecha, hora: f.hora, fin: T.deMin(T.aMin(f.hora) + f.duracion),
          duracion: f.duracion, cupo: f.cupo, profeId: f.profeId, ocupados, espera, disponibles, pasado,
          estado: pasado ? "pasado" : disponibles === 0 ? "completo" : disponibles <= 2 ? "pocos" : "disponible",
        };
      })
      .sort((a, b) => a.hora.localeCompare(b.hora) || a.actividadId.localeCompare(b.actividadId));
  }
  function buscarTurno(st, turnoId) {
    const [act, fecha] = turnoId.split("|");
    return turnosDe(st, fecha, act).find((t) => t.id === turnoId);
  }

  // =================================================================
  // Membresía
  // =================================================================
  function membresia(st, s) {
    const p = plan(s.planId) || { nombre: "Sin plan", dias: 30 };
    const hoy = T.hoy();
    const dias = s.vence ? T.difDias(hoy, s.vence) : -1;
    const estado = s.estado === "baja" ? "baja" : dias < 0 ? "vencida" : dias <= cfg(st).venceProntoDias ? "vence-pronto" : "al-dia";
    const progreso = Math.max(0, Math.min(1, dias / (p.dias || 30)));
    return { plan: p, vence: s.vence, diasRestantes: dias, estado, progreso, puedeReservar: estado === "al-dia" || estado === "vence-pronto" };
  }
  const ESTADOS = { "al-dia": "Al día", "vence-pronto": "Vence pronto", vencida: "Vencida", baja: "Baja" };

  function socioPublico(st, s) {
    if (!s) return null;
    const { pin, ...resto } = s;
    return Object.assign(resto, { nombreCompleto: `${s.nombre} ${s.apellido}`, membresia: membresia(st, s) });
  }
  function reservaPublica(st, r) {
    const a = actividad(r.actividadId), pr = profe(r.profeId), s = st.socios.find((x) => x.id === r.socioId);
    const ini = T.ms(r.fecha, r.hora);
    const c = cfg(st);
    const horasFaltan = (ini - Date.now()) / 36e5;
    const out = Object.assign({}, r, {
      actividad: a ? a.nombre : r.actividadId, icono: a ? a.icono : "plan", profe: pr ? pr.nombre : null,
      socio: s ? `${s.nombre} ${s.apellido}` : "", socioWhatsapp: s ? s.whatsapp : "",
      futura: ini > Date.now(), horasFaltan,
      puedeCancelar: (r.estado === "confirmada" || r.estado === "espera") && (r.estado === "espera" || horasFaltan >= c.cancelacionHoras),
    });
    if (r.estado === "espera") {
      out.posicionEspera = st.reservas.filter((x) => x.turnoId === r.turnoId && x.estado === "espera" && x.creada <= r.creada).length;
    }
    return out;
  }

  // =================================================================
  // Reglas de reserva (núcleo compartido por reservar y reprogramar)
  // =================================================================
  function nucleoReservar(st, { socioId, turnoId, profeId, espera, ignorarReservaId }) {
    const c = cfg(st);
    const s = st.socios.find((x) => x.id === socioId);
    if (!s || s.estado === "baja") throw new GIMError("socio", "No encontramos tu ficha de socio. Consultá en recepción.");
    const m = membresia(st, s);
    if (!m.puedeReservar) throw new GIMError("membresia-vencida", "Tu plan está vencido. Renovalo para volver a reservar.");

    const [actId, fecha, hora] = turnoId.split("|");
    const a = actividad(actId);
    if (!a) throw new GIMError("actividad", "Esa actividad no existe.");
    const hoy = T.hoy();
    if (fecha < hoy || T.difDias(hoy, fecha) >= c.anticipacionDias) throw new GIMError("fecha", `Podés reservar desde hoy y hasta ${c.anticipacionDias} días para adelante.`);
    const b = bloqueo(st, fecha);
    if (b) throw new GIMError("bloqueado", `Ese día el gimnasio está cerrado${b.motivo ? " (" + b.motivo + ")" : ""}.`);
    const t = buscarTurno(st, turnoId);
    if (!t) throw new GIMError("horario", "Ese horario no está disponible (fuera del horario del gimnasio).");
    if (t.pasado) throw new GIMError("pasado", "Ese turno ya empezó. Elegí otro horario.");
    if (!dentroHorario(st, fecha, hora, t.duracion)) throw new GIMError("horario", "Ese turno queda fuera del horario del gimnasio.");

    // Doble reserva / superposición en el mismo horario
    const ini = T.aMin(hora), fin = ini + t.duracion;
    const choca = st.reservas.find((r) => r.socioId === socioId && r.fecha === fecha && r.id !== ignorarReservaId &&
      (activa(r) || r.estado === "espera") && T.aMin(r.hora) < fin && ini < T.aMin(r.fin));
    if (choca) {
      const ca = actividad(choca.actividadId);
      throw new GIMError("superpuesto", choca.turnoId === turnoId ? "Ya tenés este turno reservado." : `Ya tenés ${ca ? ca.nombre : "un turno"} a las ${choca.hora} hs ese día.`);
    }
    // Límite semanal del plan
    if (m.plan.reservasSemana) {
      const lun = T.lunes(fecha), dom = T.sumarDias(lun, 6);
      const usadas = st.reservas.filter((r) => r.socioId === socioId && r.id !== ignorarReservaId && r.fecha >= lun && r.fecha <= dom && (activa(r) || r.estado === "espera")).length;
      if (usadas >= m.plan.reservasSemana) throw new GIMError("limite-plan", `Tu plan permite ${m.plan.reservasSemana} turnos por semana y ya los usaste esa semana.`);
    }
    // Profe
    let pid = t.profeId;
    if (a.eligeProfe) {
      pid = profeId && a.profes.includes(profeId) ? profeId : null;
      if (!pid) throw new GIMError("profe", "Elegí con qué profe querés entrenar.");
    }
    // Cupo
    let estado = "confirmada";
    if (t.disponibles <= 0) {
      if (!espera) throw new GIMError("completo", "Ese turno se completó recién. Elegí otro horario o anotate en la lista de espera.", { puedeEsperar: c.listaEspera });
      if (!c.listaEspera) throw new GIMError("completo", "Ese turno está completo.");
      estado = "espera";
    }
    const r = {
      id: uid("r"), codigo: codigo(), turnoId, socioId, actividadId: actId, fecha, hora, fin: t.fin, profeId: pid,
      estado, creada: Date.now(), avisoWhatsapp: !!s.notifWhatsapp, avisoEnviado: false,
    };
    st.reservas.push(r);
    return r;
  }

  function liberarCupo(st, turnoId) {
    // Promueve al primero de la lista de espera
    const t = buscarTurno(st, turnoId);
    if (!t || t.disponibles <= 0) return null;
    const sig = st.reservas.filter((r) => r.turnoId === turnoId && r.estado === "espera").sort((a, b) => a.creada - b.creada)[0];
    if (sig) { sig.estado = "confirmada"; sig.promovida = Date.now(); }
    return sig || null;
  }

  function nucleoCancelar(st, reservaId, { socioId, admin, motivo } = {}) {
    const r = st.reservas.find((x) => x.id === reservaId);
    if (!r || (socioId && r.socioId !== socioId)) throw new GIMError("reserva", "No encontramos ese turno.");
    if (r.estado !== "confirmada" && r.estado !== "espera") throw new GIMError("estado", "Ese turno ya no se puede cancelar.");
    const horas = (T.ms(r.fecha, r.hora) - Date.now()) / 36e5;
    const lim = cfg(st).cancelacionHoras;
    if (!admin && r.estado === "confirmada" && horas < lim) throw new GIMError("tarde", `Solo podés cancelar hasta ${lim} h antes del turno. Escribinos por WhatsApp si tenés un problema.`);
    const eraConfirmada = r.estado === "confirmada";
    r.estado = "cancelada"; r.cancelada = Date.now(); if (motivo) r.motivo = motivo;
    const promovido = eraConfirmada ? liberarCupo(st, r.turnoId) : null;
    return { reserva: r, promovido };
  }

  // =================================================================
  // Datos de ejemplo
  // =================================================================
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const NOMBRES = ["Juan", "Valentina", "Santiago", "Camila", "Mateo", "Lucía", "Benjamín", "Florencia", "Tomás", "Agustina", "Nicolás", "Micaela", "Facundo", "Julieta", "Joaquín", "Rocío", "Franco", "Milagros", "Ignacio", "Paula", "Gonzalo", "Carolina", "Federico", "Daniela", "Martín", "Brenda", "Ezequiel", "Antonella", "Leonel", "Victoria", "Pablo", "Sabrina", "Diego", "Natalia", "Emiliano", "Romina", "Bruno", "Celeste", "Alejandro", "Marina"];
  const APELLIDOS = ["González", "Rodríguez", "Gómez", "Fernández", "López", "Díaz", "Martínez", "Pérez", "García", "Sánchez", "Romero", "Sosa", "Torres", "Álvarez", "Ruiz", "Ramírez", "Flores", "Benítez", "Acosta", "Medina", "Herrera", "Suárez", "Aguirre", "Giménez", "Gutiérrez", "Pereyra", "Molina", "Castro", "Ortiz", "Silva"];
  const OBJETIVOS = ["Ganar fuerza", "Bajar de peso", "Salud y bienestar", "Rendimiento deportivo", "Readaptación de una lesión", "Ganar masa muscular"];

  function sembrar() {
    const rnd = rng(886);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const hoy = T.hoy(), nowMs = Date.now();
    const st = { version: VERSION, creado: nowMs, semilla: hoy, socios: [], reservas: [], pagos: [], bloqueos: [], semanas: {}, plantilla: plantillaInicial(), config: {}, checkins: [] };

    // Socios de la demo
    R.demo.socios.forEach((d, i) => {
      st.socios.push({
        id: d.id, nombre: d.nombre, apellido: d.apellido, dni: d.dni, whatsapp: d.whatsapp, email: d.email, pin: d.pin,
        planId: d.plan, vence: T.sumarDias(hoy, d.venceEnDias), alta: T.sumarDias(hoy, -(120 + i * 75)), estado: "activo",
        objetivo: d.objetivo, notifWhatsapp: true, notifVencimiento: true, demo: true,
      });
    });
    // Socios generados
    const usados = new Set();
    for (let i = 0; i < R.demo.cantidadSociosExtra; i++) {
      let n, a; do { n = pick(NOMBRES); a = pick(APELLIDOS); } while (usados.has(n + a)); usados.add(n + a);
      const r0 = rnd(), alta = T.sumarDias(hoy, r0 < 0.05 ? -2 - Math.floor(rnd() * 16) : r0 < 0.2 ? -Math.floor(rnd() * 170) - 3 : -Math.floor(180 + rnd() * 600));
      const baja = rnd() < 0.1 ? T.sumarDias(hoy, -Math.floor(rnd() * 175)) : null;
      st.socios.push({
        id: "s-" + (100 + i), nombre: n, apellido: a, dni: String(28000000 + Math.floor(rnd() * 17000000)),
        whatsapp: "54911" + (40000000 + Math.floor(rnd() * 59999999)), email: "", pin: String(1000 + Math.floor(rnd() * 9000)),
        planId: pick(["libre", "libre", "3x", "3x", "2x", "readaptacion"]),
        vence: T.sumarDias(hoy, Math.floor(rnd() * 37) - 6), alta: baja && baja < alta ? T.sumarDias(baja, -40) : alta,
        estado: baja ? "baja" : "activo", baja, objetivo: pick(OBJETIVOS), notifWhatsapp: rnd() < 0.5, notifVencimiento: true,
      });
    }
    // Pagos: cada socio paga un ciclo por mes hacia atrás desde su vencimiento
    st.socios.forEach((s) => {
      const p = plan(s.planId);
      let v = s.vence;
      for (let k = 0; k < 7; k++) {
        const fechaPago = T.sumarDias(v, -p.dias);
        if (fechaPago > hoy || fechaPago < s.alta) { v = fechaPago; continue; }
        if (s.baja && fechaPago > s.baja) { v = fechaPago; continue; }
        st.pagos.push({ id: uid("p"), socioId: s.id, fecha: fechaPago, monto: p.precio, planId: p.id, medio: pick(["Efectivo", "Transferencia", "Transferencia", "Mercado Pago"]), desde: fechaPago, hasta: v });
        v = fechaPago;
      }
    });

    // Reservas: 6 semanas para atrás y 7 días para adelante
    const activos = st.socios.filter((s) => s.estado === "activo" && !s.demo);
    const pico = (h) => { const m = T.aMin(h); return m < 600 ? 0.75 : m < 720 ? 0.45 : m < 1020 ? 0.3 : m < 1260 ? 0.92 : 0.55; };
    const extraAct = { musculacion: 0, personalizado: 0.1, funcional: 0.15, kinesiologia: 0.2, preparacion: 0.05 };
    for (let d = -42; d <= 7; d++) {
      const fecha = T.sumarDias(hoy, d);
      const ocupadosDia = new Set();
      const turnos = turnosDe(st, fecha).map((t) => [rnd(), t]).sort((x, y) => x[0] - y[0]).map((x) => x[1]); // orden aleatorio: que no se queden sin gente los turnos de la noche
      turnos.forEach((t) => {
        const a = actividad(t.actividadId);
        let tasa = Math.min(1, pico(t.hora) + extraAct[a.id] + (rnd() - 0.5) * 0.35);
        if (d > 0) tasa *= 0.55 + 0.45 * (1 - d / 8); // el futuro todavía se está llenando
        let n = Math.round(t.cupo * tasa);
        if (d >= 0 && rnd() < 0.18) n = t.cupo; // algunos completos
        const cand = activos.filter((s) => !ocupadosDia.has(s.id) && s.alta <= fecha);
        for (let k = 0; k < n && cand.length; k++) {
          const s = cand.splice(Math.floor(rnd() * cand.length), 1)[0];
          ocupadosDia.add(s.id);
          const pasado = T.ms(fecha, t.fin) < nowMs;
          st.reservas.push({
            id: uid("r"), codigo: codigo(), turnoId: t.id, socioId: s.id, actividadId: a.id, fecha, hora: t.hora, fin: t.fin,
            profeId: a.eligeProfe ? pick(a.profes) : t.profeId, estado: pasado ? (rnd() < 0.88 ? "asistio" : "ausente") : "confirmada",
            creada: T.ms(fecha, t.hora) - Math.floor(rnd() * 5 * 864e5), avisoWhatsapp: s.notifWhatsapp, avisoEnviado: pasado,
          });
        }
        // lista de espera en turnos completos del futuro
        if (d >= 0 && n >= t.cupo && rnd() < 0.6) {
          for (let k = 0; k < 1 + Math.floor(rnd() * 2) && cand.length; k++) {
            const s = cand.splice(Math.floor(rnd() * cand.length), 1)[0];
            ocupadosDia.add(s.id);
            st.reservas.push({ id: uid("r"), codigo: codigo(), turnoId: t.id, socioId: s.id, actividadId: a.id, fecha, hora: t.hora, fin: t.fin, profeId: t.profeId, estado: "espera", creada: nowMs - k * 6e5, avisoWhatsapp: false });
          }
        }
      });
    }

    // Historial y próximos turnos de los socios de la demo
    const agregar = (socioId, actId, fecha, horaPref, estado) => {
      const t = turnosDe(st, fecha, actId).find((x) => !horaPref || x.hora === horaPref) || turnosDe(st, fecha, actId)[0];
      if (!t) return;
      const a = actividad(actId);
      if (estado === "confirmada" && (t.pasado || t.disponibles <= 0)) return;
      if (st.reservas.some((r) => r.socioId === socioId && r.fecha === fecha && r.estado !== "cancelada")) return;
      st.reservas.push({ id: uid("r"), codigo: codigo(), turnoId: t.id, socioId, actividadId: actId, fecha, hora: t.hora, fin: t.fin, profeId: a.eligeProfe ? a.profes[0] : t.profeId, estado, creada: T.ms(fecha, t.hora) - 2 * 864e5, avisoWhatsapp: true, avisoEnviado: estado !== "confirmada" });
    };
    for (let d = -40; d < 0; d++) {
      const f = T.sumarDias(hoy, d), dia = T.diaSemana(f);
      if ([1, 3, 5].includes(dia)) agregar("s-martina", dia === 3 ? "funcional" : "musculacion", f, dia === 3 ? "19:00" : "18:30", rnd() < 0.9 ? "asistio" : "ausente");
      if ([2, 4].includes(dia)) agregar("s-lucas", "preparacion", f, "19:00", rnd() < 0.85 ? "asistio" : "ausente");
      if ([2, 4].includes(dia) && d < -6) agregar("s-sofia", "kinesiologia", f, "16:00", "asistio");
    }
    // Próximos: buscamos días hábiles con lugar
    let puestos = { "s-martina": 0, "s-lucas": 0 };
    for (let d = 0; d <= 7; d++) {
      const f = T.sumarDias(hoy, d), dia = T.diaSemana(f);
      if (dia === 0) continue;
      if (puestos["s-martina"] < 3) {
        const act = [1, 3, 5].includes(dia) ? "funcional" : "musculacion";
        const n = st.reservas.length;
        agregar("s-martina", act, f, act === "funcional" ? "19:00" : "18:30", "confirmada");
        if (st.reservas.length > n) puestos["s-martina"]++;
      }
      if (puestos["s-lucas"] < 1 && [2, 4, 6].includes(dia)) {
        const n = st.reservas.length;
        agregar("s-lucas", "preparacion", f, null, "confirmada");
        if (st.reservas.length > n) puestos["s-lucas"]++;
      }
    }
    // Un turno cancelado en el historial de Martina, para que se vea
    const unaVieja = st.reservas.find((r) => r.socioId === "s-martina" && r.estado === "asistio");
    if (unaVieja) { unaVieja.estado = "cancelada"; unaVieja.cancelada = unaVieja.creada + 36e5; }

    // Un feriado de ejemplo dentro de la ventana de reserva (si cae entre semana)
    const fer = T.sumarDias(hoy, 9);
    if (T.diaSemana(fer) !== 0) {
      st.bloqueos.push({ fecha: fer, motivo: "Feriado (ejemplo)" });
      st.reservas = st.reservas.filter((r) => r.fecha !== fer);
    }
    return st;
  }

  // =================================================================
  // Sesiones (fase 1: en el navegador)
  // =================================================================
  const sesion = {
    socio: () => { const s = ls.get(K_SESION); return s && s.exp > Date.now() ? s : null; },
    admin: () => { const s = ls.get(K_ADMIN); return s && s.exp > Date.now() ? s : null; },
  };
  function exigirSocio(id) { const s = sesion.socio(); if (!s || (id && s.socioId !== id)) throw new GIMError("sesion", "Tu sesión venció. Volvé a ingresar."); return s.socioId; }
  function exigirAdmin() { if (!sesion.admin()) throw new GIMError("sesion", "Ingresá al panel con la clave del gimnasio."); }

  // =================================================================
  // Interfaz pública (mismos métodos en api-supabase.js)
  // =================================================================
  const API = {
    backend: "local",
    T, DIAS, precio, plantillaTexto, ESTADOS, GIMError,
    actividades: () => R.actividades, profes: () => R.profes, planes: () => R.planes, actividad, profe, plan,

    /** Llama a fn cada vez que cambian los datos (otra pestaña, otro usuario en fase 2). */
    suscribir(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },

    // ---------- Configuración ----------
    async config() { return cfg(leer()); },
    async guardarConfig(cambios) {
      exigirAdmin();
      return tx((st) => { st.config = Object.assign({}, st.config, cambios); return cfg(st); });
    },

    // ---------- Acceso del socio ----------
    async login({ usuario, pin }) {
      const intentos = ls.get(K_INTENTOS) || { n: 0, hasta: 0 };
      if (intentos.hasta > Date.now()) throw new GIMError("bloqueo", "Demasiados intentos. Probá de nuevo en unos minutos.");
      const st = leer();
      const u = soloDigitos(usuario);
      if (u.length < 7) throw new GIMError("usuario", "Ingresá tu DNI o tu número de WhatsApp.");
      const s = st.socios.find((x) => x.estado !== "baja" && (x.dni === u || (u.length >= 8 && soloDigitos(x.whatsapp).endsWith(u.slice(-8)))));
      if (!s || s.pin !== String(pin)) {
        intentos.n++; if (intentos.n >= 5) { intentos.hasta = Date.now() + 5 * 6e4; intentos.n = 0; }
        ls.set(K_INTENTOS, intentos);
        throw new GIMError("credenciales", "El DNI/WhatsApp o el PIN no coinciden.");
      }
      ls.del(K_INTENTOS);
      ls.set(K_SESION, { socioId: s.id, exp: Date.now() + 30 * 864e5 });
      return socioPublico(st, s);
    },
    /** Fase 2: código de un solo uso por WhatsApp / link mágico por mail. */
    async solicitarCodigo() { throw new GIMError("fase2", "El ingreso con código por WhatsApp se habilita con el backend de Supabase."); },
    async logout() { ls.del(K_SESION); },
    async sesionSocio() { const s = sesion.socio(); if (!s) return null; const st = leer(); return socioPublico(st, st.socios.find((x) => x.id === s.socioId)); },

    // ---------- Socio ----------
    async miSocio() { const id = exigirSocio(); const st = leer(); return socioPublico(st, st.socios.find((x) => x.id === id)); },
    async actualizarPerfil(datos) {
      const id = exigirSocio();
      return tx((st) => {
        const s = st.socios.find((x) => x.id === id);
        ["email", "whatsapp", "objetivo", "notifWhatsapp", "notifVencimiento"].forEach((k) => { if (k in datos) s[k] = datos[k]; });
        if (datos.pinNuevo) {
          if (String(datos.pinActual) !== s.pin) throw new GIMError("pin", "El PIN actual no es correcto.");
          if (!/^\d{4}$/.test(datos.pinNuevo)) throw new GIMError("pin", "El PIN nuevo tiene que tener 4 números.");
          s.pin = datos.pinNuevo;
        }
        return socioPublico(st, s);
      });
    },
    async listarTurnos({ fecha, actividadId }) { return turnosDe(leer(), fecha, actividadId); },
    /** Días reservables con estado: { fecha, abierto, motivo, disponibles } */
    async diasDisponibles({ actividadId } = {}) {
      const st = leer(), c = cfg(st), hoy = T.hoy();
      return Array.from({ length: c.anticipacionDias }, (_, i) => {
        const fecha = T.sumarDias(hoy, i), b = bloqueo(st, fecha);
        const ts = b ? [] : turnosDe(st, fecha, actividadId).filter((t) => !t.pasado);
        const gymAbierto = (c.horarios[T.diaSemana(fecha)] || []).length > 0;
        return { fecha, abierto: ts.length > 0, motivo: b ? b.motivo || "Cerrado" : ts.length ? "" : gymAbierto ? "Sin clases" : "Cerrado", turnos: ts.length, libres: ts.reduce((n, t) => n + t.disponibles, 0) };
      });
    },
    async reservar({ turnoId, profeId, espera }) {
      const socioId = exigirSocio();
      return tx((st) => reservaPublica(st, nucleoReservar(st, { socioId, turnoId, profeId, espera })));
    },
    async cancelar(reservaId) {
      const socioId = exigirSocio();
      return tx((st) => { const r = nucleoCancelar(st, reservaId, { socioId }); return reservaPublica(st, r.reserva); });
    },
    async reprogramar({ reservaId, turnoId, profeId }) {
      const socioId = exigirSocio();
      return tx((st) => {
        const vieja = st.reservas.find((x) => x.id === reservaId && x.socioId === socioId);
        if (!vieja) throw new GIMError("reserva", "No encontramos ese turno.");
        if (vieja.turnoId === turnoId) throw new GIMError("igual", "Elegiste el mismo turno.");
        // Primero validamos el nuevo (ignorando el viejo), después cancelamos el viejo.
        const nueva = nucleoReservar(st, { socioId, turnoId, profeId, espera: false, ignorarReservaId: reservaId });
        nucleoCancelar(st, reservaId, { socioId, motivo: "Reprogramado" });
        nueva.reprogramadaDe = reservaId;
        return reservaPublica(st, nueva);
      });
    },
    async misReservas() {
      const id = exigirSocio(), st = leer(), now = Date.now();
      const mias = st.reservas.filter((r) => r.socioId === id).map((r) => reservaPublica(st, r));
      const prox = mias.filter((r) => (r.estado === "confirmada" || r.estado === "espera") && T.ms(r.fecha, r.fin) > now).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
      const hist = mias.filter((r) => !prox.includes(r)).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
      const mes = T.mes(T.hoy());
      return { proximas: prox, historial: hist, asistenciasMes: mias.filter((r) => r.estado === "asistio" && T.mes(r.fecha) === mes).length };
    },
    async marcarAviso(reservaId, valor) {
      const socioId = exigirSocio();
      return tx((st) => { const r = st.reservas.find((x) => x.id === reservaId && x.socioId === socioId); if (r) r.avisoWhatsapp = !!valor; return r && reservaPublica(st, r); });
    },
    async misPagos() { const id = exigirSocio(); return leer().pagos.filter((p) => p.socioId === id).sort((a, b) => b.fecha.localeCompare(a.fecha)); },

    // ---------- Panel: acceso ----------
    async loginAdmin(clave) {
      if (String(clave) !== String(R.admin.claveDemo)) throw new GIMError("credenciales", "Clave incorrecta.");
      ls.set(K_ADMIN, { exp: Date.now() + 12 * 36e5 }); return true;
    },
    async logoutAdmin() { ls.del(K_ADMIN); },
    async sesionAdmin() { return !!sesion.admin(); },

    // ---------- Panel: agenda ----------
    async agenda(fecha) {
      exigirAdmin();
      const st = leer();
      return turnosDe(st, fecha).map((t) => Object.assign(t, {
        reservas: st.reservas.filter((r) => r.turnoId === t.id && r.estado !== "cancelada").map((r) => reservaPublica(st, r))
          .sort((a, b) => (a.estado === "espera") - (b.estado === "espera") || a.creada - b.creada),
      }));
    },
    async marcarAsistencia(reservaId, estado) {
      exigirAdmin();
      return tx((st) => {
        const r = st.reservas.find((x) => x.id === reservaId);
        if (!r) throw new GIMError("reserva", "No encontramos ese turno.");
        if (!["asistio", "ausente", "confirmada"].includes(estado)) throw new GIMError("estado", "Estado inválido.");
        if (r.estado === "espera" || r.estado === "cancelada") throw new GIMError("estado", "Ese socio no tiene lugar confirmado en este turno.");
        r.estado = estado; r.marcada = Date.now();
        return reservaPublica(st, r);
      });
    },
    async cancelarComoAdmin(reservaId) {
      exigirAdmin();
      return tx((st) => { const r = nucleoCancelar(st, reservaId, { admin: true, motivo: "Cancelado por el gimnasio" }); return { reserva: reservaPublica(st, r.reserva), promovido: r.promovido && reservaPublica(st, r.promovido) }; });
    },
    /** Lee un QR: "GIM:R:<codigo>" (turno) o "GIM:S:<socioId>" (pase del socio). */
    async checkin(texto) {
      exigirAdmin();
      return tx((st) => {
        const raw = String(texto || "").trim().toUpperCase();
        const hoy = T.hoy(), now = T.ahora();
        let r = null, s = null;
        const mR = raw.match(/^GIM:R:([A-Z0-9]{6})$/) || raw.match(/^([A-Z0-9]{6})$/);
        const mS = String(texto || "").trim().match(/^GIM:S:(.+)$/i);
        if (mR) {
          r = st.reservas.find((x) => x.codigo === mR[1]);
          if (!r) throw new GIMError("qr", "Código no encontrado.");
          if (r.fecha !== hoy) throw new GIMError("qr", `Ese turno es del ${T.ddmm(r.fecha)}, no de hoy.`);
          s = st.socios.find((x) => x.id === r.socioId);
        } else if (mS) {
          s = st.socios.find((x) => x.id === mS[1]);
          if (!s) throw new GIMError("qr", "Socio no encontrado.");
          // el turno de hoy más cercano a la hora actual
          r = st.reservas.filter((x) => x.socioId === s.id && x.fecha === hoy && x.estado === "confirmada")
            .sort((a, b) => Math.abs(T.aMin(a.hora) - now.min) - Math.abs(T.aMin(b.hora) - now.min))[0] || null;
        } else throw new GIMError("qr", "Ese QR no es de GIM.");
        const m = membresia(st, s);
        if (r) {
          if (r.estado === "cancelada") throw new GIMError("qr", "Ese turno está cancelado.");
          if (r.estado === "espera") throw new GIMError("qr", `${s.nombre} está en lista de espera, no tiene lugar confirmado.`);
          r.estado = "asistio"; r.marcada = Date.now();
        }
        st.checkins.push({ socioId: s.id, ts: Date.now(), reservaId: r ? r.id : null });
        return { socio: socioPublico(st, s), reserva: r && reservaPublica(st, r), membresia: m };
      });
    },
    async recordatoriosPendientes() {
      exigirAdmin();
      const st = leer(), hoy = T.hoy(), man = T.sumarDias(hoy, 1), now = Date.now();
      return st.reservas.filter((r) => r.avisoWhatsapp && !r.avisoEnviado && r.estado === "confirmada" && (r.fecha === hoy || r.fecha === man) && T.ms(r.fecha, r.hora) > now)
        .map((r) => reservaPublica(st, r)).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    },
    async marcarAvisoEnviado(reservaId) { exigirAdmin(); return tx((st) => { const r = st.reservas.find((x) => x.id === reservaId); if (r) r.avisoEnviado = true; return true; }); },

    // ---------- Panel: franjas, cupos y bloqueos ----------
    async franjasSemana(lunes) { exigirAdmin(); const st = leer(); return { lunes, personalizada: !!st.semanas[lunes], franjas: clon(franjasSemana(st, lunes)) }; },
    async guardarFranja(f, { semana } = {}) {
      exigirAdmin();
      return tx((st) => {
        const a = actividad(f.actividadId);
        if (!a) throw new GIMError("actividad", "Elegí una actividad.");
        if (!/^\d{2}:\d{2}$/.test(f.hora)) throw new GIMError("hora", "Hora inválida.");
        const dur = Number(f.duracion) || a.duracion;
        const horario = cfg(st).horarios[f.dia] || [];
        const ini = T.aMin(f.hora);
        if (!horario.some(([x, y]) => ini >= T.aMin(x) && ini + dur <= T.aMin(y))) throw new GIMError("horario", `Ese horario queda fuera del horario del gimnasio del ${DIAS[f.dia].toLowerCase()}.`);
        const lista = semana ? (st.semanas[semana] = st.semanas[semana] || clon(st.plantilla)) : st.plantilla;
        const dup = lista.find((x) => x.id !== f.id && x.actividadId === f.actividadId && x.dia === Number(f.dia) && x.hora === f.hora);
        if (dup) throw new GIMError("duplicada", "Ya existe esa franja.");
        const nueva = { id: f.id || uid("f"), actividadId: f.actividadId, dia: Number(f.dia), hora: f.hora, cupo: Math.max(1, Number(f.cupo) || a.cupo), duracion: dur, profeId: a.eligeProfe ? null : f.profeId || a.profes[0] };
        const i = lista.findIndex((x) => x.id === nueva.id);
        if (i >= 0) lista[i] = nueva; else lista.push(nueva);
        return nueva;
      });
    },
    async borrarFranja(id, { semana } = {}) {
      exigirAdmin();
      return tx((st) => {
        const lista = semana ? (st.semanas[semana] = st.semanas[semana] || clon(st.plantilla)) : st.plantilla;
        const i = lista.findIndex((x) => x.id === id); if (i >= 0) lista.splice(i, 1); return true;
      });
    },
    async cupoActividad(actividadId, cupo) {
      exigirAdmin();
      return tx((st) => { const n = Math.max(1, Number(cupo) || 1); st.plantilla.forEach((f) => { if (f.actividadId === actividadId) f.cupo = n; }); Object.values(st.semanas).forEach((l) => l.forEach((f) => { if (f.actividadId === actividadId) f.cupo = n; })); return n; });
    },
    async duplicarSemana(lunes) {
      exigirAdmin();
      return tx((st) => { const sig = T.sumarDias(lunes, 7); st.semanas[sig] = clon(franjasSemana(st, lunes)).map((f) => Object.assign(f, { id: uid("f") })); return sig; });
    },
    async volverAPlantilla(lunes) { exigirAdmin(); return tx((st) => { delete st.semanas[lunes]; return true; }); },
    async bloqueos() { exigirAdmin(); return leer().bloqueos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)); },
    async bloquearDia(fecha, motivo) {
      exigirAdmin();
      return tx((st) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new GIMError("fecha", "Elegí una fecha.");
        if (bloqueo(st, fecha)) throw new GIMError("fecha", "Ese día ya está bloqueado.");
        st.bloqueos.push({ fecha, motivo: motivo || "Cerrado" });
        const afectadas = st.reservas.filter((r) => r.fecha === fecha && (r.estado === "confirmada" || r.estado === "espera"));
        afectadas.forEach((r) => { r.estado = "cancelada"; r.cancelada = Date.now(); r.motivo = motivo || "Día bloqueado"; });
        return afectadas.map((r) => reservaPublica(st, r));
      });
    },
    async desbloquearDia(fecha) { exigirAdmin(); return tx((st) => { st.bloqueos = st.bloqueos.filter((b) => b.fecha !== fecha); return true; }); },
    async reservasDelDia(fecha) { exigirAdmin(); const st = leer(); return st.reservas.filter((r) => r.fecha === fecha && (r.estado === "confirmada" || r.estado === "espera")).length; },

    // ---------- Panel: socios ----------
    async listarSocios({ q, estado } = {}) {
      exigirAdmin();
      const st = leer(), qq = String(q || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      return st.socios.map((s) => socioPublico(st, s))
        .filter((s) => !estado || estado === "todos" || s.membresia.estado === estado)
        .filter((s) => !qq || `${s.nombre} ${s.apellido} ${s.dni} ${s.whatsapp}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(qq))
        .sort((a, b) => a.apellido.localeCompare(b.apellido, "es") || a.nombre.localeCompare(b.nombre, "es"));
    },
    async socio(id) {
      exigirAdmin();
      const st = leer(), s = st.socios.find((x) => x.id === id);
      if (!s) throw new GIMError("socio", "Socio no encontrado.");
      const res = st.reservas.filter((r) => r.socioId === id).map((r) => reservaPublica(st, r)).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
      return Object.assign(socioPublico(st, s), { pin: s.pin, reservas: res, pagos: st.pagos.filter((p) => p.socioId === id).sort((a, b) => b.fecha.localeCompare(a.fecha)) });
    },
    async guardarSocio(d) {
      exigirAdmin();
      return tx((st) => {
        const dni = soloDigitos(d.dni), wa = soloDigitos(d.whatsapp);
        if (!d.nombre || !d.apellido) throw new GIMError("datos", "Completá nombre y apellido.");
        if (dni.length < 7) throw new GIMError("datos", "Revisá el DNI.");
        if (wa.length < 10) throw new GIMError("datos", "Revisá el WhatsApp (con código de área).");
        if (st.socios.some((x) => x.dni === dni && x.id !== d.id)) throw new GIMError("datos", "Ya hay un socio con ese DNI.");
        if (!plan(d.planId)) throw new GIMError("datos", "Elegí un plan.");
        const waNorm = wa.startsWith("54") ? wa : "549" + wa.replace(/^0/, "");
        let s = st.socios.find((x) => x.id === d.id);
        if (!s) {
          s = { id: uid("s"), alta: T.hoy(), estado: "activo", pin: String(1000 + Math.floor(Math.random() * 9000)), vence: T.sumarDias(T.hoy(), -1), notifWhatsapp: true, notifVencimiento: true };
          st.socios.push(s);
        }
        Object.assign(s, { nombre: d.nombre.trim(), apellido: d.apellido.trim(), dni, whatsapp: waNorm, email: (d.email || "").trim(), planId: d.planId, objetivo: d.objetivo || s.objetivo || "" });
        if (d.pin && /^\d{4}$/.test(d.pin)) s.pin = d.pin;
        return Object.assign(socioPublico(st, s), { pin: s.pin });
      });
    },
    async bajaSocio(id, baja = true) {
      exigirAdmin();
      return tx((st) => {
        const s = st.socios.find((x) => x.id === id);
        s.estado = baja ? "baja" : "activo"; s.baja = baja ? T.hoy() : null;
        if (baja) st.reservas.filter((r) => r.socioId === id && (r.estado === "confirmada" || r.estado === "espera") && r.fecha >= T.hoy())
          .forEach((r) => { const was = r.estado; r.estado = "cancelada"; r.motivo = "Baja del socio"; if (was === "confirmada") liberarCupo(st, r.turnoId); });
        return socioPublico(st, s);
      });
    },

    // ---------- Panel: pagos ----------
    async registrarPago({ socioId, planId, monto, medio, fecha }) {
      exigirAdmin();
      return tx((st) => {
        const s = st.socios.find((x) => x.id === socioId);
        if (!s) throw new GIMError("socio", "Elegí un socio.");
        const p = plan(planId || s.planId);
        const f = fecha || T.hoy();
        const desde = s.vence && s.vence >= f ? s.vence : f; // si está al día, se suma desde el vencimiento
        const hasta = T.sumarDias(desde, p.dias);
        const pago = { id: uid("p"), socioId, fecha: f, monto: Number(monto) || p.precio, planId: p.id, medio: medio || "Efectivo", desde, hasta };
        st.pagos.push(pago);
        s.planId = p.id; s.vence = hasta; if (s.estado === "baja") { s.estado = "activo"; s.baja = null; }
        return Object.assign(pago, { socio: socioPublico(st, s) });
      });
    },
    async pagos({ mes } = {}) {
      exigirAdmin();
      const st = leer(), m = mes || T.mes(T.hoy());
      return st.pagos.filter((p) => T.mes(p.fecha) === m).sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map((p) => { const s = st.socios.find((x) => x.id === p.socioId); return Object.assign({}, p, { socio: s ? `${s.nombre} ${s.apellido}` : "", plan: (plan(p.planId) || {}).nombre }); });
    },
    async vencimientos({ dias = 7 } = {}) {
      exigirAdmin();
      const st = leer(), hoy = T.hoy();
      const lista = st.socios.filter((s) => s.estado === "activo").map((s) => socioPublico(st, s));
      return {
        proximos: lista.filter((s) => s.membresia.diasRestantes >= 0 && s.membresia.diasRestantes <= dias).sort((a, b) => a.vence.localeCompare(b.vence)),
        vencidos: lista.filter((s) => s.membresia.diasRestantes < 0 && s.membresia.diasRestantes >= -30).sort((a, b) => b.vence.localeCompare(a.vence)),
        hoy,
      };
    },

    // ---------- Panel: reportes ----------
    async reportes({ semanas = 6 } = {}) {
      exigirAdmin();
      const st = leer(), hoy = T.hoy(), desde = T.sumarDias(T.lunes(hoy), -7 * (semanas - 1));
      const porAct = {}, pico = {}, semanal = [];
      for (let f = desde; f <= hoy; f = T.sumarDias(f, 1)) {
        turnosDe(st, f).filter((t) => t.pasado).forEach((t) => {
          const a = (porAct[t.actividadId] = porAct[t.actividadId] || { cupo: 0, ocupados: 0 });
          a.cupo += t.cupo; a.ocupados += t.ocupados;
          const k = `${T.diaSemana(f)}|${t.hora.slice(0, 2)}`;
          const p = (pico[k] = pico[k] || { cupo: 0, ocupados: 0 });
          p.cupo += t.cupo; p.ocupados += t.ocupados;
        });
      }
      for (let i = 0; i < semanas; i++) {
        const lun = T.sumarDias(desde, 7 * i), dom = T.sumarDias(lun, 6);
        const rs = st.reservas.filter((r) => r.fecha >= lun && r.fecha <= dom);
        semanal.push({ lunes: lun, asistencias: rs.filter((r) => r.estado === "asistio").length, ausencias: rs.filter((r) => r.estado === "ausente").length, enCurso: dom >= hoy });
      }
      const meses = [];
      for (let i = 5; i >= 0; i--) {
        const [y, m] = T.mes(hoy).split("-").map(Number);
        const d = new Date(Date.UTC(y, m - 1 - i, 1)), mm = d.toISOString().slice(0, 7);
        meses.push({ mes: mm, altas: st.socios.filter((s) => T.mes(s.alta) === mm).length, bajas: st.socios.filter((s) => s.baja && T.mes(s.baja) === mm).length,
          ingresos: st.pagos.filter((p) => T.mes(p.fecha) === mm).reduce((n, p) => n + p.monto, 0) });
      }
      const mesAct = T.mes(hoy);
      const ingresosPorPlan = R.planes.map((p) => ({ plan: p.nombre, total: st.pagos.filter((x) => T.mes(x.fecha) === mesAct && x.planId === p.id).reduce((n, x) => n + x.monto, 0) }));
      const lunAct = T.lunes(hoy);
      const activos = st.socios.filter((s) => s.estado === "activo").map((s) => membresia(st, s));
      return {
        desde, hasta: hoy,
        ocupacionActividad: R.actividades.map((a) => ({ id: a.id, nombre: a.nombre, ocupacion: porAct[a.id] && porAct[a.id].cupo ? porAct[a.id].ocupados / porAct[a.id].cupo : 0, ocupados: (porAct[a.id] || {}).ocupados || 0, cupo: (porAct[a.id] || {}).cupo || 0 })),
        pico: Object.entries(pico).map(([k, v]) => { const [dia, h] = k.split("|"); return { dia: Number(dia), hora: Number(h), ocupacion: v.cupo ? v.ocupados / v.cupo : 0, ocupados: v.ocupados, cupo: v.cupo }; }),
        semanal, meses, ingresosPorPlan,
        kpis: {
          sociosActivos: activos.filter((m) => m.estado !== "vencida").length,
          vencidos: activos.filter((m) => m.estado === "vencida").length,
          ocupacion: (() => { const t = Object.values(porAct).reduce((o, v) => ({ c: o.c + v.cupo, x: o.x + v.ocupados }), { c: 0, x: 0 }); return t.c ? t.x / t.c : 0; })(),
          asistenciasSemana: st.reservas.filter((r) => r.fecha >= lunAct && r.fecha <= hoy && r.estado === "asistio").length,
          ingresosMes: meses[5].ingresos, ingresosMesAnterior: meses[4].ingresos,
        },
      };
    },

    // ---------- Demo ----------
    async resetDemo() { exigirAdmin(); ls.del(KEY); memoria = null; const st = leer(); oyentes.forEach((fn) => fn()); canal && canal.postMessage({ t: Date.now() }); return true; },
    async exportar() { exigirAdmin(); return leer(); },
  };

  // Fase 2: si CONFIG.reservas.backend === "supabase", api-supabase.js reemplaza
  // los métodos de datos y deja los utilitarios (T, precio, etc.).
  window.GIMAPI = API;
})();
