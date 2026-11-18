/* GIM Adrogué · Panel del gimnasio (/app/admin/) */
(function () {
  "use strict";
  const A = window.GIMAPI, U = window.UI, T = A.T, C = CONFIG, R = C.reservas;
  const { $, $$, esc, icon } = U;
  const root = $("#app");
  let ajustes = null;

  // Color de identidad por actividad (paleta categórica validada para fondo oscuro; siempre acompañada del nombre)
  const COLORES = ["#3a9ad9", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"];
  const colorAct = (id) => COLORES[Math.max(0, A.actividades().findIndex((a) => a.id === id)) % COLORES.length];
  const DIAS_C = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const ini = (n, a) => `${(n || " ")[0]}${(a || " ")[0]}`.toUpperCase();
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const pct = (x) => Math.round(x * 100) + "%";
  const msj = (k, vars) => A.plantillaTexto(ajustes.textos[k], vars);
  const varsSocio = (s, extra = {}) => Object.assign({ nombre: s.nombre, plan: s.membresia.plan.nombre, precio: A.precio(s.membresia.plan.precio), vence: T.ddmmaa(s.vence) }, extra);
  function error(e) { console.error(e); U.toast(e.message || "Algo salió mal.", "bad"); if (e.code === "sesion") login(); }

  // ---------------------------------------------------------------
  // Esqueleto
  // ---------------------------------------------------------------
  const SECC = [["agenda", "Agenda del día", "cal"], ["turnos", "Turnos y cupos", "grid"], ["socios", "Socios", "users"], ["pagos", "Membresías y pagos", "money"], ["reportes", "Reportes", "chart"], ["config", "Configuración", "gear"]];
  function shell() {
    root.innerHTML = `<div class="admin">
      <header class="a-top">
        <div class="a-top__bar"><a class="logo" href="#/agenda" aria-label="Panel GIM">${U.ICON.tri}<b>GIM</b><span>Panel del<br>gimnasio</span></a>
          <button class="icon-btn" id="salir" aria-label="Cerrar sesión" title="Cerrar sesión">${icon("logout")}</button></div>
        <nav class="a-tabs" aria-label="Secciones del panel">${SECC.map(([id, t, ic]) => `<a href="#/${id}" data-sec="${id}">${icon(ic)}<span>${t}</span></a>`).join("")}</nav>
        <div class="a-side-foot small dim"><a href="../">Ver app de socios</a> · <a href="../../">Web</a><br>Hecho por <a href="https://vigolowebstudio.com" target="_blank" rel="noopener">Vigolo Web Studio</a></div>
      </header>
      <main class="a-main" id="main" tabindex="-1"></main></div>`;
    $("#salir").addEventListener("click", async () => { await A.logoutAdmin(); login(); });
  }
  const main = () => $("#main");

  const VISTAS = { agenda, turnos, socios, pagos, reportes, config };
  let rutaActual = "";
  async function router() {
    if (!(await A.sesionAdmin())) return login();
    if (!$("#main")) shell();
    const [ruta, param] = location.hash.replace(/^#\/?/, "").split("/");
    const v = VISTAS[ruta] ? ruta : "agenda";
    rutaActual = v;
    $$("[data-sec]").forEach((a) => (a.dataset.sec === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    const act = $(`[data-sec="${v}"]`); act && act.scrollIntoView({ inline: "center", block: "nearest" });
    document.title = `${SECC.find((s) => s[0] === v)[1]} · Panel GIM`;
    main().innerHTML = '<div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:300px"></div>';
    try { ajustes = await A.config(); await VISTAS[v](param); } catch (e) { error(e); }
  }
  window.addEventListener("hashchange", router);
  let refresco = null;
  A.suscribir(() => { // si un socio reserva desde la app, la agenda se actualiza sola
    if (rutaActual !== "agenda" || document.querySelector("dialog[open]")) return;
    clearTimeout(refresco); refresco = setTimeout(() => agenda(agendaFecha, true), 250);
  });

  // ---------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------
  function login() {
    document.title = "Panel GIM · Ingresar";
    const demo = R.backend === "local";
    root.innerHTML = `<main class="login" id="main"><div class="login__box">
      <div class="login__brand">${U.ICON.tri}<b>GIM</b><span>Panel del gimnasio</span></div>
      <form class="card" id="f-admin">
        <h1 style="font-size:1.6rem">Ingresá al panel</h1>
        ${demo ? "" : '<div class="field"><label for="email">Email</label><input class="input" id="email" type="email" autocomplete="username" required></div>'}
        <div class="field"><label for="clave">${demo ? "Clave del gimnasio" : "Contraseña"}</label><input class="input" id="clave" type="password" autocomplete="current-password" required></div>
        <p class="form-error" id="err" role="alert"></p>
        <button class="btn btn--primary btn--block">Entrar</button>
      </form>
      ${demo ? `<div class="demo-box"><p><b>Demo:</b> la clave es <b>${esc(R.admin.claveDemo)}</b>. En producción se ingresa con usuario y contraseña (Supabase).</p></div>` : ""}
      <p class="footer-note"><a href="../">← App de socios</a></p></div></main>`;
    $("#f-admin").addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await A.loginAdmin($("#clave").value, $("#email") ? $("#email").value : undefined); root.innerHTML = ""; if (!location.hash) location.hash = "#/agenda"; router(); }
      catch (er) { $("#err").textContent = er.message; }
    });
    ($("#email") || $("#clave")).focus();
  }

  // ---------------------------------------------------------------
  // 1. Agenda del día
  // ---------------------------------------------------------------
  let agendaFecha = T.hoy(), agendaFiltro = "", abiertos = new Set();
  async function agenda(fecha, silencioso) {
    if (fecha) agendaFecha = fecha;
    const [turnos, recs] = await Promise.all([A.agenda(agendaFecha), agendaFecha === T.hoy() ? A.recordatoriosPendientes() : Promise.resolve([])]);
    const vis = turnos.filter((t) => !agendaFiltro || t.actividadId === agendaFiltro);
    const now = T.ahora();
    const tot = turnos.reduce((o, t) => ({ cupo: o.cupo + t.cupo, ocu: o.ocu + t.ocupados, asis: o.asis + t.reservas.filter((r) => r.estado === "asistio").length, esp: o.esp + t.espera }), { cupo: 0, ocu: 0, asis: 0, esp: 0 });
    const esHoy = agendaFecha === now.fecha;
    const scrollY = window.scrollY;
    main().innerHTML = `
      <div class="a-head"><h1>Agenda</h1>
        <div class="btn-row"><button class="btn btn--primary" id="scan">${icon("camera")} Escanear QR</button></div></div>
      <div class="a-head" style="margin-bottom:12px">
        <div class="datenav"><button class="icon-btn" id="prev" aria-label="Día anterior">${icon("back")}</button>
          <input type="date" id="fecha" value="${agendaFecha}" aria-label="Fecha">
          <button class="icon-btn" id="next" aria-label="Día siguiente" style="transform:scaleX(-1)">${icon("back")}</button>
          ${esHoy ? "" : '<button class="btn btn--ghost btn--sm" id="hoy">Hoy</button>'}</div>
        <strong>${esc(cap(T.largo(agendaFecha)))}</strong></div>
      <div class="kpis">
        <div class="kpi"><span>Reservas</span><b>${tot.ocu}</b><small>de ${tot.cupo} lugares</small></div>
        <div class="kpi"><span>Ocupación</span><b>${tot.cupo ? pct(tot.ocu / tot.cupo) : "—"}</b><small>${turnos.length} turnos</small></div>
        <div class="kpi"><span>Asistieron</span><b>${tot.asis}</b><small>${esHoy ? "hasta ahora" : ""}</small></div>
        <div class="kpi"><span>En espera</span><b>${tot.esp}</b><small>lista de espera</small></div>
      </div>
      ${recs.length ? `<details class="card" style="margin-bottom:14px"><summary style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;min-height:44px"><strong>${icon("bell")} Recordatorios por WhatsApp pendientes (${recs.length})</strong><span class="chip chip--info">Fase 2: automático</span></summary>
        <p class="small muted" style="margin-top:8px">Socios que pidieron aviso para hoy o mañana. Tocá para mandar el mensaje.</p>
        <div class="rows">${recs.slice(0, 30).map((r) => `<div class="row row--wrap" style="cursor:default"><div class="row__main"><strong>${esc(r.socio)}</strong><span class="small muted">${esc(r.actividad)} · ${r.fecha === T.hoy() ? "hoy" : "mañana"} ${r.hora} hs</span></div>
          <a class="btn btn--ghost btn--sm" data-rec="${r.id}" href="${U.wa(r.socioWhatsapp, msj("recordatorio", { nombre: r.socio.split(" ")[0], actividad: r.actividad, hora: r.hora, fecha: T.corto(r.fecha) }).replace(" hoy ", r.fecha === T.hoy() ? " hoy " : " mañana "))}" target="_blank" rel="noopener">${icon("wa")} Enviar</a></div>`).join("")}</div></details>` : ""}
      <div class="filters" role="group" aria-label="Filtrar por actividad">
        <button class="fchip" data-f="" aria-pressed="${!agendaFiltro}">Todas</button>
        ${A.actividades().map((a) => `<button class="fchip" data-f="${a.id}" aria-pressed="${agendaFiltro === a.id}"><span class="dot" style="background:${colorAct(a.id)}"></span>${esc(a.nombre)}</button>`).join("")}
      </div>
      ${vis.length ? `<div class="agenda-grid">${vis.map((t) => tarjetaTurno(t, now)).join("")}</div>` : `<div class="card empty">${icon("cal")}<p>${turnos.length ? "No hay turnos de esa actividad." : "No hay turnos este día (cerrado o bloqueado)."}</p></div>`}`;
    if (silencioso) window.scrollTo(0, scrollY);
    $("#fecha").addEventListener("change", (e) => e.target.value && agenda(e.target.value));
    $("#prev").addEventListener("click", () => agenda(T.sumarDias(agendaFecha, -1)));
    $("#next").addEventListener("click", () => agenda(T.sumarDias(agendaFecha, 1)));
    $("#hoy") && $("#hoy").addEventListener("click", () => agenda(T.hoy()));
    $("#scan").addEventListener("click", escaner);
    $$("[data-f]").forEach((b) => b.addEventListener("click", () => { agendaFiltro = b.dataset.f; agenda(); }));
    $$("details.turno").forEach((d) => d.addEventListener("toggle", () => (d.open ? abiertos.add(d.dataset.id) : abiertos.delete(d.dataset.id))));
    $$("[data-asis]").forEach((b) => b.addEventListener("click", async () => {
      const [id, est] = b.dataset.asis.split("|");
      try { await A.marcarAsistencia(id, b.getAttribute("aria-pressed") === "true" ? "confirmada" : est); agenda(null, true); } catch (e) { error(e); }
    }));
    $$("[data-baja]").forEach((b) => b.addEventListener("click", async () => {
      if (!(await U.confirmar({ titulo: "¿Cancelar este turno?", texto: "Se libera el lugar y, si hay lista de espera, pasa el siguiente.", si: "Cancelar turno", peligro: true }))) return;
      try { const r = await A.cancelarComoAdmin(b.dataset.baja); U.toast(r.promovido ? `Cancelado. ${r.promovido.socio} pasó de la lista de espera.` : "Turno cancelado", "ok"); agenda(null, true); } catch (e) { error(e); }
    }));
    $$("[data-rec]").forEach((a) => a.addEventListener("click", () => setTimeout(() => A.marcarAvisoEnviado(a.dataset.rec).then(() => agenda(null, true)), 400)));
  }
  function tarjetaTurno(t, now) {
    const a = A.actividad(t.actividadId), pr = t.profeId && A.profe(t.profeId);
    const enCurso = t.fecha === now.fecha && now.min >= T.aMin(t.hora) && now.min < T.aMin(t.fin);
    const fin = T.ms(t.fecha, t.fin) < Date.now();
    const conf = t.reservas.filter((r) => r.estado !== "espera"), esp = t.reservas.filter((r) => r.estado === "espera");
    const occ = t.ocupados / t.cupo;
    return `<details class="turno ${enCurso ? "is-now" : fin ? "is-past" : ""}" data-id="${t.id}" ${abiertos.has(t.id) || enCurso ? "open" : ""}>
      <summary><span class="turno__time">${t.hora}<small>a ${t.fin}</small></span>
        <span><strong><span class="dot" style="background:${colorAct(a.id)}"></span>${esc(a.nombre)}</strong><span class="small muted" style="display:block">${pr ? esc(pr.nombre) : a.eligeProfe ? "Profe a elección" : ""}${enCurso ? ' · <b style="color:var(--celeste)">En curso</b>' : ""}</span></span>
        <span class="turno__occ">${t.ocupados}/${t.cupo}<small>${t.ocupados >= t.cupo ? "Completo" : (t.cupo - t.ocupados) + " libres"}${t.espera ? " · " + t.espera + " esp." : ""}</small></span>
        <span class="bar ${occ >= 1 ? "bar--warn" : ""}"><span style="width:${Math.min(100, occ * 100)}%"></span></span></summary>
      <div class="turno__body">
        ${conf.length ? conf.map((r) => filaAsistente(r)).join("") : '<p class="small muted" style="padding:10px 0;margin:0">Nadie anotado todavía.</p>'}
        ${esp.length ? `<p class="small" style="margin:10px 0 0;color:var(--warn);font-weight:600">Lista de espera</p>${esp.map((r) => filaAsistente(r, true)).join("")}` : ""}
      </div></details>`;
  }
  function filaAsistente(r, espera) {
    return `<div class="att"><div class="att__who"><strong>${esc(r.socio)}</strong><span class="small muted">${espera ? "#" + r.posicionEspera + " en espera" : r.profe && A.actividad(r.actividadId).eligeProfe ? "con " + esc(r.profe.replace("Lic. ", "")) : "Cód. " + r.codigo}</span></div>
      <div class="att__btns">
        ${espera ? "" : `<button class="ok" data-asis="${r.id}|asistio" aria-pressed="${r.estado === "asistio"}" aria-label="Marcar que ${esc(r.socio)} asistió" title="Asistió">${icon("check")}</button>
        <button class="no" data-asis="${r.id}|ausente" aria-pressed="${r.estado === "ausente"}" aria-label="Marcar que ${esc(r.socio)} no vino" title="No vino">${icon("x")}</button>`}
        <a href="${U.wa(r.socioWhatsapp, "¡Hola " + r.socio.split(" ")[0] + "! Te escribimos de GIM Adrogué por tu turno de " + r.actividad + " de las " + r.hora + " hs.")}" target="_blank" rel="noopener" aria-label="WhatsApp a ${esc(r.socio)}" title="WhatsApp">${icon("wa")}</a>
        ${r.estado === "confirmada" || espera ? `<button data-baja="${r.id}" aria-label="Cancelar turno de ${esc(r.socio)}" title="Cancelar turno">${icon("trash")}</button>` : ""}
      </div></div>`;
  }

  // Escáner de QR: BarcodeDetector nativo; si no existe (iOS), jsQR local cargado a demanda.
  function escaner() {
    let stream = null, activo = true, pausa = false, detector = null;
    const s = U.sheet({
      titulo: "Escanear QR", html: `
        <div class="scanner" id="sc-box"><video id="sc-video" playsinline muted></video></div>
        <div class="scan-result" id="sc-res" role="status" aria-live="assertive"></div>
        <p class="small muted center" id="sc-msg">Apuntá la cámara al QR del pase o del turno del socio.</p>
        <form id="sc-form" style="display:flex;gap:8px;margin-top:6px"><input class="input" id="sc-cod" placeholder="O escribí el código (ej. K7P2QX)" autocomplete="off" style="text-transform:uppercase"><button class="btn btn--primary">OK</button></form>`,
      async onOpen(d) {
        d.addEventListener("close", () => { activo = false; stream && stream.getTracks().forEach((t) => t.stop()); agenda(null, true); });
        $("#sc-form", d).addEventListener("submit", (e) => { e.preventDefault(); procesar($("#sc-cod", d).value); $("#sc-cod", d).value = ""; });
        const video = $("#sc-video", d);
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("sin cámara");
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          video.srcObject = stream; await video.play();
        } catch (e) {
          $("#sc-box", d).style.display = "none";
          $("#sc-msg", d).textContent = "No pudimos abrir la cámara (permiso denegado o sin cámara). Ingresá el código a mano.";
          return;
        }
        if ("BarcodeDetector" in window) { try { detector = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { detector = null; } }
        if (!detector && !window.jsQR) await cargarScript("../vendor/jsqr.min.js").catch(() => {});
        const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
        const loop = async () => {
          if (!activo) return;
          if (!pausa && video.readyState >= 2) {
            try {
              let txt = null;
              if (detector) { const r = await detector.detect(video); txt = r[0] && r[0].rawValue; }
              else if (window.jsQR) {
                canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0);
                const r = window.jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
                txt = r && r.data;
              }
              if (txt) await procesar(txt);
            } catch (e) { /* frame ilegible */ }
          }
          setTimeout(() => requestAnimationFrame(loop), 180);
        };
        loop();
      },
    });
    async function procesar(txt) {
      if (!txt || pausa) return;
      pausa = true;
      const box = $("#sc-res", s.el);
      try {
        const r = await A.checkin(txt);
        const m = r.membresia;
        box.className = "scan-result ok";
        box.innerHTML = `<strong style="font-size:1.1rem">✓ ${esc(r.socio.nombreCompleto)}</strong><br>${r.reserva ? `${esc(r.reserva.actividad)} ${r.reserva.hora} hs · asistencia registrada` : "Ingreso registrado (sin turno hoy)"}<br>${U.chipMembresia(m)} ${m.estado === "vencida" ? '<b style="color:var(--bad)">Plan vencido: cobrar renovación</b>' : ""}`;
        if (navigator.vibrate) navigator.vibrate(60);
      } catch (e) { box.className = "scan-result bad"; box.textContent = "✗ " + e.message; }
      setTimeout(() => { pausa = false; }, 2200);
    }
  }
  function cargarScript(src) { return new Promise((ok, mal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = mal; document.head.appendChild(s); }); }

  // ---------------------------------------------------------------
  // 2. Turnos y cupos
  // ---------------------------------------------------------------
  let semana = T.lunes(T.hoy());
  async function turnos() {
    const [{ franjas, personalizada }, bloqueos] = await Promise.all([A.franjasSemana(semana), A.bloqueos()]);
    const fechas = [1, 2, 3, 4, 5, 6].map((d) => T.sumarDias(semana, d - 1));
    const bloq = new Map(bloqueos.map((b) => [b.fecha, b.motivo]));
    const cupoAct = (id) => { const f = franjas.find((x) => x.actividadId === id); return f ? f.cupo : A.actividad(id).cupo; };
    main().innerHTML = `
      <div class="a-head"><h1>Turnos y cupos</h1><div class="btn-row"><button class="btn btn--primary" id="nueva">${icon("plus")} Nueva franja</button></div></div>
      <div class="a-head card" style="padding:12px 14px">
        <div class="datenav"><button class="icon-btn" id="sprev" aria-label="Semana anterior">${icon("back")}</button>
          <strong>Semana del ${esc(T.fmt(semana, { day: "numeric", month: "long" }))}</strong>
          <button class="icon-btn" id="snext" aria-label="Semana siguiente" style="transform:scaleX(-1)">${icon("back")}</button></div>
        <span class="chip ${personalizada ? "chip--warn" : "chip--info"}">${personalizada ? "Semana personalizada" : "Usando la plantilla semanal"}</span>
        <div class="btn-row">${personalizada ? '<button class="btn btn--ghost btn--sm" id="plantilla">Volver a la plantilla</button>' : ""}<button class="btn btn--ghost btn--sm" id="dup">${icon("copy")} Duplicar a la semana siguiente</button></div>
      </div>
      <p class="small muted">Tocá una franja para editarla. Los cambios ${personalizada ? "solo afectan a <b>esta semana</b>." : "se aplican a la <b>plantilla</b> (todas las semanas que no estén personalizadas)."}</p>
      <div class="week">${fechas.map((f) => {
        const dia = T.diaSemana(f), b = bloq.get(f);
        const fs = franjas.filter((x) => x.dia === dia).sort((x, y) => x.hora.localeCompare(y.hora) || x.actividadId.localeCompare(y.actividadId));
        return `<section class="week__day ${b ? "is-blocked" : ""}"><h3><span>${DIAS_C[dia]} ${Number(f.slice(8))}</span><span class="small dim" style="font-family:var(--body);font-style:normal;text-transform:none;font-weight:400">${fs.length} franjas</span></h3>
          ${b ? `<p class="chip chip--bad" style="margin-bottom:6px">Bloqueado: ${esc(b)}</p>` : ""}
          ${fs.map((x) => { const a = A.actividad(x.actividadId); return `<button class="fr" data-fr="${x.id}"><span><b>${x.hora}</b> <span class="dot" style="background:${colorAct(a.id)}"></span>${esc(a.corto || a.nombre)}<small>${x.profeId ? esc(A.profe(x.profeId).nombre.replace("Lic. ", "")) : "A elección"}</small></span><span class="chip chip--plain">${x.cupo}</span></button>`; }).join("") || '<p class="small dim">Sin franjas</p>'}
        </section>`;
      }).join("")}</div>
      <div class="cols" style="margin-top:18px">
        <section class="card"><h2>Cupo por actividad</h2><p class="small muted">Cambia el cupo de todas las franjas de esa actividad.</p>
          ${A.actividades().map((a) => `<form class="kv" data-cupo="${a.id}" style="align-items:center"><dt><span class="dot" style="background:${colorAct(a.id)}"></span>${esc(a.nombre)}</dt>
            <dd style="display:flex;gap:6px"><input class="input" type="number" min="1" max="60" value="${cupoAct(a.id)}" aria-label="Cupo de ${esc(a.nombre)}" style="width:84px;min-height:44px"><button class="btn btn--ghost btn--sm">Aplicar</button></dd></form>`).join("")}
        </section>
        <section class="card"><h2>Días bloqueados</h2><p class="small muted">Feriados o cierres. Se cancelan los turnos de ese día.</p>
          <form id="f-bloq" class="form-grid"><div class="field"><label for="b-f">Fecha</label><input class="input" type="date" id="b-f" min="${T.hoy()}" required></div>
            <div class="field"><label for="b-m">Motivo</label><input class="input" id="b-m" placeholder="Ej: Feriado nacional"></div>
            <button class="btn btn--primary" style="grid-column:1/-1">Bloquear día</button></form>
          <div class="rows" style="margin-top:12px">${bloqueos.filter((b) => b.fecha >= T.sumarDias(T.hoy(), -30)).map((b) => `<div class="row row--wrap" style="cursor:default"><div class="row__main"><strong>${esc(cap(T.largo(b.fecha)))}</strong><span class="small muted">${esc(b.motivo)}</span></div><button class="btn btn--ghost btn--sm" data-desbloq="${b.fecha}">Desbloquear</button></div>`).join("") || '<p class="small dim">No hay días bloqueados.</p>'}</div>
        </section>
      </div>`;
    const sem = personalizada ? { semana } : {};
    $("#sprev").onclick = () => { semana = T.sumarDias(semana, -7); turnos(); };
    $("#snext").onclick = () => { semana = T.sumarDias(semana, 7); turnos(); };
    $("#nueva").onclick = () => editarFranja(null, franjas, sem);
    $$("[data-fr]").forEach((b) => b.addEventListener("click", () => editarFranja(franjas.find((x) => x.id === b.dataset.fr), franjas, sem)));
    $("#dup").onclick = async () => {
      if (!(await U.confirmar({ titulo: "Duplicar semana", texto: `Las franjas de esta semana se copian a la semana del ${esc(T.fmt(T.sumarDias(semana, 7), { day: "numeric", month: "long" }))}, que queda personalizada.`, si: "Duplicar" }))) return;
      try { const sig = await A.duplicarSemana(semana); semana = sig; U.toast("Semana duplicada", "ok"); turnos(); } catch (e) { error(e); }
    };
    $("#plantilla") && ($("#plantilla").onclick = async () => { await A.volverAPlantilla(semana); U.toast("La semana usa la plantilla otra vez"); turnos(); });
    $$("[data-cupo]").forEach((f) => f.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { const n = await A.cupoActividad(f.dataset.cupo, $("input", f).value); U.toast(`Cupo actualizado a ${n}`, "ok"); turnos(); } catch (er) { error(er); }
    }));
    $("#f-bloq").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = $("#b-f").value, m = $("#b-m").value.trim() || "Cerrado";
      const n = await A.reservasDelDia(f);
      if (!(await U.confirmar({ titulo: "¿Bloquear el día?", texto: `${esc(T.largo(f))}${n ? `. <b>Se cancelan ${n} turnos reservados</b>; avisales por WhatsApp desde Socios.` : "."}`, si: "Bloquear", peligro: !!n }))) return;
      try { await A.bloquearDia(f, m); U.toast("Día bloqueado", "ok"); turnos(); } catch (er) { error(er); }
    });
    $$("[data-desbloq]").forEach((b) => b.addEventListener("click", async () => { await A.desbloquearDia(b.dataset.desbloq); U.toast("Día desbloqueado"); turnos(); }));
  }
  function editarFranja(fr, franjas, sem) {
    const f = fr || { actividadId: A.actividades()[0].id, dia: 1, hora: "18:00", cupo: A.actividades()[0].cupo, profeId: null };
    const s = U.sheet({
      titulo: fr ? "Editar franja" : "Nueva franja", html: `<form id="f-fr">
        <div class="form-grid">
          <div class="field"><label for="fr-a">Actividad</label><select class="input" id="fr-a">${A.actividades().map((a) => `<option value="${a.id}" ${a.id === f.actividadId ? "selected" : ""}>${esc(a.nombre)}</option>`).join("")}</select></div>
          <div class="field"><label for="fr-d">Día</label><select class="input" id="fr-d">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}" ${d === f.dia ? "selected" : ""}>${A.DIAS[d]}</option>`).join("")}</select></div>
          <div class="field"><label for="fr-h">Hora de inicio</label><input class="input" type="time" id="fr-h" value="${f.hora}" step="900" required></div>
          <div class="field"><label for="fr-c">Cupo</label><input class="input" type="number" id="fr-c" min="1" max="60" value="${f.cupo}" required></div>
          <div class="field" style="grid-column:1/-1"><label for="fr-p">Profe</label><select class="input" id="fr-p"></select></div>
        </div>
        <p class="hint">${sem.semana ? "Este cambio aplica solo a esta semana." : "Este cambio aplica a la plantilla semanal."} Tiene que quedar dentro del horario del gimnasio.</p>
        <p class="form-error" id="fr-err" role="alert"></p>
        <div class="btn-row">${fr ? '<button type="button" class="btn btn--danger" id="fr-del">Eliminar</button>' : ""}<button class="btn btn--primary">Guardar</button></div></form>`,
      onOpen(d, cerrar) {
        const profeSel = () => {
          const a = A.actividad($("#fr-a", d).value);
          $("#fr-p", d).innerHTML = a.eligeProfe ? '<option value="">El socio elige el profe</option>' : a.profes.map((id) => `<option value="${id}" ${id === f.profeId ? "selected" : ""}>${esc(A.profe(id).nombre)}</option>`).join("");
          $("#fr-p", d).disabled = a.eligeProfe;
          if (!fr) $("#fr-c", d).value = a.cupo;
        };
        profeSel(); $("#fr-a", d).addEventListener("change", profeSel);
        $("#f-fr", d).addEventListener("submit", async (e) => {
          e.preventDefault();
          try {
            await A.guardarFranja({ id: fr && fr.id, actividadId: $("#fr-a", d).value, dia: Number($("#fr-d", d).value), hora: $("#fr-h", d).value, cupo: $("#fr-c", d).value, profeId: $("#fr-p", d).value, duracion: A.actividad($("#fr-a", d).value).duracion }, sem);
            cerrar(); U.toast("Franja guardada", "ok"); turnos();
          } catch (er) { $("#fr-err", d).textContent = er.message; }
        });
        $("#fr-del", d) && $("#fr-del", d).addEventListener("click", async () => { await A.borrarFranja(fr.id, sem); cerrar(); U.toast("Franja eliminada"); turnos(); });
      },
    });
    return s;
  }

  // ---------------------------------------------------------------
  // 3. Socios
  // ---------------------------------------------------------------
  let filtroSocios = { q: "", estado: "todos" };
  async function socios(param) {
    const todos = await A.listarSocios({});
    const cuenta = (e) => todos.filter((s) => e === "todos" || s.membresia.estado === e).length;
    main().innerHTML = `
      <div class="a-head"><h1>Socios</h1><div class="btn-row"><button class="btn btn--primary" id="nuevo">${icon("plus")} Nuevo socio</button></div></div>
      <div class="a-head" style="margin-bottom:10px"><label class="searchbox">${icon("search")}<span class="sr-only">Buscar socio</span><input class="input" id="q" type="search" placeholder="Buscar por nombre, DNI o WhatsApp" value="${esc(filtroSocios.q)}"></label></div>
      <div class="filters" role="group" aria-label="Filtrar por estado">${[["todos", "Todos"], ["al-dia", "Al día"], ["vence-pronto", "Vence pronto"], ["vencida", "Vencidos"], ["baja", "Bajas"]].map(([id, t]) => `<button class="fchip" data-est="${id}" aria-pressed="${filtroSocios.estado === id}">${t} (${cuenta(id)})</button>`).join("")}</div>
      <div class="rows" id="lista"></div>`;
    const pintar = async () => {
      const lista = await A.listarSocios(filtroSocios);
      $("#lista").innerHTML = lista.length ? lista.slice(0, 120).map((s) => `<button class="row" data-socio="${s.id}"><span class="avatar" aria-hidden="true">${esc(ini(s.nombre, s.apellido))}</span>
        <span class="row__main"><strong>${esc(s.apellido)}, ${esc(s.nombre)}</strong><span class="small muted">DNI ${esc(s.dni)} · ${esc(s.membresia.plan.nombre)}</span></span>
        <span class="row__end">${U.chipMembresia(s.membresia)}<span class="small dim">${s.estado === "baja" ? "" : (s.membresia.diasRestantes < 0 ? "venció " : "vence ") + T.ddmm(s.vence)}</span></span></button>`).join("") + (lista.length > 120 ? `<p class="small dim center">Mostrando 120 de ${lista.length}. Usá el buscador.</p>` : "")
        : `<div class="card empty">${icon("users")}<p>No hay socios con ese filtro.</p></div>`;
      $$("[data-socio]").forEach((b) => b.addEventListener("click", () => fichaSocio(b.dataset.socio)));
    };
    let t; $("#q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { filtroSocios.q = e.target.value; pintar(); }, 150); });
    $$("[data-est]").forEach((b) => b.addEventListener("click", () => { filtroSocios.estado = b.dataset.est; $$("[data-est]").forEach((x) => x.setAttribute("aria-pressed", x === b)); pintar(); }));
    $("#nuevo").addEventListener("click", () => formSocio(null));
    await pintar();
    if (param) fichaSocio(param);
  }
  async function fichaSocio(id) {
    const s = await A.socio(id);
    const m = s.membresia, mes = T.mes(T.hoy());
    const asis = s.reservas.filter((r) => r.estado === "asistio"), aus = s.reservas.filter((r) => r.estado === "ausente");
    const prox = s.reservas.filter((r) => (r.estado === "confirmada" || r.estado === "espera") && r.futura);
    const tasa = asis.length + aus.length ? asis.length / (asis.length + aus.length) : null;
    U.sheet({
      titulo: `${s.nombre} ${s.apellido}`, ancho: "720px", html: `
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px">${U.chipMembresia(m)}<span class="chip chip--plain">${esc(m.plan.nombre)}</span><span class="small muted">${m.diasRestantes >= 0 ? "Vence" : "Venció"} el ${T.ddmmaa(s.vence)}</span></div>
        <div class="btn-row" style="margin-bottom:14px">
          <a class="btn btn--ghost btn--sm" href="${U.wa(s.whatsapp, "¡Hola " + s.nombre + "! Te escribimos de GIM Adrogué.")}" target="_blank" rel="noopener">${icon("wa")} WhatsApp</a>
          <button class="btn btn--primary btn--sm" id="fs-pago">${icon("money")} Registrar pago</button>
          <button class="btn btn--ghost btn--sm" id="fs-edit">${icon("edit")} Editar</button>
          <button class="btn ${s.estado === "baja" ? "btn--ghost" : "btn--danger"} btn--sm" id="fs-baja">${s.estado === "baja" ? "Reactivar" : "Dar de baja"}</button></div>
        <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
          <div class="kpi"><span>Este mes</span><b>${asis.filter((r) => T.mes(r.fecha) === mes).length}</b><small>asistencias</small></div>
          <div class="kpi"><span>Presentismo</span><b>${tasa == null ? "—" : pct(tasa)}</b><small>${aus.length} ausencias</small></div>
          <div class="kpi"><span>Próximos</span><b>${prox.length}</b><small>turnos</small></div></div>
        <dl class="card" style="padding:4px 16px;margin-bottom:12px">
          <div class="kv"><dt>DNI</dt><dd>${esc(s.dni)}</dd></div><div class="kv"><dt>WhatsApp</dt><dd>+${esc(s.whatsapp)}</dd></div>
          <div class="kv"><dt>Email</dt><dd>${esc(s.email || "—")}</dd></div><div class="kv"><dt>Objetivo</dt><dd>${esc(s.objetivo || "—")}</dd></div>
          <div class="kv"><dt>Socio desde</dt><dd>${T.ddmmaa(s.alta)}</dd></div><div class="kv"><dt>PIN de la app</dt><dd>${esc(s.pin)}</dd></div></dl>
        <h3>Historial de asistencia</h3>
        ${s.reservas.length ? `<div class="table-wrap" style="max-height:260px;margin-bottom:14px"><table class="t"><thead><tr><th>Fecha</th><th>Actividad</th><th>Hora</th><th>Estado</th></tr></thead><tbody>
          ${s.reservas.slice(0, 40).map((r) => `<tr><td>${T.ddmm(r.fecha)}</td><td>${esc(r.actividad)}</td><td>${r.hora}</td><td>${U.chipReserva(r)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="small dim">Sin turnos todavía.</p>'}
        <h3>Pagos</h3>
        ${s.pagos.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Fecha</th><th>Plan</th><th>Medio</th><th class="num">Monto</th></tr></thead><tbody>
          ${s.pagos.map((p) => `<tr><td>${T.ddmmaa(p.fecha)}</td><td>${esc((A.plan(p.planId) || {}).nombre || "")}</td><td>${esc(p.medio)}</td><td class="num">${A.precio(p.monto)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="small dim">Sin pagos registrados.</p>'}`,
      onOpen(d, cerrar) {
        $("#fs-pago", d).onclick = () => { cerrar(); formPago(s.id); };
        $("#fs-edit", d).onclick = () => { cerrar(); formSocio(s); };
        $("#fs-baja", d).onclick = async () => {
          const baja = s.estado !== "baja";
          if (baja && !(await U.confirmar({ titulo: "¿Dar de baja?", texto: `${esc(s.nombre)} no va a poder ingresar a la app y se cancelan sus turnos futuros.`, si: "Dar de baja", peligro: true }))) return;
          await A.bajaSocio(s.id, baja); cerrar(); U.toast(baja ? "Socio dado de baja" : "Socio reactivado", "ok"); router();
        };
      },
    });
  }
  function formSocio(s) {
    const e = s || {};
    const OBJ = ["Ganar fuerza", "Ganar masa muscular", "Bajar de peso", "Salud y bienestar", "Rendimiento deportivo", "Readaptación de una lesión"];
    U.sheet({
      titulo: s ? "Editar socio" : "Nuevo socio", html: `<form id="f-socio"><div class="form-grid">
        <div class="field"><label for="so-n">Nombre</label><input class="input" id="so-n" value="${esc(e.nombre || "")}" required autocomplete="off"></div>
        <div class="field"><label for="so-a">Apellido</label><input class="input" id="so-a" value="${esc(e.apellido || "")}" required autocomplete="off"></div>
        <div class="field"><label for="so-d">DNI</label><input class="input" id="so-d" inputmode="numeric" value="${esc(e.dni || "")}" required></div>
        <div class="field"><label for="so-w">WhatsApp (con código de área)</label><input class="input" id="so-w" inputmode="tel" placeholder="11 5990 2139" value="${esc(e.whatsapp || "")}" required></div>
        <div class="field"><label for="so-e">Email (opcional)</label><input class="input" id="so-e" type="email" value="${esc(e.email || "")}"></div>
        <div class="field"><label for="so-p">Plan</label><select class="input" id="so-p">${A.planes().map((p) => `<option value="${p.id}" ${p.id === e.planId ? "selected" : ""}>${esc(p.nombre)} · ${A.precio(p.precio)}</option>`).join("")}</select></div>
        <div class="field"><label for="so-o">Objetivo</label><select class="input" id="so-o">${OBJ.map((o) => `<option ${o === e.objetivo ? "selected" : ""}>${o}</option>`).join("")}</select></div>
        <div class="field"><label for="so-pin">PIN de la app (4 números)</label><input class="input" id="so-pin" inputmode="numeric" maxlength="4" placeholder="${s ? "Dejar igual" : "Se genera solo"}" value=""></div>
      </div>${s ? "" : '<p class="hint">Después de crearlo, registrá el primer pago para activar la membresía.</p>'}
      <p class="form-error" id="so-err" role="alert"></p><button class="btn btn--primary btn--block">${s ? "Guardar cambios" : "Crear socio"}</button></form>`,
      onOpen(d, cerrar) {
        $("#f-socio", d).addEventListener("submit", async (ev) => {
          ev.preventDefault();
          try {
            const r = await A.guardarSocio({ id: e.id, nombre: $("#so-n", d).value, apellido: $("#so-a", d).value, dni: $("#so-d", d).value, whatsapp: $("#so-w", d).value, email: $("#so-e", d).value, planId: $("#so-p", d).value, objetivo: $("#so-o", d).value, pin: $("#so-pin", d).value });
            cerrar();
            if (!s) {
              U.sheet({ titulo: "Socio creado", html: `<p>${esc(r.nombreCompleto)} ya puede entrar a la app con su DNI <b>${esc(r.dni)}</b> y el PIN <b style="font-size:1.3rem;letter-spacing:.2em">${esc(r.pin)}</b>.</p>
                <div style="display:grid;gap:10px;margin-top:14px"><a class="btn btn--ghost" target="_blank" rel="noopener" href="${U.wa(r.whatsapp, `¡Hola ${r.nombre}! Bienvenido/a a GIM Adrogué. Ya podés reservar tus turnos desde la app: ${new URL("../", location.href).href} · Ingresá con tu DNI y el PIN ${r.pin}.`)}">${icon("wa")} Mandarle el acceso por WhatsApp</a>
                <button class="btn btn--primary" id="primer-pago">Registrar primer pago</button></div>`, onOpen(d2, c2) { $("#primer-pago", d2).onclick = () => { c2(); formPago(r.id); }; } });
            } else U.toast("Datos guardados", "ok");
            if (rutaActual === "socios") socios();
          } catch (er) { $("#so-err", d).textContent = er.message; }
        });
      },
    });
  }

  // ---------------------------------------------------------------
  // 4. Membresías y pagos
  // ---------------------------------------------------------------
  async function formPago(socioId) {
    const lista = await A.listarSocios({});
    const sel = socioId ? lista.find((s) => s.id === socioId) : null;
    U.sheet({
      titulo: "Registrar pago", html: `<form id="f-pago">
        <div class="field"><label for="pg-s">Socio</label><input class="input" id="pg-s" list="pg-lista" placeholder="Buscá por nombre o DNI" value="${sel ? esc(`${sel.apellido}, ${sel.nombre} · ${sel.dni}`) : ""}" required autocomplete="off">
          <datalist id="pg-lista">${lista.map((s) => `<option value="${esc(`${s.apellido}, ${s.nombre} · ${s.dni}`)}"></option>`).join("")}</datalist></div>
        <div class="form-grid">
          <div class="field"><label for="pg-p">Plan</label><select class="input" id="pg-p">${A.planes().map((p) => `<option value="${p.id}" data-precio="${p.precio}" ${sel && p.id === sel.planId ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></div>
          <div class="field"><label for="pg-m">Monto</label><input class="input" id="pg-m" type="number" min="0" step="100" required></div>
          <div class="field"><label for="pg-me">Medio de pago</label><select class="input" id="pg-me"><option>Efectivo</option><option>Transferencia</option><option>Mercado Pago</option><option>Débito</option></select></div>
          <div class="field"><label for="pg-f">Fecha</label><input class="input" id="pg-f" type="date" value="${T.hoy()}" required></div>
        </div>
        <p class="hint" id="pg-info"></p><p class="form-error" id="pg-err" role="alert"></p>
        <button class="btn btn--primary btn--block">Registrar pago</button></form>`,
      onOpen(d, cerrar) {
        const socioDe = () => { const v = $("#pg-s", d).value; const dni = (v.match(/(\d{7,9})\s*$/) || [])[1]; return lista.find((s) => s.dni === dni); };
        const upd = () => {
          const o = $("#pg-p", d).selectedOptions[0]; $("#pg-m", d).value = o.dataset.precio;
          const s = socioDe(), p = A.plan($("#pg-p", d).value);
          $("#pg-info", d).textContent = s ? `Vence hoy el ${T.ddmmaa(s.vence)}. Con este pago pasa a vencer el ${T.ddmmaa(T.sumarDias(s.vence >= $("#pg-f", d).value ? s.vence : $("#pg-f", d).value, p.dias))}.` : "";
        };
        upd();
        $("#pg-p", d).addEventListener("change", upd); $("#pg-s", d).addEventListener("change", () => { const s = socioDe(); if (s) $("#pg-p", d).value = s.planId; upd(); }); $("#pg-f", d).addEventListener("change", upd);
        $("#f-pago", d).addEventListener("submit", async (e) => {
          e.preventDefault();
          const s = socioDe();
          if (!s) { $("#pg-err", d).textContent = "Elegí un socio de la lista."; return; }
          try {
            const p = await A.registrarPago({ socioId: s.id, planId: $("#pg-p", d).value, monto: $("#pg-m", d).value, medio: $("#pg-me", d).value, fecha: $("#pg-f", d).value });
            cerrar(); U.toast(`Pago registrado. ${s.nombre} vence el ${T.ddmmaa(p.hasta)}.`, "ok");
            if (rutaActual === "pagos" || rutaActual === "socios") router();
          } catch (er) { $("#pg-err", d).textContent = er.message; }
        });
      },
    });
  }
  async function pagos() {
    const mes = T.mes(T.hoy());
    const [v, lista] = await Promise.all([A.vencimientos({ dias: 7 }), A.pagos({ mes })]);
    const total = lista.reduce((n, p) => n + p.monto, 0);
    const fila = (s, tipo) => `<div class="row row--wrap" style="cursor:default"><span class="avatar" aria-hidden="true">${esc(ini(s.nombre, s.apellido))}</span>
      <div class="row__main"><strong>${esc(s.nombre)} ${esc(s.apellido)}</strong><span class="small muted">${esc(s.membresia.plan.nombre)} · ${tipo === "vencido" ? "venció" : "vence"} ${s.membresia.diasRestantes === 0 ? "hoy" : T.ddmm(s.vence)}</span></div>
      <div class="row__end" style="grid-auto-flow:column;gap:6px"><a class="btn btn--ghost btn--sm" href="${U.wa(s.whatsapp, msj(tipo === "vencido" ? "vencido" : "vencimiento", varsSocio(s)))}" target="_blank" rel="noopener" aria-label="Avisar por WhatsApp a ${esc(s.nombre)}">${icon("wa")} Avisar</a>
        <button class="btn btn--primary btn--sm" data-pagar="${s.id}" aria-label="Registrar pago de ${esc(s.nombre)}">${icon("money")}</button></div></div>`;
    main().innerHTML = `
      <div class="a-head"><h1>Membresías y pagos</h1><div class="btn-row"><button class="btn btn--primary" id="nuevo-pago">${icon("money")} Registrar pago</button></div></div>
      <div class="kpis">
        <div class="kpi"><span>Cobrado este mes</span><b>${A.precio(total)}</b><small>${lista.length} pagos</small></div>
        <div class="kpi"><span>Vencen en 7 días</span><b>${v.proximos.length}</b><small>para renovar</small></div>
        <div class="kpi"><span>Vencidos</span><b style="color:var(--bad)">${v.vencidos.length}</b><small>últimos 30 días</small></div>
        <div class="kpi"><span>A cobrar (estimado)</span><b>${A.precio([...v.proximos, ...v.vencidos].reduce((n, s) => n + s.membresia.plan.precio, 0))}</b><small>vencidos + próximos</small></div>
      </div>
      <div class="cols">
        <section><h2>Vencen pronto</h2><div class="rows">${v.proximos.map((s) => fila(s, "proximo")).join("") || `<div class="card empty"><p>Nadie vence en los próximos 7 días.</p></div>`}</div></section>
        <section><h2>Vencidos</h2><div class="rows">${v.vencidos.map((s) => fila(s, "vencido")).join("") || `<div class="card empty"><p>No hay socios vencidos.</p></div>`}</div></section>
      </div>
      <h2 style="margin-top:22px">Pagos de ${esc(T.fmt(mes + "-01", { month: "long", year: "numeric" }))}</h2>
      <div class="table-wrap"><table class="t"><thead><tr><th>Fecha</th><th>Socio</th><th>Plan</th><th>Medio</th><th class="num">Monto</th></tr></thead><tbody>
        ${lista.map((p) => `<tr><td>${T.ddmm(p.fecha)}</td><td>${esc(p.socio)}</td><td>${esc(p.plan || "")}</td><td>${esc(p.medio)}</td><td class="num">${A.precio(p.monto)}</td></tr>`).join("") || '<tr><td colspan="5" class="dim">Sin pagos este mes.</td></tr>'}
      </tbody><tfoot><tr><td colspan="4"><b>Total</b></td><td class="num"><b>${A.precio(total)}</b></td></tr></tfoot></table></div>`;
    $("#nuevo-pago").onclick = () => formPago();
    $$("[data-pagar]").forEach((b) => b.addEventListener("click", () => formPago(b.dataset.pagar)));
  }

  // ---------------------------------------------------------------
  // 5. Reportes (SVG propio, sin librerías)
  // ---------------------------------------------------------------
  const SERIE1 = "#3a9ad9", SERIE2 = "#d95926";
  let CW = 560; // ancho real del gráfico en px (se calcula al pintar, así el texto queda a 12px)
  const RAMPA = ["#184f95", "#1c5cab", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#86b6ef", "#b7d3f6"];
  const colorRampa = (x) => RAMPA[Math.min(RAMPA.length - 1, Math.floor(x * RAMPA.length))];
  const fmtK = (n) => (n >= 1e6 ? (n / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " M" : n >= 1e3 ? Math.round(n / 1e3) + " mil" : String(n));
  const mesCorto = (m) => T.fmt(m + "-01", { month: "short" }).replace(".", "");
  // barra con extremo redondeado (4px) anclada a la base
  const barV = (x, y, w, h, r = 4) => h <= 0 ? "" : `M${x},${y + h}V${y + Math.min(r, h)}Q${x},${y} ${x + Math.min(r, w / 2)},${y}H${x + w - Math.min(r, w / 2)}Q${x + w},${y} ${x + w},${y + Math.min(r, h)}V${y + h}Z`;
  const barH = (x, y, w, h, r = 4) => w <= 0 ? "" : `M${x},${y}H${x + w - Math.min(r, w)}Q${x + w},${y} ${x + w},${y + Math.min(r, h / 2)}V${y + h - Math.min(r, h / 2)}Q${x + w},${y + h} ${x + w - Math.min(r, w)},${y + h}H${x}Z`;
  const tabla = (cab, filas) => `<details><summary>Ver tabla</summary><div class="table-wrap" style="margin-top:8px"><table class="t"><thead><tr>${cab.map((c, i) => `<th class="${i ? "num" : ""}">${c}</th>`).join("")}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((c, i) => `<td class="${i ? "num" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;

  function graficoOcupacion(datos) {
    const W = CW, fila = 34, L = Math.min(170, Math.round(W * 0.36)), H = datos.length * fila + 10, max = 1;
    const sx = (v) => (v / max) * (W - L - 50);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ocupación por actividad">
      ${[0, 0.5, 1].map((g) => `<line class="grid" x1="${L + sx(g)}" x2="${L + sx(g)}" y1="0" y2="${H - 6}"/>`).join("")}
      ${datos.map((d, i) => { const y = i * fila + 6; return `<text x="${L - 10}" y="${y + 15}" text-anchor="end">${esc(d.nombre.length > Math.floor(L / 6.6) ? d.nombre.slice(0, Math.floor(L / 6.6) - 1) + "…" : d.nombre)}</text>
        <path d="${barH(L, y, Math.max(2, sx(d.ocupacion)), 20)}" fill="${SERIE1}" tabindex="0" data-tip="<b>${pct(d.ocupacion)}</b>${esc(d.nombre)} · ${d.ocupados} de ${d.cupo} lugares"/>
        <text class="val" x="${L + sx(d.ocupacion) + 8}" y="${y + 15}">${pct(d.ocupacion)}</text>`; }).join("")}
    </svg>`;
  }
  function graficoPico(pico) {
    const horas = [...new Set(pico.map((p) => p.hora))].sort((a, b) => a - b), dias = [1, 2, 3, 4, 5, 6];
    const W = CW, L = 40, top = 20, cw = (W - L) / horas.length, ch = 30, H = top + dias.length * ch + 4;
    const map = new Map(pico.map((p) => [`${p.dia}|${p.hora}`, p]));
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ocupación por día y hora">
      ${horas.map((h, i) => (i % 2 === 0 ? `<text x="${L + i * cw + cw / 2}" y="12" text-anchor="middle">${h}h</text>` : "")).join("")}
      ${dias.map((d, j) => `<text x="${L - 8}" y="${top + j * ch + 19}" text-anchor="end">${DIAS_C[d]}</text>` + horas.map((h, i) => {
        const p = map.get(`${d}|${h}`);
        return p ? `<rect x="${L + i * cw + 1}" y="${top + j * ch + 1}" width="${cw - 2}" height="${ch - 2}" rx="4" fill="${colorRampa(p.ocupacion)}" data-tip="<b>${pct(p.ocupacion)}</b>${A.DIAS[d]} ${h}:00 · ${p.ocupados} de ${p.cupo} lugares"/>`
          : `<rect x="${L + i * cw + 1}" y="${top + j * ch + 1}" width="${cw - 2}" height="${ch - 2}" rx="4" fill="#161b21"/>`;
      }).join("")).join("")}
    </svg><div class="ramp"><span>0%</span><span style="background:linear-gradient(90deg,${RAMPA.join(",")})"></span><span>100% ocupado</span></div>`;
  }
  function graficoColumnas(datos, { color = SERIE1, fmt = (v) => v, etiqueta, parcial, ancho }) {
    const W = ancho || CW, H = 220, L = 58, B = 26, top = 18, n = datos.length;
    const max = Math.max(1, ...datos.map((d) => d.v)) * 1.12;
    const bw = Math.min(56, ((W - L) / n) * 0.6), paso = (W - L) / n;
    const sy = (v) => (v / max) * (H - B - top);
    const ticks = [0, max / 2, max].map((t) => Math.round(t));
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(etiqueta)}">
      <defs><pattern id="rayas-${etiqueta.length}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${color}" opacity=".45"/><rect width="2.5" height="6" fill="${color}"/></pattern></defs>
      ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W}" y1="${H - B - sy(t)}" y2="${H - B - sy(t)}"/><text x="${L - 8}" y="${H - B - sy(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join("")}
      ${datos.map((d, i) => { const x = L + i * paso + (paso - bw) / 2, h = sy(d.v), y = H - B - h; const p = parcial && parcial(d, i);
        return `<path d="${barV(x, y, bw, h)}" fill="${p ? `url(#rayas-${etiqueta.length})` : color}" tabindex="0" data-tip="<b>${fmt(d.v)}</b>${esc(d.tip || d.l)}${p ? " (en curso)" : ""}"/>
        <text class="val" x="${x + bw / 2}" y="${y - 6}" text-anchor="middle">${fmt(d.v)}</text><text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(d.l)}</text>`; }).join("")}
      <line class="axis" x1="${L}" x2="${W}" y1="${H - B}" y2="${H - B}"/>
    </svg>`;
  }
  function graficoAltasBajas(meses) {
    const W = CW, H = 210, L = 34, B = 26, top = 18, n = meses.length;
    const max = Math.max(1, ...meses.flatMap((m) => [m.altas, m.bajas])) * 1.15, paso = (W - L) / n, bw = Math.min(22, paso * 0.3);
    const sy = (v) => (v / max) * (H - B - top);
    return `<div class="legend"><span><i style="background:${SERIE1}"></i>Altas</span><span><i style="background:${SERIE2}"></i>Bajas</span></div>
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Altas y bajas por mes">
      ${[0, Math.round(max / 2), Math.round(max)].map((t) => `<line class="grid" x1="${L}" x2="${W}" y1="${H - B - sy(t)}" y2="${H - B - sy(t)}"/><text x="${L - 8}" y="${H - B - sy(t) + 4}" text-anchor="end">${t}</text>`).join("")}
      ${meses.map((m, i) => { const cx = L + i * paso + paso / 2, x1 = cx - bw - 1, x2 = cx + 1;
        return `<path d="${barV(x1, H - B - sy(m.altas), bw, sy(m.altas))}" fill="${SERIE1}" tabindex="0" data-tip="<b>${m.altas} altas</b>${mesCorto(m.mes)}"/>
          <path d="${barV(x2, H - B - sy(m.bajas), bw, sy(m.bajas))}" fill="${SERIE2}" tabindex="0" data-tip="<b>${m.bajas} bajas</b>${mesCorto(m.mes)}"/>
          ${m.altas ? `<text class="val" x="${x1 + bw / 2}" y="${H - B - sy(m.altas) - 5}" text-anchor="middle">${m.altas}</text>` : ""}
          ${m.bajas ? `<text class="val" x="${x2 + bw / 2}" y="${H - B - sy(m.bajas) - 5}" text-anchor="middle">${m.bajas}</text>` : ""}
          <text x="${cx}" y="${H - 8}" text-anchor="middle">${mesCorto(m.mes)}</text>`; }).join("")}
      <line class="axis" x1="${L}" x2="${W}" y1="${H - B}" y2="${H - B}"/></svg>`;
  }
  async function reportes() {
    const r = await A.reportes({ semanas: 6 });
    const ancho = main().clientWidth - 34; // padding de la tarjeta
    CW = Math.round(innerWidth >= 1000 ? (ancho - 16) / 2 - 2 : ancho);
    const k = r.kpis, dif = k.ingresosMesAnterior ? (k.ingresosMes - k.ingresosMesAnterior) / k.ingresosMesAnterior : 0;
    const diaMes = Number(T.hoy().slice(8));
    main().innerHTML = `
      <div class="a-head"><h1>Reportes</h1><span class="small muted">Últimas 6 semanas · del ${T.ddmm(r.desde)} al ${T.ddmm(r.hasta)}</span></div>
      <div class="kpis">
        <div class="kpi"><span>Socios activos</span><b>${k.sociosActivos}</b><small>${k.vencidos} con plan vencido</small></div>
        <div class="kpi"><span>Ocupación promedio</span><b>${pct(k.ocupacion)}</b><small>de los turnos dictados</small></div>
        <div class="kpi"><span>Asistencias esta semana</span><b>${k.asistenciasSemana}</b><small>hasta hoy</small></div>
        <div class="kpi"><span>Ingresos del mes</span><b>${A.precio(k.ingresosMes)}</b><small>${diaMes} días · mes anterior ${A.precio(k.ingresosMesAnterior)}</small></div>
      </div>
      <div class="charts">
        <section class="chart-card"><h2>Ocupación por actividad</h2><p>Lugares ocupados sobre lugares ofrecidos.</p>${graficoOcupacion(r.ocupacionActividad)}
          ${tabla(["Actividad", "Ocupación", "Ocupados", "Cupo"], r.ocupacionActividad.map((a) => [a.nombre, pct(a.ocupacion), a.ocupados, a.cupo]))}</section>
        <section class="chart-card"><h2>Horarios pico</h2><p>Ocupación promedio por día y hora de inicio.</p>${graficoPico(r.pico)}
          ${tabla(["Día y hora", "Ocupación", "Ocupados"], r.pico.sort((a, b) => b.ocupacion - a.ocupacion).slice(0, 12).map((p) => [`${A.DIAS[p.dia]} ${p.hora}:00`, pct(p.ocupacion), p.ocupados]))}</section>
        <section class="chart-card"><h2>Asistencia semanal</h2><p>Socios que vinieron a su turno. La semana rayada está en curso.</p>
          ${graficoColumnas(r.semanal.map((s) => ({ v: s.asistencias, l: T.ddmm(s.lunes), tip: "Semana del " + T.ddmm(s.lunes) + " · " + s.ausencias + " ausencias" })), { etiqueta: "Asistencia semanal", parcial: (d, i) => r.semanal[i].enCurso })}
          ${tabla(["Semana", "Asistencias", "Ausencias"], r.semanal.map((s) => [T.ddmm(s.lunes), s.asistencias, s.ausencias]))}</section>
        <section class="chart-card"><h2>Altas y bajas</h2><p>Socios nuevos y bajas por mes.</p>${graficoAltasBajas(r.meses)}
          ${tabla(["Mes", "Altas", "Bajas"], r.meses.map((m) => [mesCorto(m.mes), m.altas, m.bajas]))}</section>
        <section class="chart-card span2"><h2>Ingresos</h2><p>Pagos registrados por mes${dif ? ` · el mes en curso va ${diaMes} días` : ""}.</p>
          ${graficoColumnas(r.meses.map((m) => ({ v: m.ingresos, l: mesCorto(m.mes), tip: mesCorto(m.mes) })), { etiqueta: "Ingresos por mes", ancho: Math.round(ancho), fmt: (v) => (v ? "$ " + fmtK(v) : "0"), parcial: (d, i) => i === r.meses.length - 1 })}
          <div class="kv" style="margin-top:6px"><dt>Este mes por plan</dt><dd>${r.ingresosPorPlan.filter((p) => p.total).map((p) => `${esc(p.plan)}: ${A.precio(p.total)}`).join(" · ")}</dd></div>
          ${tabla(["Mes", "Ingresos"], r.meses.map((m) => [mesCorto(m.mes), A.precio(m.ingresos)]))}</section>
      </div>`;
  }
  // Tooltip único para todos los gráficos (hover y foco con teclado)
  const tip = document.createElement("div"); tip.className = "tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip);
  const mostrarTip = (el, x, y) => { tip.innerHTML = el.getAttribute("data-tip"); tip.classList.add("is-on"); const r = tip.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - r.width - 8, Math.max(8, x - r.width / 2)) + "px"; tip.style.top = Math.max(8, y - r.height - 12) + "px"; };
  document.addEventListener("pointermove", (e) => { const el = e.target.closest && e.target.closest(".chart [data-tip]"); el ? mostrarTip(el, e.clientX, e.clientY) : tip.classList.remove("is-on"); });
  document.addEventListener("focusin", (e) => { const el = e.target.closest && e.target.closest(".chart [data-tip]"); if (el) { const b = el.getBoundingClientRect(); mostrarTip(el, b.left + b.width / 2, b.top); } else tip.classList.remove("is-on"); });

  // ---------------------------------------------------------------
  // 6. Configuración
  // ---------------------------------------------------------------
  async function config() {
    const c = ajustes;
    const TX = [["renovar", "Renovar plan (lo manda el socio)"], ["avisoReserva", "Avisame por WhatsApp (lo manda el socio)"], ["recordatorio", "Recordatorio de turno (lo manda el gimnasio)"], ["vencimiento", "Plan por vencer"], ["vencido", "Plan vencido"]];
    main().innerHTML = `
      <div class="a-head"><h1>Configuración</h1></div>
      <form id="f-cfg">
      <div class="cols">
        <section class="card"><h2>Horario del gimnasio</h2><p class="small muted">Fuera de este horario no se puede reservar.</p>
          ${[1, 2, 3, 4, 5, 6, 0].map((d) => { const t = (c.horarios[d] || [])[0]; return `<div class="hours-row"><strong>${A.DIAS[d]}</strong>
            <input class="input" type="time" data-abre="${d}" value="${t ? t[0] : "09:00"}" aria-label="${A.DIAS[d]} abre" ${t ? "" : "disabled"}>
            <input class="input" type="time" data-cierra="${d}" value="${t ? t[1] : "18:00"}" aria-label="${A.DIAS[d]} cierra" ${t ? "" : "disabled"}>
            <label class="cerrado"><input type="checkbox" data-cerrado="${d}" ${t ? "" : "checked"}> Cerrado</label></div>`; }).join("")}
        </section>
        <section class="card"><h2>Reservas</h2>
          <div class="field"><label for="c-canc">Se puede cancelar o reprogramar hasta (horas antes)</label><input class="input" id="c-canc" type="number" min="0" max="48" value="${c.cancelacionHoras}"></div>
          <div class="field"><label for="c-ant">Se puede reservar con hasta (días de anticipación)</label><input class="input" id="c-ant" type="number" min="1" max="30" value="${c.anticipacionDias}"></div>
          <label class="switch" style="border:0"><span><strong>Lista de espera</strong><span class="small muted" style="display:block">Si un turno se completa, los socios pueden anotarse y pasan solos si se libera un lugar.</span></span><input type="checkbox" id="c-esp" ${c.listaEspera ? "checked" : ""}></label>
          <h2 style="margin-top:18px">Datos de la demo</h2>
          <p class="small muted">Vuelve a generar socios, turnos y pagos de ejemplo con la fecha de hoy. Útil antes de grabar un video.</p>
          <div class="btn-row"><button type="button" class="btn btn--danger btn--sm" id="reset">Restablecer datos de ejemplo</button><button type="button" class="btn btn--ghost btn--sm" id="export">${icon("download")} Exportar JSON</button></div>
        </section>
      </div>
      <section class="card" style="margin-top:16px"><h2>Mensajes de WhatsApp</h2><p class="small muted">Variables: {nombre} {plan} {precio} {vence} {actividad} {fecha} {hora}</p>
        ${TX.map(([k, t]) => `<div class="field"><label for="tx-${k}">${t}</label><textarea class="input" id="tx-${k}" data-tx="${k}" rows="3">${esc(c.textos[k])}</textarea></div>`).join("")}
      </section>
      <div class="sticky-cta" style="bottom:12px"><button class="btn btn--primary btn--block btn--xl">Guardar configuración</button></div>
      </form>`;
    $$("[data-cerrado]").forEach((cb) => cb.addEventListener("change", () => { const d = cb.dataset.cerrado; $(`[data-abre="${d}"]`).disabled = cb.checked; $(`[data-cierra="${d}"]`).disabled = cb.checked; }));
    $("#f-cfg").addEventListener("submit", async (e) => {
      e.preventDefault();
      const horarios = {};
      for (const d of [0, 1, 2, 3, 4, 5, 6]) {
        if ($(`[data-cerrado="${d}"]`).checked) { horarios[d] = []; continue; }
        const a = $(`[data-abre="${d}"]`).value, b = $(`[data-cierra="${d}"]`).value;
        if (!a || !b || a >= b) { U.toast(`Revisá el horario del ${A.DIAS[d].toLowerCase()}`, "bad"); return; }
        horarios[d] = [[a, b]];
      }
      const textos = {}; $$("[data-tx]").forEach((t) => (textos[t.dataset.tx] = t.value));
      try { ajustes = await A.guardarConfig({ horarios, cancelacionHoras: Number($("#c-canc").value), anticipacionDias: Number($("#c-ant").value), listaEspera: $("#c-esp").checked, textos }); U.toast("Configuración guardada", "ok"); } catch (er) { error(er); }
    });
    $("#reset").onclick = async () => { if (await U.confirmar({ titulo: "¿Restablecer la demo?", texto: "Se borran todos los cambios y se generan datos de ejemplo nuevos.", si: "Restablecer", peligro: true })) { await A.resetDemo(); U.toast("Datos de ejemplo regenerados", "ok"); location.hash = "#/agenda"; } };
    $("#export").onclick = async () => { const d = await A.exportar(); const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `gim-turnos-${T.hoy()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); };
  }

  // ---------------------------------------------------------------
  U.pwa({ swUrl: "../sw.js", scope: "../" });
  router();
})();
