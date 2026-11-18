/* GIM Adrogué · FASE 2: misma interfaz de GIMAPI contra Supabase.
 * Se activa con CONFIG.reservas.backend = "supabase" (+ url y anonKey).
 * Requiere haber corrido supabase/schema.sql. Ver supabase/README.md.
 *
 * Las reglas de negocio viven en Postgres (funciones reservar_turno,
 * cancelar_reserva, etc.); este archivo solo traduce nombres y formatos
 * para que la app y el panel no cambien ni una línea.
 */
(function () {
  "use strict";
  const R = CONFIG.reservas;
  if (R.backend !== "supabase") return;
  const L = window.GIMAPI; // utilitarios (T, precio, etc.) de la versión local
  const T = L.T, GIMError = L.GIMError;
  const SB_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";

  let sb = null;
  function cargar(src) { return new Promise((ok, mal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => mal(new GIMError("red", "No hay conexión con el servidor.")); document.head.appendChild(s); }); }
  async function cliente() {
    if (sb) return sb;
    if (!window.supabase) await cargar(SB_CDN);
    sb = window.supabase.createClient(R.supabase.url, R.supabase.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return sb;
  }
  // Errores de las funciones SQL: message = código, hint = texto para el usuario
  function ok({ data, error }) {
    if (error) throw new GIMError(error.message && /^[a-z-]+$/.test(error.message) ? error.message : "servidor", error.hint || "No pudimos completar la operación. Probá de nuevo.");
    return data;
  }
  const rpc = async (fn, args) => ok(await (await cliente()).rpc(fn, args));
  const tabla = async (t) => (await cliente()).from(t);

  // ---------- Formatos (mismos objetos que la versión local) ----------
  const hhmm = (t) => String(t || "").slice(0, 5);
  let cacheCfg = null;
  async function cfg() {
    if (cacheCfg) return cacheCfg;
    const filas = ok(await (await tabla("config")).select("clave, valor"));
    const c = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
    cacheCfg = {
      horarios: c.horarios || CONFIG.horarios, cancelacionHoras: c.cancelacionHoras ?? R.cancelacionHoras,
      anticipacionDias: c.anticipacionDias ?? R.anticipacionDias, listaEspera: c.listaEspera ?? R.listaEspera,
      venceProntoDias: R.venceProntoDias, textos: Object.assign({}, R.textos, c.textos || {}),
    };
    return cacheCfg;
  }
  function membresia(s, c) {
    const p = L.plan(s.plan_id) || { nombre: "Sin plan", dias: 30, precio: 0 };
    const dias = s.vence ? T.difDias(T.hoy(), s.vence) : -1;
    const estado = s.estado === "baja" ? "baja" : dias < 0 ? "vencida" : dias <= c.venceProntoDias ? "vence-pronto" : "al-dia";
    return { plan: p, vence: s.vence, diasRestantes: dias, estado, progreso: Math.max(0, Math.min(1, dias / (p.dias || 30))), puedeReservar: estado === "al-dia" || estado === "vence-pronto" };
  }
  function socio(s, c) {
    return {
      id: s.id, nombre: s.nombre, apellido: s.apellido, nombreCompleto: `${s.nombre} ${s.apellido}`, dni: s.dni, whatsapp: s.whatsapp, email: s.email,
      planId: s.plan_id, vence: s.vence, alta: s.alta, baja: s.baja, estado: s.estado, objetivo: s.objetivo,
      notifWhatsapp: s.notif_whatsapp, notifVencimiento: s.notif_vencimiento, membresia: membresia(s, c),
    };
  }
  function turno(t) {
    const ini = T.ms(t.fecha, hhmm(t.hora)), disp = Math.max(0, t.cupo - t.ocupados), pasado = ini <= Date.now();
    return {
      id: t.id, actividadId: t.actividad_id, fecha: t.fecha, hora: hhmm(t.hora), fin: hhmm(t.fin), duracion: T.aMin(hhmm(t.fin)) - T.aMin(hhmm(t.hora)),
      cupo: t.cupo, profeId: t.profe_id, ocupados: t.ocupados, espera: t.en_espera, disponibles: disp, pasado,
      estado: pasado ? "pasado" : disp === 0 ? "completo" : disp <= 2 ? "pocos" : "disponible",
    };
  }
  function reserva(r, c, extra = {}) {
    const t = r.turnos || {}, a = L.actividad(t.actividad_id), pr = L.profe(r.profe_id);
    const hora = hhmm(t.hora), ini = T.ms(t.fecha, hora), horas = (ini - Date.now()) / 36e5;
    return Object.assign({
      id: r.id, codigo: r.codigo, turnoId: r.turno_id, socioId: r.socio_id, actividadId: t.actividad_id, fecha: t.fecha, hora, fin: hhmm(t.fin),
      profeId: r.profe_id, estado: r.estado, creada: Date.parse(r.creada), motivo: r.motivo, avisoWhatsapp: r.aviso_whatsapp, avisoEnviado: r.aviso_enviado,
      actividad: a ? a.nombre : t.actividad_id, icono: a ? a.icono : "plan", profe: pr ? pr.nombre : null,
      socio: r.socios ? `${r.socios.nombre} ${r.socios.apellido}` : "", socioWhatsapp: r.socios ? r.socios.whatsapp : "",
      futura: ini > Date.now(), horasFaltan: horas, reprogramadaDe: r.reprogramada_de,
      puedeCancelar: r.estado === "espera" || (r.estado === "confirmada" && horas >= c.cancelacionHoras),
    }, extra);
  }
  const SEL_RES = "*, turnos(*), socios(nombre, apellido, whatsapp)";
  async function miFicha() {
    const c = await cfg();
    const { data: { user } } = await (await cliente()).auth.getUser();
    if (!user) throw new GIMError("sesion", "Tu sesión venció. Volvé a ingresar.");
    await rpc("vincular_socio");
    const s = ok(await (await tabla("socios")).select("*").eq("user_id", user.id).maybeSingle());
    if (!s) throw new GIMError("socio", "Tu usuario no está vinculado a una ficha de socio. Consultá en recepción.");
    return socio(s, c);
  }
  async function posiciones(lista) {
    // posición en la lista de espera (se calcula con las reservas visibles del turno)
    const esp = lista.filter((r) => r.estado === "espera");
    for (const r of esp) {
      const { count } = await (await tabla("reservas")).select("id", { count: "exact", head: true }).eq("turno_id", r.turnoId).eq("estado", "espera").lte("creada", new Date(r.creada).toISOString());
      r.posicionEspera = count || 1;
    }
    return lista;
  }

  const API = Object.assign({}, L, {
    backend: "supabase",
    suscribir(fn) {
      let canal = null;
      cliente().then((c) => { canal = c.channel("gim-turnos").on("postgres_changes", { event: "*", schema: "public", table: "turnos" }, () => fn())
        .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, () => fn()).subscribe(); });
      return () => canal && sb.removeChannel(canal);
    },
    async config() { return cfg(); },
    async guardarConfig(c) {
      const filas = Object.entries(c).map(([clave, valor]) => ({ clave, valor }));
      ok(await (await tabla("config")).upsert(filas)); cacheCfg = null; return cfg();
    },

    // ---------- Acceso del socio ----------
    // DNI/WhatsApp + PIN: el Worker valida el PIN con la service key y devuelve un token de un solo uso.
    async login({ usuario, pin }) {
      if (!R.supabase.workerUrl) throw new GIMError("config", "Falta configurar workerUrl para el ingreso con PIN.");
      const r = await fetch(R.supabase.workerUrl.replace(/\/$/, "") + "/auth/pin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ usuario, pin }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new GIMError(j.code || "credenciales", j.message || "El DNI/WhatsApp o el PIN no coinciden.");
      ok(await (await cliente()).auth.verifyOtp({ token_hash: j.token_hash, type: "magiclink" }));
      return miFicha();
    },
    // Link mágico por mail o código por WhatsApp (Supabase Auth + proveedor de WhatsApp/Twilio)
    async solicitarCodigo({ email, whatsapp }) {
      const c = await cliente();
      if (email) return ok(await c.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0], shouldCreateUser: false } }));
      return ok(await c.auth.signInWithOtp({ phone: "+" + String(whatsapp).replace(/\D/g, ""), options: { channel: "whatsapp", shouldCreateUser: false } }));
    },
    async verificarCodigo({ whatsapp, codigo }) {
      ok(await (await cliente()).auth.verifyOtp({ phone: "+" + String(whatsapp).replace(/\D/g, ""), token: codigo, type: "sms" }));
      return miFicha();
    },
    async logout() { await (await cliente()).auth.signOut(); },
    async sesionSocio() { const { data } = await (await cliente()).auth.getSession(); if (!data.session) return null; try { return await miFicha(); } catch (e) { return null; } },
    async miSocio() { return miFicha(); },
    async actualizarPerfil(d) { await rpc("actualizar_mi_perfil", { p_datos: d }); return miFicha(); },

    async listarTurnos({ fecha, actividadId }) { return (await rpc("turnos_rango", { p_desde: fecha, p_hasta: fecha, p_actividad: actividadId || null })).map(turno); },
    async diasDisponibles({ actividadId } = {}) {
      const c = await cfg(), hoy = T.hoy(), hasta = T.sumarDias(hoy, c.anticipacionDias - 1);
      const [ts, bl] = await Promise.all([rpc("turnos_rango", { p_desde: hoy, p_hasta: hasta, p_actividad: actividadId || null }), (await tabla("bloqueos")).select("*").gte("fecha", hoy).then(ok)]);
      const lista = ts.map(turno).filter((t) => !t.pasado);
      return Array.from({ length: c.anticipacionDias }, (_, i) => {
        const fecha = T.sumarDias(hoy, i), b = bl.find((x) => x.fecha === fecha), del = lista.filter((t) => t.fecha === fecha);
        const abiertoGym = (c.horarios[T.diaSemana(fecha)] || []).length > 0;
        return { fecha, abierto: !b && del.length > 0, motivo: b ? b.motivo : del.length ? "" : abiertoGym ? "Sin clases" : "Cerrado", turnos: del.length, libres: del.reduce((n, t) => n + t.disponibles, 0) };
      });
    },
    async reservar({ turnoId, profeId, espera }) {
      const r = await rpc("reservar_turno", { p_turno: turnoId, p_profe: profeId || null, p_espera: !!espera });
      const c = await cfg();
      const full = ok(await (await tabla("reservas")).select(SEL_RES).eq("id", r.id).single());
      return (await posiciones([reserva(full, c)]))[0];
    },
    async cancelar(id) { const r = await rpc("cancelar_reserva", { p_reserva: id }); return { id: r.id, estado: r.estado }; },
    async reprogramar({ reservaId, turnoId, profeId }) {
      const r = await rpc("reprogramar_reserva", { p_reserva: reservaId, p_turno: turnoId, p_profe: profeId || null });
      const full = ok(await (await tabla("reservas")).select(SEL_RES).eq("id", r.id).single());
      return reserva(full, await cfg());
    },
    async misReservas() {
      const yo = await miFicha(), c = await cfg();
      const filas = ok(await (await tabla("reservas")).select(SEL_RES).eq("socio_id", yo.id).order("creada", { ascending: false }).limit(200));
      const todas = filas.map((r) => reserva(r, c)), now = Date.now();
      const prox = todas.filter((r) => (r.estado === "confirmada" || r.estado === "espera") && T.ms(r.fecha, r.fin) > now).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
      const hist = todas.filter((r) => !prox.includes(r)).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
      const mes = T.mes(T.hoy());
      return { proximas: await posiciones(prox), historial: hist, asistenciasMes: todas.filter((r) => r.estado === "asistio" && T.mes(r.fecha) === mes).length };
    },
    async marcarAviso(id, v) { await rpc("marcar_aviso", { p_reserva: id, p_valor: !!v }); return true; },
    async misPagos() { const yo = await miFicha(); return ok(await (await tabla("pagos")).select("*").eq("socio_id", yo.id).order("fecha", { ascending: false })).map((p) => ({ id: p.id, fecha: p.fecha, monto: p.monto, planId: p.plan_id, medio: p.medio, desde: p.desde, hasta: p.hasta })); },

    // ---------- Panel ----------
    // En producción el panel entra con email + contraseña de un usuario cargado en la tabla admins.
    async loginAdmin(clave, email) {
      const c = await cliente();
      ok(await c.auth.signInWithPassword({ email, password: clave }));
      const { data: { user } } = await c.auth.getUser();
      const es = ok(await (await tabla("admins")).select("user_id").eq("user_id", user.id).maybeSingle());
      if (!es) { await c.auth.signOut(); throw new GIMError("credenciales", "Ese usuario no tiene permiso de administrador."); }
      return true;
    },
    async logoutAdmin() { await (await cliente()).auth.signOut(); },
    async sesionAdmin() {
      const c = await cliente(); const { data } = await c.auth.getSession(); if (!data.session) return false;
      return !!ok(await (await tabla("admins")).select("user_id").eq("user_id", data.session.user.id).maybeSingle());
    },
    async agenda(fecha) {
      const c = await cfg();
      const ts = (await rpc("turnos_rango", { p_desde: fecha, p_hasta: fecha, p_actividad: null })).map(turno);
      const rs = ts.length ? ok(await (await tabla("reservas")).select(SEL_RES).in("turno_id", ts.map((t) => t.id)).neq("estado", "cancelada").order("creada")) : [];
      return ts.map((t) => {
        let pos = 0;
        return Object.assign(t, { reservas: rs.filter((r) => r.turno_id === t.id).map((r) => reserva(r, c, r.estado === "espera" ? { posicionEspera: ++pos } : {}))
          .sort((a, b) => (a.estado === "espera") - (b.estado === "espera") || a.creada - b.creada) });
      });
    },
    async marcarAsistencia(id, estado) { return rpc("marcar_asistencia", { p_reserva: id, p_estado: estado }); },
    async cancelarComoAdmin(id) { await rpc("cancelar_reserva", { p_reserva: id, p_motivo: "Cancelado por el gimnasio" }); return { promovido: null }; },
    async checkin(texto) {
      const c = await cfg(), r = await rpc("checkin_qr", { p_texto: texto });
      const s = socio(ok(await (await tabla("socios")).select("*").eq("id", r.socio_id).single()), c);
      const res = r.reserva_id ? reserva(ok(await (await tabla("reservas")).select(SEL_RES).eq("id", r.reserva_id).single()), c) : null;
      return { socio: s, reserva: res, membresia: s.membresia };
    },
    async recordatoriosPendientes() {
      const c = await cfg(), hoy = T.hoy(), man = T.sumarDias(hoy, 1);
      const filas = ok(await (await tabla("reservas")).select("*, turnos!inner(*), socios(nombre, apellido, whatsapp)").eq("estado", "confirmada").eq("aviso_whatsapp", true).eq("aviso_enviado", false).in("turnos.fecha", [hoy, man]));
      return filas.map((r) => reserva(r, c)).filter((r) => r.futura).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    },
    async marcarAvisoEnviado(id) { ok(await (await tabla("reservas")).update({ aviso_enviado: true }).eq("id", id)); return true; },

    async franjasSemana(lunes) {
      let f = ok(await (await tabla("franjas")).select("*").eq("semana", lunes));
      const personalizada = f.length > 0;
      if (!personalizada) f = ok(await (await tabla("franjas")).select("*").is("semana", null));
      return { lunes, personalizada, franjas: f.map((x) => ({ id: x.id, actividadId: x.actividad_id, dia: x.dia, hora: hhmm(x.hora), cupo: x.cupo, duracion: x.duracion, profeId: x.profe_id })) };
    },
    async guardarFranja(f, { semana } = {}) {
      const a = L.actividad(f.actividadId);
      const fila = { actividad_id: f.actividadId, dia: Number(f.dia), hora: f.hora, cupo: Number(f.cupo) || a.cupo, duracion: Number(f.duracion) || a.duracion, profe_id: a.eligeProfe ? null : f.profeId || a.profes[0], semana: semana || null };
      if (f.id) ok(await (await tabla("franjas")).update(fila).eq("id", f.id)); else ok(await (await tabla("franjas")).insert(fila));
      await rpc("regenerar_turnos", { p_desde: T.hoy() });
      return fila;
    },
    async borrarFranja(id) { ok(await (await tabla("franjas")).delete().eq("id", id)); await rpc("regenerar_turnos", { p_desde: T.hoy() }); return true; },
    async cupoActividad(id, cupo) {
      const n = Math.max(1, Number(cupo) || 1);
      ok(await (await tabla("franjas")).update({ cupo: n }).eq("actividad_id", id)); ok(await (await tabla("actividades")).update({ cupo: n }).eq("id", id));
      await rpc("regenerar_turnos", { p_desde: T.hoy() }); return n;
    },
    async duplicarSemana(lunes) {
      const sig = T.sumarDias(lunes, 7), { franjas } = await API.franjasSemana(lunes);
      ok(await (await tabla("franjas")).delete().eq("semana", sig));
      ok(await (await tabla("franjas")).insert(franjas.map((f) => ({ actividad_id: f.actividadId, dia: f.dia, hora: f.hora, cupo: f.cupo, duracion: f.duracion, profe_id: f.profeId, semana: sig }))));
      await rpc("regenerar_turnos", { p_desde: T.hoy() }); return sig;
    },
    async volverAPlantilla(lunes) { ok(await (await tabla("franjas")).delete().eq("semana", lunes)); await rpc("regenerar_turnos", { p_desde: T.hoy() }); return true; },
    async bloqueos() { return ok(await (await tabla("bloqueos")).select("*").order("fecha")); },
    async bloquearDia(fecha, motivo) { await rpc("bloquear_dia", { p_fecha: fecha, p_motivo: motivo || "Cerrado" }); return []; },
    async desbloquearDia(fecha) { ok(await (await tabla("bloqueos")).delete().eq("fecha", fecha)); return true; },
    async reservasDelDia(fecha) {
      const { count } = await (await tabla("reservas")).select("id, turnos!inner(fecha)", { count: "exact", head: true }).eq("turnos.fecha", fecha).in("estado", ["confirmada", "espera"]);
      return count || 0;
    },

    async listarSocios({ q, estado } = {}) {
      const c = await cfg();
      let qb = (await tabla("socios")).select("*").order("apellido").limit(1000);
      if (q) { const s = q.replace(/[%,]/g, ""); qb = qb.or(`nombre.ilike.%${s}%,apellido.ilike.%${s}%,dni.ilike.%${s}%,whatsapp.ilike.%${s}%`); }
      return ok(await qb).map((s) => socio(s, c)).filter((s) => !estado || estado === "todos" || s.membresia.estado === estado);
    },
    async socio(id) {
      const c = await cfg();
      const [s, rs, ps] = await Promise.all([
        (await tabla("socios")).select("*").eq("id", id).single().then(ok),
        (await tabla("reservas")).select(SEL_RES).eq("socio_id", id).order("creada", { ascending: false }).limit(100).then(ok),
        (await tabla("pagos")).select("*").eq("socio_id", id).order("fecha", { ascending: false }).then(ok),
      ]);
      return Object.assign(socio(s, c), { pin: "••••", reservas: rs.map((r) => reserva(r, c)).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)), pagos: ps.map((p) => ({ fecha: p.fecha, monto: p.monto, planId: p.plan_id, medio: p.medio })) });
    },
    async guardarSocio(d) {
      const dig = (x) => String(x || "").replace(/\D/g, "");
      const wa = dig(d.whatsapp), fila = { nombre: d.nombre.trim(), apellido: d.apellido.trim(), dni: dig(d.dni), whatsapp: wa.startsWith("54") ? wa : "549" + wa.replace(/^0/, ""), email: d.email || null, plan_id: d.planId, objetivo: d.objetivo };
      const s = d.id ? ok(await (await tabla("socios")).update(fila).eq("id", d.id).select().single()) : ok(await (await tabla("socios")).insert(fila).select().single());
      const pin = d.pin && /^\d{4}$/.test(d.pin) ? d.pin : d.id ? null : String(1000 + Math.floor(Math.random() * 9000));
      if (pin) await rpc("fijar_pin", { p_socio: s.id, p_pin: pin });
      return Object.assign(socio(s, await cfg()), { pin: pin || "••••" });
    },
    async bajaSocio(id, baja = true) { return socio(await rpc("baja_socio", { p_socio: id, p_baja: !!baja }), await cfg()); },
    async registrarPago({ socioId, planId, monto, medio, fecha }) {
      const p = await rpc("registrar_pago", { p_socio: socioId, p_plan: planId, p_monto: Number(monto) || null, p_medio: medio || "Efectivo", p_fecha: fecha || null });
      return { fecha: p.fecha, monto: p.monto, planId: p.plan_id, medio: p.medio, desde: p.desde, hasta: p.hasta };
    },
    async pagos({ mes } = {}) {
      const m = mes || T.mes(T.hoy()), [y, mm] = m.split("-").map(Number), fin = new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
      return ok(await (await tabla("pagos")).select("*, socios(nombre, apellido)").gte("fecha", m + "-01").lte("fecha", fin).order("fecha", { ascending: false }))
        .map((p) => ({ id: p.id, fecha: p.fecha, monto: p.monto, planId: p.plan_id, medio: p.medio, socio: p.socios ? `${p.socios.nombre} ${p.socios.apellido}` : "", plan: (L.plan(p.plan_id) || {}).nombre }));
    },
    async vencimientos({ dias = 7 } = {}) {
      const lista = await API.listarSocios({});
      const act = lista.filter((s) => s.estado === "activo");
      return {
        proximos: act.filter((s) => s.membresia.diasRestantes >= 0 && s.membresia.diasRestantes <= dias).sort((a, b) => a.vence.localeCompare(b.vence)),
        vencidos: act.filter((s) => s.membresia.diasRestantes < 0 && s.membresia.diasRestantes >= -30).sort((a, b) => b.vence.localeCompare(a.vence)),
        hoy: T.hoy(),
      };
    },
    async reportes({ semanas = 6 } = {}) {
      const r = await rpc("reporte_panel", { p_semanas: semanas });
      r.ocupacionActividad = r.ocupacionActividad.map((a) => Object.assign(a, { ocupacion: Number(a.ocupacion) }));
      r.pico = r.pico.map((p) => Object.assign(p, { ocupacion: Number(p.ocupacion) }));
      r.kpis.ocupacion = Number(r.kpis.ocupacion);
      return r;
    },
    async resetDemo() { throw new GIMError("fase2", "Con Supabase no hay datos de ejemplo para restablecer."); },
    async exportar() {
      const out = {};
      for (const t of ["socios", "pagos", "franjas", "bloqueos", "config"]) out[t] = ok(await (await tabla(t)).select("*"));
      return out;
    },
  });
  window.GIMAPI = API;
})();
