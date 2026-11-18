/* GIM Adrogué · utilidades de interfaz compartidas (socio y panel) */
(function () {
  "use strict";
  const A = window.GIMAPI;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const P = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  const ICON = {
    home: P('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
    plus: P('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
    list: P('<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M4 10h16M8 14h3M8 17h6"/>'),
    qr: P('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h3v4h-3"/>'),
    user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
    back: P('<path d="M15 5l-7 7 7 7"/>'),
    close: P('<path d="M6 6l12 12M18 6L6 18"/>'),
    cal: P('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
    clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    download: P('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    logout: P('<path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3"/>'),
    card: P('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'),
    bell: P('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
    install: P('<path d="M12 3v12M7 10l5 5 5-5"/><rect x="4" y="17" width="16" height="4" rx="1"/>'),
    share: P('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/>'),
    check: P('<path d="M5 12.5l4.5 4.5L19 7"/>'),
    x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
    edit: P('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
    trash: P('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    camera: P('<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="4"/>'),
    chart: P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    users: P('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .8 3.4 2.6 4 5.2"/>'),
    money: P('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>'),
    grid: P('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    lock: P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    copy: P('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
    // actividades
    fuerza: P('<path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8"/>'),
    plan: P('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v2h6V3M9 11l2 2 4-4M9 17h6"/>'),
    preparacion: P('<circle cx="14" cy="4" r="2"/><path d="M8 21l3-6 3 3v4M6 12l3-4 4 1 3 4h3M11 15l-2-3"/>'),
    readaptacion: P('<path d="M12 21s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.2-8 11-8 11z"/><path d="M8 12h2l1.5-3 2 6 1.5-3h1"/>'),
    returnplay: P('<circle cx="12" cy="12" r="9"/><path d="M12 3l2.5 5.5L12 12 9.5 8.5zM12 12l4.5 2-1 5M12 12l-4.5 2 1 5"/>'),
    evaluacion: P('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'),
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.43 9.43 0 1 1 8 4.42zm8.03-17.46A11.32 11.32 0 0 0 12.05.72C5.8.72.7 5.8.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.6l6.02-1.58a11.32 11.32 0 0 0 5.42 1.38h.01c6.25 0 11.34-5.09 11.34-11.34 0-3.03-1.18-5.88-3.31-8.02z"/></svg>',
    tri: '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M20 1 39 33H1Z" fill="#3A9AD9"/><path d="M20 13 29 28H11Z" fill="#0b0d10"/></svg>',
  };
  const icon = (n, cls = "i") => (ICON[n] || ICON.plan).replace("<svg ", `<svg class="${cls}" `);

  const wa = (numero, texto) => `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  const waGym = (texto) => wa(CONFIG.contacto.whatsapp, texto);

  // ---------- Toast ----------
  function toast(msg, tipo = "") {
    let box = $(".toasts");
    if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    const t = document.createElement("div");
    t.className = "toast" + (tipo ? " toast--" + tipo : "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => { t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 3200);
  }

  // ---------- Hoja inferior (dialog nativo) ----------
  function sheet({ titulo, html, onOpen, ancho }) {
    const d = document.createElement("dialog");
    d.className = "sheet";
    if (ancho) d.style.maxWidth = ancho;
    d.setAttribute("aria-label", titulo || "Ventana");
    d.innerHTML = `<div class="sheet__box"><div class="sheet__grip" aria-hidden="true"></div>
      <div class="sheet__head"><h2>${esc(titulo || "")}</h2><button class="icon-btn" data-cerrar aria-label="Cerrar">${icon("close")}</button></div>
      <div class="sheet__body">${html}</div></div>`;
    document.body.appendChild(d);
    const cerrar = () => { d.close(); };
    d.addEventListener("close", () => d.remove());
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-cerrar]")) cerrar(); });
    d.showModal();
    if (onOpen) onOpen(d, cerrar);
    return { el: d, cerrar };
  }
  function confirmar({ titulo, texto, si = "Confirmar", no = "Volver", peligro }) {
    return new Promise((res) => {
      let ok = false;
      const s = sheet({
        titulo, html: `<p class="muted">${texto}</p><div class="btn-row" style="margin-top:16px"><button class="btn btn--ghost" data-no>${esc(no)}</button><button class="btn ${peligro ? "btn--danger" : "btn--primary"}" data-si>${esc(si)}</button></div>`,
        onOpen(d, cerrar) { $("[data-no]", d).onclick = cerrar; $("[data-si]", d).onclick = () => { ok = true; cerrar(); }; d.addEventListener("close", () => res(ok)); },
      });
      return s;
    });
  }

  // ---------- QR (qrcode-generator, local) ----------
  function qrSVG(texto) {
    if (typeof window.qrcode !== "function") return `<p class="dim small">${esc(texto)}</p>`;
    const q = window.qrcode(0, "M"); q.addData(texto); q.make();
    const n = q.getModuleCount(); let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="Código QR" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#0b0d10"/></svg>`;
  }

  // ---------- Calendario (.ics) ----------
  function icsReserva(r) {
    const T = A.T;
    const utc = (f, h) => new Date(T.ms(f, h)).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const dir = CONFIG.contacto.direccion;
    const txt = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GIM Adrogue//Turnos//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT", `UID:${r.id}@gim-adrogue`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART:${utc(r.fecha, r.hora)}`, `DTEND:${utc(r.fecha, r.fin)}`,
      `SUMMARY:${r.actividad} · GIM Adrogué`, `LOCATION:${dir}\\, Adrogué\\, Buenos Aires`,
      `DESCRIPTION:Turno de ${r.actividad}${r.profe ? " con " + r.profe : ""}. Código: ${r.codigo}. Cancelá desde la app si no podés ir.`,
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Turno en GIM Adrogué", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([txt], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `gim-turno-${r.fecha}-${r.hora.replace(":", "")}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ---------- Estados ----------
  function chipMembresia(m) {
    const cls = { "al-dia": "ok", "vence-pronto": "warn", vencida: "bad", baja: "plain" }[m.estado];
    return `<span class="chip chip--${cls}">${A.ESTADOS[m.estado]}</span>`;
  }
  const ESTADO_RES = { confirmada: ["info", "Confirmado"], espera: ["warn", "Lista de espera"], asistio: ["ok", "Asistió"], ausente: ["bad", "Ausente"], cancelada: ["plain", "Cancelado"] };
  function chipReserva(r) { const [c, t] = ESTADO_RES[r.estado] || ["plain", r.estado]; return `<span class="chip chip--${c}">${t}${r.estado === "espera" && r.posicionEspera ? " · #" + r.posicionEspera : ""}</span>`; }
  function datebadge(f) { const T = A.T; return `<div class="datebadge"><small>${esc(T.fmt(f, { weekday: "short" }).replace(".", ""))}</small><b>${Number(f.slice(8))}</b><small>${esc(T.fmt(f, { month: "short" }).replace(".", ""))}</small></div>`; }

  // ---------- PWA: service worker + instalación ----------
  let promptInstalar = null;
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function pwa({ swUrl, scope, onCambio }) {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      window.addEventListener("load", () => navigator.serviceWorker.register(swUrl, { scope }).catch(() => {}));
    }
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); promptInstalar = e; onCambio && onCambio(); });
    window.addEventListener("appinstalled", () => { promptInstalar = null; toast("¡Listo! La app quedó instalada.", "ok"); onCambio && onCambio(); });
  }
  const puedeInstalar = () => !standalone() && (!!promptInstalar || esIOS());
  async function instalar() {
    if (promptInstalar) { promptInstalar.prompt(); await promptInstalar.userChoice; promptInstalar = null; return; }
    if (esIOS()) {
      sheet({ titulo: "Instalá la app", html: `<p class="muted">Agregá GIM a tu pantalla de inicio y abrila como una app, sin pasar por el navegador.</p>
        <ol class="ios-steps"><li><span>Tocá <b>Compartir</b> ${icon("share")} en la barra de Safari.</span></li><li><span>Elegí <b>“Agregar a inicio”</b>.</span></li><li><span>Confirmá con <b>Agregar</b>. ¡Listo!</span></li></ol>
        <button class="btn btn--primary btn--block" data-cerrar>Entendido</button>` });
      return;
    }
    sheet({ titulo: "Instalá la app", html: `<p class="muted">Abrí el menú del navegador (⋮) y elegí <b>“Instalar app”</b> o <b>“Agregar a pantalla de inicio”</b>.</p><button class="btn btn--primary btn--block" data-cerrar>Entendido</button>` });
  }

  window.UI = { $, $$, esc, icon, ICON, wa, waGym, toast, sheet, confirmar, qrSVG, icsReserva, chipMembresia, chipReserva, datebadge, pwa, puedeInstalar, instalar, esIOS, standalone };
})();
