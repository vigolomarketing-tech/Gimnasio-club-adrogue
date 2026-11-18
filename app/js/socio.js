/* GIM Adrogué · App del socio (/app/) */
(function () {
  "use strict";
  const A = window.GIMAPI, U = window.UI, T = A.T, C = CONFIG, R = C.reservas;
  const { $, $$, esc, icon } = U;
  const root = $("#app");

  let yo = null;        // socio logueado
  let ajustes = null;   // configuración efectiva
  const flujo = { actividadId: null, fecha: null, turnoId: null, profeId: null, reprogramar: null };

  // ---------------------------------------------------------------
  // Esqueleto de la app
  // ---------------------------------------------------------------
  const NAV = [["inicio", "Inicio", "home"], ["reservar", "Reservar", "plus"], ["turnos", "Mis turnos", "list"], ["pase", "Pase", "qr"], ["perfil", "Perfil", "user"]];
  function shell() {
    root.innerHTML = `
      <header class="topbar">
        <a class="logo" href="#/inicio" aria-label="GIM Adrogué, inicio">${U.ICON.tri}<b>GIM</b><span>Club Atlético<br>Adrogué</span></a>
        <div class="topbar__actions"><button class="install-chip" id="instalar">${icon("install")} Instalar app</button></div>
      </header>
      <main id="main" tabindex="-1"></main>
      <nav class="bottomnav" aria-label="Secciones">
        ${NAV.map(([id, txt, ic]) => `<a href="#/${id}" data-nav="${id}" class="${id === "reservar" ? "nav-cta" : ""}">${icon(ic)}<span>${txt}</span></a>`).join("")}
      </nav>`;
    $("#instalar").addEventListener("click", U.instalar);
    actualizarInstalar();
  }
  function actualizarInstalar() { const b = $("#instalar"); if (b) b.classList.toggle("is-visible", U.puedeInstalar()); }
  const main = () => $("#main");
  function marcarNav(id) { $$("[data-nav]").forEach((a) => (a.dataset.nav === id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"))); }
  const cargando = (n = 3) => Array.from({ length: n }, () => '<div class="skeleton"></div>').join("");
  function error(e) { console.error(e); U.toast(e.message || "Algo salió mal. Probá de nuevo.", "bad"); if (e.code === "sesion") salir(); }

  // ---------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------
  const VISTAS = { inicio, reservar, turnos, pase, perfil, membresia };
  async function router() {
    const [ruta, param] = location.hash.replace(/^#\/?/, "").split("/");
    if (!yo) { yo = await A.sesionSocio(); }
    if (!yo) return login();
    if (!$("#main")) shell();
    const v = VISTAS[ruta] ? ruta : "inicio";
    marcarNav(v === "membresia" ? "perfil" : v);
    main().innerHTML = `<div class="view">${cargando()}</div>`;
    try {
      yo = await A.miSocio();
      ajustes = ajustes || (await A.config());
      await VISTAS[v](param);
    } catch (e) { error(e); }
    main().focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", router);
  A.suscribir(() => { // cupos "en tiempo real": si cambia algo en otra pestaña o dispositivo
    const v = location.hash.replace(/^#\/?/, "").split("/")[0];
    if (yo && (v === "reservar" && flujo.fecha)) pintarHorarios();
  });

  // ---------------------------------------------------------------
  // Ingreso
  // ---------------------------------------------------------------
  function login() {
    document.title = "Ingresar · GIM Adrogué";
    const demo = R.demo && R.demo.mostrarAccesos && R.backend === "local";
    root.innerHTML = `
      <main class="login" id="main">
        <div class="login__box">
          <div class="login__brand">${U.ICON.tri}<b>GIM</b><span>Turnos · Club Atlético Adrogué</span></div>
          <form class="card" id="f-login" novalidate>
            <h1 style="font-size:1.6rem">Ingresá a tu cuenta</h1>
            <div class="field"><label for="usuario">DNI o WhatsApp</label>
              <input class="input" id="usuario" name="usuario" inputmode="numeric" autocomplete="username" placeholder="Ej: 35123456" required></div>
            <div class="field"><label for="pin">PIN de 4 números</label>
              <input class="input input--pin" id="pin" name="pin" type="password" inputmode="numeric" pattern="\\d{4}" maxlength="4" autocomplete="current-password" required></div>
            <p class="form-error" id="err" role="alert"></p>
            <button class="btn btn--primary btn--block" type="submit">Entrar</button>
            <p class="center small" style="margin:12px 0 0"><a href="${U.waGym(ajustesTexto("olvidePin"))}" target="_blank" rel="noopener">¿Olvidaste tu PIN? Escribinos</a></p>
          </form>
          ${demo ? `<div class="demo-box"><p><b>Demo:</b> tocá un socio de prueba para completar los datos.</p>
            ${R.demo.socios.map((s) => `<button type="button" data-dni="${s.dni}" data-pin="${s.pin}"><span><b>${esc(s.nombre)} ${esc(s.apellido)}</b><small>DNI ${s.dni} · PIN ${s.pin}</small></span><span class="chip ${s.venceEnDias < 0 ? "chip--bad" : s.venceEnDias <= R.venceProntoDias ? "chip--warn" : "chip--ok"}">${s.venceEnDias < 0 ? "Plan vencido" : s.venceEnDias <= R.venceProntoDias ? "Vence pronto" : "Al día"}</span></button>`).join("")}</div>` : ""}
          <p class="footer-note"><a href="../">← Volver a la web</a> · <a href="./admin/">Panel del gimnasio</a></p>
        </div>
      </main>`;
    const f = $("#f-login");
    $$(".demo-box button").forEach((b) => b.addEventListener("click", () => { f.usuario.value = b.dataset.dni; f.pin.value = b.dataset.pin; f.querySelector("[type=submit]").focus(); }));
    f.pin.addEventListener("input", () => { f.pin.value = f.pin.value.replace(/\D/g, "").slice(0, 4); });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = f.querySelector("[type=submit]");
      btn.disabled = true; $("#err").textContent = "";
      try {
        yo = await A.login({ usuario: f.usuario.value, pin: f.pin.value });
        root.innerHTML = "";
        location.hash = "#/inicio"; router();
      } catch (er) { $("#err").textContent = er.message; f.pin.value = ""; f.pin.focus(); }
      btn.disabled = false;
    });
  }
  function ajustesTexto(k) { return (ajustes && ajustes.textos[k]) || R.textos[k] || ""; }
  async function salir() { await A.logout(); yo = null; root.innerHTML = ""; location.hash = ""; login(); }

  const nombreCorto = () => yo.nombre;
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const vars = (extra = {}) => Object.assign({ nombre: `${yo.nombre} ${yo.apellido}`, plan: yo.membresia.plan.nombre, precio: A.precio(yo.membresia.plan.precio), vence: T.ddmmaa(yo.vence) }, extra);

  // ---------------------------------------------------------------
  // Inicio
  // ---------------------------------------------------------------
  function tarjetaMembresia(m, enlace = true) {
    const d = m.diasRestantes;
    const barCls = m.estado === "vencida" ? "bar--bad" : m.estado === "vence-pronto" ? "bar--warn" : "";
    return `<section class="card card--accent member-card" aria-label="Tu membresía">
      <div class="member-card__top"><div><p class="small muted" style="margin:0">Tu plan</p><div class="member-card__plan">${esc(m.plan.nombre)}</div></div>${U.chipMembresia(m)}</div>
      ${d >= 0 ? `<div class="member-card__days"><b>${d}</b><span class="muted">${d === 1 ? "día restante" : "días restantes"}</span></div>`
        : `<div class="member-card__days"><b style="color:var(--bad)">${-d}</b><span class="muted">${-d === 1 ? "día vencido" : "días vencido"}</span></div>`}
      <div class="bar ${barCls}" role="progressbar" aria-label="Tiempo restante del plan" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(m.progreso * 100)}"><span style="width:${Math.max(3, m.progreso * 100)}%"></span></div>
      <p class="small muted" style="margin:10px 0 0">${d >= 0 ? "Vence el " : "Venció el "}<b style="color:var(--text)">${esc(T.largo(m.vence))}</b></p>
      ${m.estado !== "al-dia" ? `<a class="btn btn--primary btn--block" style="margin-top:14px" href="${U.waGym(A.plantillaTexto(ajustesTexto("renovar"), vars()))}" target="_blank" rel="noopener">${icon("wa")} Renovar por WhatsApp</a>`
        : enlace ? `<a class="link-btn" style="padding:0;margin-top:6px;display:inline-flex;align-items:center" href="#/membresia">Ver membresía y pagos</a>` : ""}
    </section>`;
  }

  async function inicio() {
    document.title = "Inicio · GIM Adrogué";
    const { proximas, asistenciasMes } = await A.misReservas();
    const prox = proximas.find((r) => r.estado === "confirmada") || proximas[0];
    const ahora = T.ahora();
    const horHoy = (ajustes.horarios[ahora.dia] || []);
    const abierto = horHoy.some(([a, b]) => ahora.min >= T.aMin(a) && ahora.min < T.aMin(b));
    const m = yo.membresia;
    main().innerHTML = `<div class="view">
      <div class="hello"><h1>¡Hola, ${esc(nombreCorto())}!</h1><p>${esc(cap(T.largo(ahora.fecha)))}</p></div>
      ${m.estado === "vencida" ? `<div class="alert" role="alert">${icon("lock")}<p><b>Tu plan venció.</b> Podés ver los horarios, pero para reservar tenés que renovarlo.</p></div>` : ""}
      ${tarjetaMembresia(m)}
      <a class="btn btn--primary btn--xl btn--block" style="margin-top:16px" href="#/reservar">${icon("plus")} Reservar turno</a>
      <p class="section-label">Tu próximo turno</p>
      ${prox ? `<article class="card"><div class="next">${U.datebadge(prox.fecha)}<div class="next__info"><strong>${esc(prox.actividad)}</strong>
          <span class="muted">${esc(prox.hora)} a ${esc(prox.fin)} hs${prox.profe ? " · " + esc(prox.profe) : ""}</span><div style="margin-top:6px">${U.chipReserva(prox)}</div></div></div>
          <div class="btn-row" style="margin-top:14px"><a class="btn btn--ghost btn--sm" href="#/pase">${icon("qr")} Ver pase</a><a class="btn btn--ghost btn--sm" href="#/turnos">Mis turnos</a></div></article>`
        : `<div class="card empty">${icon("cal")}<p>No tenés turnos reservados.</p><a class="btn btn--ghost btn--sm" href="#/reservar">Reservar ahora</a></div>`}
      <div class="stats-mini" style="margin-top:12px">
        <div class="card"><b>${asistenciasMes}</b><span class="small muted">entrenamientos este mes</span></div>
        <div class="card"><b>${proximas.length}</b><span class="small muted">turnos próximos</span></div>
      </div>
      <p class="section-label">Hoy en el gimnasio</p>
      <div class="card"><div class="kv"><dt>${icon("clock")}</dt><dd>${horHoy.length ? horHoy.map(([a, b]) => `${a} a ${b} hs`).join(" y ") : "Cerrado"}</dd></div>
        <div class="kv"><dt>Estado</dt><dd><span class="chip ${abierto ? "chip--ok" : "chip--plain"}">${abierto ? "Abierto ahora" : "Cerrado ahora"}</span></dd></div>
        <div class="kv"><dt>Dirección</dt><dd><a href="${esc(C.contacto.mapsLink)}" target="_blank" rel="noopener">${esc(C.contacto.direccion)}</a></dd></div></div>
      <p class="footer-note">Web hecha por <a href="https://vigolowebstudio.com" target="_blank" rel="noopener">Vigolo Web Studio</a></p>
    </div>`;
  }

  // ---------------------------------------------------------------
  // Reservar
  // ---------------------------------------------------------------
  async function reservar(param) {
    document.title = "Reservar turno · GIM Adrogué";
    if (param && param.startsWith("repro-")) {
      const id = param.slice(6);
      const { proximas } = await A.misReservas();
      const r = proximas.find((x) => x.id === id);
      if (r) Object.assign(flujo, { reprogramar: r, actividadId: r.actividadId, fecha: null, turnoId: null, profeId: r.profeId });
    } else if (!param) {
      if (flujo.reprogramar) Object.assign(flujo, { reprogramar: null, actividadId: null, fecha: null, turnoId: null, profeId: null });
    }
    const paso = !flujo.actividadId ? 1 : 2;
    const m = yo.membresia;
    main().innerHTML = `<div class="view">
      <div class="view__title">${paso > 1 && !flujo.reprogramar ? `<button class="icon-btn" id="atras" aria-label="Cambiar actividad">${icon("back")}</button>` : ""}<h1>${flujo.reprogramar ? "Reprogramar" : "Reservar turno"}</h1></div>
      <div class="steps" aria-hidden="true"><span class="is-on"></span><span class="${paso > 1 ? "is-on" : ""}"></span><span class="${flujo.turnoId ? "is-on" : ""}"></span></div>
      ${flujo.reprogramar ? `<div class="alert alert--info banner-repro"><p>Cambiando <b>${esc(flujo.reprogramar.actividad)}</b> del ${esc(T.corto(flujo.reprogramar.fecha))} a las ${esc(flujo.reprogramar.hora)} hs.</p><button class="link-btn" id="cancel-repro">Cancelar</button></div>` : ""}
      ${!m.puedeReservar ? `<div class="alert" role="alert">${icon("lock")}<div><p><b>Tu plan está vencido.</b> Podés mirar los horarios, pero para reservar tenés que renovarlo.</p><a class="btn btn--primary btn--sm" style="margin-top:10px" href="${U.waGym(A.plantillaTexto(ajustesTexto("renovar"), vars()))}" target="_blank" rel="noopener">${icon("wa")} Renovar por WhatsApp</a></div></div>` : ""}
      <div id="paso"></div>
    </div>`;
    $("#atras") && $("#atras").addEventListener("click", () => { Object.assign(flujo, { actividadId: null, fecha: null, turnoId: null, profeId: null }); reservar("x"); });
    $("#cancel-repro") && $("#cancel-repro").addEventListener("click", () => { flujo.reprogramar = null; location.hash = "#/turnos"; });
    if (paso === 1) return pasoActividad();
    return pasoDiaHora();
  }

  function pasoActividad() {
    $("#paso").innerHTML = `<p class="section-label" style="margin-top:0">1 · Elegí la actividad</p><div class="act-list">
      ${A.actividades().map((a) => `<button class="act" data-act="${a.id}">
        <span class="act__icon">${icon(a.icono)}</span><span><strong>${esc(a.nombre)}</strong><small>${esc(a.descripcion)}</small><small class="dim">${a.duracion} min · hasta ${a.cupo} ${a.cupo === 1 ? "persona" : "personas"}</small></span></button>`).join("")}
    </div>`;
    $$("[data-act]").forEach((b) => b.addEventListener("click", () => { Object.assign(flujo, { actividadId: b.dataset.act, fecha: null, turnoId: null, profeId: null }); reservar("x"); }));
  }

  async function pasoDiaHora() {
    const a = A.actividad(flujo.actividadId);
    const dias = await A.diasDisponibles({ actividadId: a.id });
    if (!flujo.fecha || !dias.find((d) => d.fecha === flujo.fecha && d.abierto)) flujo.fecha = (dias.find((d) => d.abierto) || {}).fecha || null;
    $("#paso").innerHTML = `
      <div class="card" style="display:flex;gap:12px;align-items:center;padding:12px 14px"><span class="act__icon">${icon(a.icono)}</span><div><strong>${esc(a.nombre)}</strong><div class="small muted">${a.duracion} min</div></div></div>
      <p class="section-label">2 · Elegí el día</p>
      <div class="days" role="group" aria-label="Días disponibles">
        ${dias.map((d) => `<button class="day" data-fecha="${d.fecha}" aria-pressed="${d.fecha === flujo.fecha}" ${d.abierto ? "" : "disabled"} aria-label="${esc(T.largo(d.fecha))}${d.abierto ? "" : ", " + esc(d.motivo)}">
          <small>${esc(T.fmt(d.fecha, { weekday: "short" }).replace(".", ""))}</small><b>${Number(d.fecha.slice(8))}</b><i>${d.abierto ? (d.fecha === T.hoy() ? "Hoy" : esc(T.fmt(d.fecha, { month: "short" }).replace(".", ""))) : esc(d.motivo.length > 10 ? "Cerrado" : d.motivo)}</i></button>`).join("")}
      </div>
      <p class="section-label">3 · Elegí el horario</p>
      <div id="horarios" aria-live="polite"></div>
      <div id="profes"></div>
      <div class="sticky-cta"><button class="btn btn--primary btn--block btn--xl" id="continuar" disabled>Continuar</button></div>`;
    $$(".day").forEach((b) => b.addEventListener("click", () => {
      flujo.fecha = b.dataset.fecha; flujo.turnoId = null;
      $$(".day").forEach((x) => x.setAttribute("aria-pressed", x === b)); pintarHorarios();
    }));
    const sel = $(`.day[aria-pressed="true"]`); sel && sel.scrollIntoView({ inline: "center", block: "nearest" });
    $("#continuar").addEventListener("click", confirmarReserva);
    await pintarHorarios();
  }

  async function pintarHorarios() {
    const box = $("#horarios"); if (!box) return;
    if (!flujo.fecha) { box.innerHTML = `<div class="card empty">${icon("cal")}<p>No hay turnos de esta actividad en los próximos días.</p></div>`; return actualizarCTA(); }
    const a = A.actividad(flujo.actividadId);
    const [ts, mias] = await Promise.all([A.listarTurnos({ fecha: flujo.fecha, actividadId: a.id }), A.misReservas()]);
    const activas = mias.proximas.filter((r) => r.estado !== "cancelada" && (!flujo.reprogramar || r.id !== flujo.reprogramar.id));
    const mios = new Set(activas.map((r) => r.turnoId));
    const choca = (t) => activas.find((r) => r.fecha === t.fecha && r.turnoId !== t.id && T.aMin(r.hora) < T.aMin(t.fin) && T.aMin(t.hora) < T.aMin(r.fin));
    const visibles = ts.filter((t) => !t.pasado);
    if (!visibles.length) { box.innerHTML = `<div class="card empty">${icon("clock")}<p>Ya no quedan turnos para este día. Probá con otro.</p></div>`; flujo.turnoId = null; return actualizarCTA(); }
    box.innerHTML = `<div class="slots">${visibles.map((t) => {
      const mio = mios.has(t.id) && (!flujo.reprogramar || flujo.reprogramar.turnoId !== t.id);
      const esActual = flujo.reprogramar && flujo.reprogramar.turnoId === t.id;
      const otro = !mio && !esActual && choca(t);
      const cls = mio || esActual || otro ? "slot--mine" : t.estado === "completo" ? "slot--full" : t.estado === "pocos" ? "slot--few" : "slot--ok";
      const estado = esActual ? "Tu turno actual" : mio ? "Ya reservaste" : otro ? `Tenés ${esc(otro.actividad)}<br><span class="dim">a las ${otro.hora}</span>` : t.estado === "completo" ? (ajustes.listaEspera ? `Completo<br><span class="dim">Lista de espera${t.espera ? " (" + t.espera + ")" : ""}</span>` : "Completo")
        : t.disponibles === 1 ? "¡Queda 1 lugar!" : `Quedan ${t.disponibles} lugares`;
      const pr = t.profeId ? A.profe(t.profeId) : null;
      const deshab = mio || esActual || otro || (t.estado === "completo" && (!ajustes.listaEspera || flujo.reprogramar));
      return `<button class="slot ${cls}" data-turno="${t.id}" aria-pressed="${flujo.turnoId === t.id}" ${deshab ? "disabled" : ""}>
        <span class="slot__time">${t.hora}<small>a ${t.fin}</small></span>
        <span class="slot__info"><span class="small muted">${pr ? esc(pr.nombre) : a.eligeProfe ? "Elegís profe" : ""}</span>
          <span class="bar" aria-hidden="true"><span style="width:${Math.min(100, (t.ocupados / t.cupo) * 100)}%"></span></span>
          <span class="sr-only">${t.ocupados} de ${t.cupo} lugares ocupados</span></span>
        <span class="slot__state">${estado}</span></button>`;
    }).join("")}</div>`;
    if (flujo.turnoId && !visibles.find((t) => t.id === flujo.turnoId)) flujo.turnoId = null;
    $$(".slot").forEach((b) => b.addEventListener("click", () => {
      flujo.turnoId = b.dataset.turno;
      $$(".slot").forEach((x) => x.setAttribute("aria-pressed", x === b));
      pintarProfes(); actualizarCTA();
    }));
    pintarProfes(); actualizarCTA();
  }

  function pintarProfes() {
    const a = A.actividad(flujo.actividadId), box = $("#profes");
    if (!a.eligeProfe || !flujo.turnoId) { box.innerHTML = ""; return; }
    if (!a.profes.includes(flujo.profeId)) flujo.profeId = null;
    box.innerHTML = `<p class="section-label">4 · ¿Con quién querés entrenar?</p><div class="profes" role="group" aria-label="Profes">
      ${a.profes.map((id) => `<button class="profe-btn" data-profe="${id}" aria-pressed="${flujo.profeId === id}">${esc(A.profe(id).nombre)}</button>`).join("")}</div>`;
    $$(".profe-btn").forEach((b) => b.addEventListener("click", () => { flujo.profeId = b.dataset.profe; $$(".profe-btn").forEach((x) => x.setAttribute("aria-pressed", x === b)); actualizarCTA(); }));
  }

  function actualizarCTA() {
    const b = $("#continuar"); if (!b) return;
    const a = A.actividad(flujo.actividadId);
    const listo = flujo.turnoId && (!a.eligeProfe || flujo.profeId);
    b.disabled = !listo;
    b.textContent = !yo.membresia.puedeReservar ? "Renová tu plan para reservar" : !flujo.turnoId ? "Elegí un horario" : a.eligeProfe && !flujo.profeId ? "Elegí un profe" : "Continuar";
    if (!yo.membresia.puedeReservar) b.disabled = true;
  }

  async function confirmarReserva() {
    const a = A.actividad(flujo.actividadId);
    const t = (await A.listarTurnos({ fecha: flujo.fecha, actividadId: a.id })).find((x) => x.id === flujo.turnoId);
    if (!t) { U.toast("Ese turno ya no está disponible.", "bad"); return pintarHorarios(); }
    const espera = t.disponibles <= 0;
    const pr = A.profe(a.eligeProfe ? flujo.profeId : t.profeId);
    U.sheet({
      titulo: flujo.reprogramar ? "Confirmá el cambio" : espera ? "Lista de espera" : "Confirmá tu turno",
      html: `<div class="card" style="margin-bottom:14px"><div class="next">${U.datebadge(t.fecha)}<div class="next__info"><strong>${esc(a.nombre)}</strong>
          <span class="muted">${esc(T.largo(t.fecha))}</span><br><span>${t.hora} a ${t.fin} hs</span>${pr ? `<br><span class="small muted">con ${esc(pr.nombre)}</span>` : ""}</div></div></div>
        ${espera ? `<div class="alert alert--warn"><p>El turno está completo. Te anotamos en la <b>lista de espera</b> (lugar ${t.espera + 1}) y si se libera un lugar pasás a confirmado automáticamente.</p></div>` : ""}
        ${flujo.reprogramar ? `<p class="small muted">Tu turno del ${esc(T.corto(flujo.reprogramar.fecha))} a las ${esc(flujo.reprogramar.hora)} hs se cancela y se libera el lugar.</p>` : ""}
        <p class="small muted">Podés cancelar o cambiar el turno hasta <b>${ajustes.cancelacionHoras} h antes</b>. Si no venís, avisá así otro socio aprovecha el lugar.</p>
        <p class="form-error" id="err-res" role="alert"></p>
        <button class="btn btn--primary btn--block btn--xl" id="ok-res">${flujo.reprogramar ? "Confirmar cambio" : espera ? "Anotarme en espera" : "Confirmar reserva"}</button>`,
      onOpen(d, cerrar) {
        $("#ok-res", d).addEventListener("click", async (e) => {
          const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Reservando…";
          try {
            const r = flujo.reprogramar
              ? await A.reprogramar({ reservaId: flujo.reprogramar.id, turnoId: t.id, profeId: flujo.profeId })
              : await A.reservar({ turnoId: t.id, profeId: flujo.profeId, espera });
            cerrar();
            Object.assign(flujo, { reprogramar: null, turnoId: null });
            exito(r);
          } catch (er) {
            $("#err-res", d).textContent = er.message;
            btn.disabled = false; btn.textContent = "Reintentar";
            if (er.code === "completo") pintarHorarios();
          }
        });
      },
    });
  }

  function exito(r) {
    if (navigator.vibrate) navigator.vibrate(40);
    const ov = document.createElement("div");
    ov.className = "success"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Turno reservado");
    const espera = r.estado === "espera";
    ov.innerHTML = `<div class="success__inner">
      <svg class="success__check" viewBox="0 0 110 110" aria-hidden="true"><circle cx="55" cy="55" r="50"/><path d="M33 57l15 15 30-32"/></svg>
      <h2>${espera ? "¡Estás en lista de espera!" : r.reprogramadaDe ? "¡Turno cambiado!" : "¡Turno reservado!"}</h2>
      <p class="muted">${esc(r.actividad)} · ${esc(T.largo(r.fecha))} · ${r.hora} hs${r.profe ? "<br>con " + esc(r.profe) : ""}</p>
      ${espera ? `<p class="small muted">Lugar ${r.posicionEspera} en la lista. Si se libera un lugar, lo vas a ver confirmado en “Mis turnos”.</p>` : ""}
      <div style="display:grid;gap:10px;margin-top:22px">
        <button class="btn btn--ghost" id="ics">${icon("cal")} Agregar al calendario</button>
        <a class="btn btn--ghost" id="avisame" href="${U.waGym(A.plantillaTexto(ajustesTexto("avisoReserva"), vars({ actividad: r.actividad, fecha: T.corto(r.fecha), hora: r.hora })))}" target="_blank" rel="noopener">${icon("wa")} Avisame por WhatsApp</a>
        <button class="btn btn--primary" id="ver">Ver mis turnos</button>
      </div></div>`;
    document.body.appendChild(ov);
    const cerrar = (hash) => { ov.remove(); if (hash) location.hash = hash; else router(); };
    $("#ics", ov).onclick = () => U.icsReserva(r);
    $("#avisame", ov).onclick = () => { A.marcarAviso(r.id, true).catch(() => {}); };
    $("#ver", ov).onclick = () => cerrar("#/turnos");
    ov.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar("#/turnos"); });
    $("#ver", ov).focus();
  }

  // ---------------------------------------------------------------
  // Mis turnos
  // ---------------------------------------------------------------
  let pestanaTurnos = "proximos";
  async function turnos() {
    document.title = "Mis turnos · GIM Adrogué";
    const data = await A.misReservas();
    const lista = pestanaTurnos === "proximos" ? data.proximas : data.historial;
    main().innerHTML = `<div class="view">
      <div class="view__title"><h1>Mis turnos</h1></div>
      <div class="seg" role="tablist">
        <button role="tab" aria-selected="${pestanaTurnos === "proximos"}" data-tab="proximos">Próximos (${data.proximas.length})</button>
        <button role="tab" aria-selected="${pestanaTurnos === "historial"}" data-tab="historial">Historial</button>
      </div>
      <div class="res" role="tabpanel">${lista.length ? lista.slice(0, 40).map(tarjetaReserva).join("") :
        `<div class="card empty">${icon("cal")}<p>${pestanaTurnos === "proximos" ? "No tenés turnos próximos." : "Todavía no hay historial."}</p>${pestanaTurnos === "proximos" ? '<a class="btn btn--primary btn--sm" href="#/reservar">Reservar turno</a>' : ""}</div>`}</div>
    </div>`;
    $$("[data-tab]").forEach((b) => b.addEventListener("click", () => { pestanaTurnos = b.dataset.tab; turnos(); }));
    $$("[data-cancelar]").forEach((b) => b.addEventListener("click", () => cancelarTurno(lista.find((r) => r.id === b.dataset.cancelar))));
    $$("[data-ics]").forEach((b) => b.addEventListener("click", () => U.icsReserva(lista.find((r) => r.id === b.dataset.ics))));
    $$("[data-qr]").forEach((b) => b.addEventListener("click", () => verQR(lista.find((r) => r.id === b.dataset.qr))));
    $$("[data-aviso]").forEach((b) => b.addEventListener("click", () => { A.marcarAviso(b.dataset.aviso, true).catch(() => {}); }));
  }
  function tarjetaReserva(r) {
    const futura = r.estado === "confirmada" || r.estado === "espera";
    const lim = ajustes.cancelacionHoras;
    return `<article class="card ${futura ? "" : "res--past"}">
      <div class="res__top">${U.datebadge(r.fecha)}<div class="next__info"><strong>${esc(r.actividad)}</strong>
        <span class="muted">${r.hora} a ${r.fin} hs${r.profe ? " · " + esc(r.profe) : ""}</span><div style="margin-top:6px">${U.chipReserva(r)}</div></div></div>
      ${futura ? `<div class="res__actions">
          ${r.estado === "confirmada" ? `<button class="btn btn--ghost btn--sm" data-qr="${r.id}">${icon("qr")} QR</button>
          <button class="btn btn--ghost btn--sm" data-ics="${r.id}">${icon("cal")} Agendar</button>
          <a class="btn btn--ghost btn--sm" data-aviso="${r.id}" href="${U.waGym(A.plantillaTexto(ajustesTexto("avisoReserva"), vars({ actividad: r.actividad, fecha: T.corto(r.fecha), hora: r.hora })))}" target="_blank" rel="noopener" aria-label="Avisame por WhatsApp">${icon("wa")} Avisame</a>
          <a class="btn btn--ghost btn--sm res__wide" ${r.puedeCancelar ? `href="#/reservar/repro-${r.id}"` : 'aria-disabled="true" tabindex="-1"'}>Reprogramar</a>` : ""}
          <button class="btn btn--danger btn--sm res__wide ${r.estado === "espera" ? "res__full" : ""}" data-cancelar="${r.id}" ${r.puedeCancelar ? "" : "disabled"}>${r.estado === "espera" ? "Salir de la espera" : "Cancelar"}</button>
        </div>
        ${r.estado === "confirmada" && !r.puedeCancelar ? `<p class="res__note">Faltan menos de ${lim} h: ya no se puede cancelar ni reprogramar desde la app. Si tenés un problema, <a href="${U.waGym("¡Hola! Soy " + yo.nombre + " " + yo.apellido + ". Tengo un turno de " + r.actividad + " hoy a las " + r.hora + " hs y no voy a poder ir.")}" target="_blank" rel="noopener">escribinos</a>.</p>`
          : r.estado === "confirmada" ? `<p class="res__note">Podés cancelar o reprogramar hasta ${lim} h antes.</p>` : ""}` : r.motivo ? `<p class="res__note">${esc(r.motivo)}</p>` : ""}
    </article>`;
  }
  async function cancelarTurno(r) {
    const ok = await U.confirmar({ titulo: r.estado === "espera" ? "¿Salir de la lista de espera?" : "¿Cancelar el turno?", texto: `${esc(r.actividad)} · ${esc(T.largo(r.fecha))} a las ${r.hora} hs. ${r.estado === "confirmada" ? "Tu lugar se libera para otro socio." : ""}`, si: "Sí, cancelar", no: "No, volver", peligro: true });
    if (!ok) return;
    try { await A.cancelar(r.id); U.toast("Turno cancelado. ¡Gracias por avisar!", "ok"); turnos(); } catch (e) { error(e); turnos(); }
  }
  function verQR(r) {
    U.sheet({ titulo: "QR del turno", html: `<div class="pass"><div class="pass__qr">${U.qrSVG("GIM:R:" + r.codigo)}</div>
      <p><b>${esc(r.actividad)}</b><br><span class="muted">${esc(T.largo(r.fecha))} · ${r.hora} hs</span></p><p class="small dim">Código ${esc(r.codigo)} · Mostralo en recepción</p></div>` });
  }

  // ---------------------------------------------------------------
  // Pase de acceso
  // ---------------------------------------------------------------
  async function pase() {
    document.title = "Pase · GIM Adrogué";
    const { proximas } = await A.misReservas();
    const hoy = proximas.filter((r) => r.fecha === T.hoy() && r.estado === "confirmada");
    const m = yo.membresia;
    main().innerHTML = `<div class="view">
      <div class="view__title"><h1>Tu pase</h1></div>
      <section class="card pass">
        <div class="pass__qr">${U.qrSVG("GIM:S:" + yo.id)}</div>
        <div class="pass__name">${esc(yo.nombre)} ${esc(yo.apellido)}</div>
        <p class="muted" style="margin:6px 0 10px">${esc(m.plan.nombre)} · DNI ${esc(yo.dni)}</p>
        ${U.chipMembresia(m)}
        <p class="small dim" style="margin:14px 0 0">Mostralo en recepción para registrar tu ingreso. Subí el brillo de la pantalla si no lo lee.</p>
      </section>
      <p class="section-label">Turnos de hoy</p>
      ${hoy.length ? hoy.map((r) => `<article class="card"><div class="next">${U.datebadge(r.fecha)}<div class="next__info"><strong>${esc(r.actividad)}</strong><span class="muted">${r.hora} a ${r.fin} hs</span></div></div>
        <details style="margin-top:10px"><summary class="link-btn" style="display:inline-flex;align-items:center;list-style:none">Ver QR de este turno</summary><div class="qr-mini">${U.qrSVG("GIM:R:" + r.codigo)}</div><p class="center small dim">Código ${esc(r.codigo)}</p></details></article>`).join("")
        : `<div class="card empty">${icon("qr")}<p>No tenés turnos para hoy. Con el pase igual registrás tu ingreso.</p></div>`}
    </div>`;
  }

  // ---------------------------------------------------------------
  // Membresía y pagos
  // ---------------------------------------------------------------
  async function membresia() {
    document.title = "Membresía · GIM Adrogué";
    const pagos = await A.misPagos();
    const m = yo.membresia;
    main().innerHTML = `<div class="view">
      <div class="view__title"><a class="icon-btn" href="#/perfil" aria-label="Volver al perfil">${icon("back")}</a><h1>Membresía</h1></div>
      ${tarjetaMembresia(m, false)}
      ${m.estado === "al-dia" ? `<a class="btn btn--ghost btn--block" style="margin-top:12px" href="${U.waGym(A.plantillaTexto(ajustesTexto("renovar"), vars()))}" target="_blank" rel="noopener">${icon("wa")} Renovar por WhatsApp</a>` : ""}
      <p class="small dim" style="margin-top:8px">Pronto vas a poder pagar con Mercado Pago desde la app.</p>
      <p class="section-label">Planes</p>
      ${A.planes().map((p) => `<div class="card plan-opt ${p.id === m.plan.id ? "is-current" : ""}"><div><strong>${esc(p.nombre)}</strong><div class="small muted">${esc(p.detalle)}</div>
        ${p.id === m.plan.id ? '<span class="chip chip--info" style="margin-top:6px">Tu plan</span>' : `<a class="link-btn" style="padding:0" href="${U.waGym(A.plantillaTexto(ajustesTexto("cambiarPlan"), vars({ plan: p.nombre, precio: A.precio(p.precio) })))}" target="_blank" rel="noopener">Quiero este plan</a>`}</div>
        <b>${A.precio(p.precio)}</b></div>`).join("")}
      <p class="section-label">Historial de pagos</p>
      ${pagos.length ? `<div class="card">${pagos.map((p) => `<div class="kv"><dt>${esc(T.ddmmaa(p.fecha))}<br><span class="small dim">${esc((A.plan(p.planId) || {}).nombre || "")} · ${esc(p.medio)}</span></dt><dd>${A.precio(p.monto)}</dd></div>`).join("")}</div>`
        : `<div class="card empty">${icon("card")}<p>Todavía no hay pagos registrados.</p></div>`}
    </div>`;
  }

  // ---------------------------------------------------------------
  // Perfil
  // ---------------------------------------------------------------
  async function perfil() {
    document.title = "Perfil · GIM Adrogué";
    const OBJ = ["Ganar fuerza", "Ganar masa muscular", "Bajar de peso", "Salud y bienestar", "Rendimiento deportivo", "Readaptación de una lesión"];
    main().innerHTML = `<div class="view">
      <div class="view__title"><h1>Perfil</h1></div>
      <section class="card"><div style="display:flex;gap:14px;align-items:center;margin-bottom:6px">
        <div class="datebadge" style="width:56px;padding:12px 0"><b>${esc(yo.nombre[0])}${esc(yo.apellido[0])}</b></div>
        <div><strong style="font-size:1.1rem">${esc(yo.nombre)} ${esc(yo.apellido)}</strong><div class="small muted">DNI ${esc(yo.dni)} · Socio desde ${esc(T.fmt(yo.alta, { month: "long", year: "numeric" }))}</div></div></div></section>
      <a class="card" href="#/membresia" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;margin-top:12px">
        <span style="display:flex;gap:12px;align-items:center">${icon("card")}<span><strong>Membresía y pagos</strong><span class="small muted" style="display:block">${esc(yo.membresia.plan.nombre)}</span></span></span>${U.chipMembresia(yo.membresia)}</a>
      <p class="section-label">Tus datos</p>
      <form class="card" id="f-perfil">
        <div class="field"><label for="p-wa">WhatsApp</label><input class="input" id="p-wa" name="whatsapp" inputmode="tel" value="${esc(yo.whatsapp)}"></div>
        <div class="field"><label for="p-mail">Email</label><input class="input" id="p-mail" name="email" type="email" value="${esc(yo.email || "")}" placeholder="tu@mail.com"></div>
        <div class="field"><label for="p-obj">Objetivo</label><select class="input" id="p-obj" name="objetivo">${OBJ.map((o) => `<option ${o === yo.objetivo ? "selected" : ""}>${o}</option>`).join("")}</select></div>
        <button class="btn btn--primary btn--block" type="submit">Guardar cambios</button>
      </form>
      <p class="section-label">Notificaciones</p>
      <div class="card" style="padding-top:6px;padding-bottom:6px">
        <label class="switch"><span><strong>Recordatorio de turnos por WhatsApp</strong><span class="small muted" style="display:block">Te escribimos antes de cada turno</span></span><input type="checkbox" data-notif="notifWhatsapp" ${yo.notifWhatsapp ? "checked" : ""}></label>
        <label class="switch" style="border:0"><span><strong>Aviso de vencimiento del plan</strong><span class="small muted" style="display:block">Unos días antes de que venza</span></span><input type="checkbox" data-notif="notifVencimiento" ${yo.notifVencimiento ? "checked" : ""}></label>
      </div>
      <p class="section-label">Seguridad</p>
      <form class="card" id="f-pin">
        <div class="field"><label for="pin-a">PIN actual</label><input class="input input--pin" id="pin-a" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password"></div>
        <div class="field"><label for="pin-n">PIN nuevo</label><input class="input input--pin" id="pin-n" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></div>
        <button class="btn btn--ghost btn--block" type="submit">Cambiar PIN</button>
      </form>
      <div style="display:grid;gap:10px;margin-top:16px">
        ${U.standalone() ? "" : `<button class="btn btn--ghost" id="p-instalar">${icon("install")} Instalar la app en el celular</button>`}
        <a class="btn btn--ghost" href="${U.waGym("¡Hola! Soy " + yo.nombre + " " + yo.apellido + ". Tengo una consulta.")}" target="_blank" rel="noopener">${icon("wa")} Escribir al gimnasio</a>
        <button class="btn btn--danger" id="salir">${icon("logout")} Cerrar sesión</button>
      </div>
      <p class="footer-note"><a href="../">Ir a la web de GIM</a> · Web hecha por <a href="https://vigolowebstudio.com" target="_blank" rel="noopener">Vigolo Web Studio</a></p>
    </div>`;
    $("#f-perfil").addEventListener("submit", async (e) => {
      e.preventDefault(); const f = e.target;
      try { yo = await A.actualizarPerfil({ whatsapp: f.whatsapp.value.replace(/\D/g, ""), email: f.email.value.trim(), objetivo: f.objetivo.value }); U.toast("Datos guardados", "ok"); } catch (er) { error(er); }
    });
    $$("[data-notif]").forEach((c) => c.addEventListener("change", async () => {
      try { yo = await A.actualizarPerfil({ [c.dataset.notif]: c.checked }); U.toast(c.checked ? "Aviso activado" : "Aviso desactivado"); } catch (er) { error(er); }
    }));
    $("#f-pin").addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await A.actualizarPerfil({ pinActual: $("#pin-a").value, pinNuevo: $("#pin-n").value }); U.toast("PIN actualizado", "ok"); e.target.reset(); } catch (er) { U.toast(er.message, "bad"); }
    });
    $("#p-instalar") && $("#p-instalar").addEventListener("click", U.instalar);
    $("#salir").addEventListener("click", async () => { if (await U.confirmar({ titulo: "¿Cerrar sesión?", texto: "Vas a tener que ingresar de nuevo con tu DNI y PIN.", si: "Cerrar sesión" })) salir(); });
  }

  // ---------------------------------------------------------------
  U.pwa({ swUrl: "./sw.js", scope: "./", onCambio: actualizarInstalar });
  router();
})();
