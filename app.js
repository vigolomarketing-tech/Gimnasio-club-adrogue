// GIM – Club Atlético Adrogué · arma la página a partir de CONFIG (data.js)
(function () {
  "use strict";
  const C = CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), C);
  const wa = (msg, num = C.contacto.whatsapp) => `https://wa.me/${num}?text=${encodeURIComponent(msg || C.contacto.mensajeWhatsapp)}`;
  const precio = (n) => "$ " + Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const waIcon = '<svg class="i" aria-hidden="true"><use href="#i-wa"/></svg>';

  // ---------- Textos simples, links de WhatsApp y Maps ----------
  $$("[data-text]").forEach((el) => { const v = get(el.dataset.text); if (v != null) el.textContent = v; });
  $$("[data-wa]").forEach((el) => { el.href = wa(el.dataset.wa); });
  $$("[data-maps]").forEach((el) => { el.href = C.contacto.mapsLink; });
  $("#ig").href = C.contacto.instagram;
  $("#fb").href = C.contacto.facebook;
  $("#tel").href = "tel:" + C.contacto.telefono.replace(/[^\d+]/g, "");
  $("#map").src = C.contacto.mapsEmbed;
  $("#year").textContent = new Date().getFullYear();

  // ---------- Logo ----------
  const tri = '<svg class="brand__tri" viewBox="0 0 40 34" aria-hidden="true"><path d="M20 1 39 33H1Z" fill="#3A9AD9"/><path d="M20 13 29 28H11Z" fill="#0b0d10"/></svg>';
  $$("[data-logo]").forEach((el) => {
    el.innerHTML = C.negocio.logo
      ? `<img src="${esc(C.negocio.logo)}" alt="GIM – Club Atlético Adrogué" width="160" height="44">`
      : `${tri}<span><span class="brand__gim">GIM</span><span class="brand__club">Club Atlético<br>Adrogué</span></span>`;
  });
  $$(".brand > span").forEach((s) => { s.style.display = "flex"; s.style.alignItems = "center"; s.style.gap = "8px"; });

  // ---------- Hero ----------
  $("#hero-badges").innerHTML = C.negocio.badges.map((b) => `<li>${esc(b)}</li>`).join("");

  // ---------- Horarios / Abierto ahora (hora de Argentina) ----------
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  function ahoraAR() {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
    return { dia, min: Number(p.hour) * 60 + Number(p.minute) };
  }
  const aMin = (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
  function estado() {
    const { dia, min } = ahoraAR();
    const turnos = C.horarios[dia] || [];
    const abierto = turnos.some(([a, b]) => { const ini = aMin(a); let fin = aMin(b); if (fin <= ini) fin += 1440; return min >= ini && min < fin; });
    const hoy = turnos.length ? turnos.map(([a, b]) => `${a} a ${b} hs`).join(" y ") : "Cerrado";
    let texto = `Hoy: ${hoy}`;
    if (!abierto) {
      // próxima apertura
      for (let i = 0; i < 7; i++) {
        const d = (dia + i) % 7;
        const t = (C.horarios[d] || []).find(([a]) => i > 0 || aMin(a) > min);
        if (t) { texto = `Abre ${i === 0 ? "hoy" : i === 1 ? "mañana" : "el " + DIAS[d]} a las ${t[0]} hs`; break; }
      }
    }
    const st = $("#status");
    st.textContent = abierto ? "Abierto ahora" : "Cerrado ahora";
    st.classList.toggle("is-open", abierto);
    $("#hoy").textContent = abierto ? `Hoy: ${hoy}` : texto;
    return dia;
  }
  const hoyIdx = estado();
  setInterval(estado, 60000);

  const enTabla = (fila, d) => (d === 0 ? /domingo/i : d === 6 ? /s[aá]bado/i : /lunes/i).test(fila.dias);
  $("#horarios-tabla").innerHTML = C.horariosTabla
    .map((f) => `<tr${enTabla(f, hoyIdx) ? ' class="is-today"' : ""}><td>${esc(f.dias)}</td><td>${esc(f.horas)}</td></tr>`)
    .join("");

  // ---------- Servicios ----------
  const ICONOS = {
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v2h6V3M9 11l2 2 4-4M9 17h6"/></svg>',
    fuerza: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8"/></svg>',
    preparacion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="4" r="2"/><path d="M8 21l3-6 3 3v4M6 12l3-4 4 1 3 4h3M11 15l-2-3"/></svg>',
    readaptacion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.2-8 11-8 11z"/><path d="M8 12h2l1.5-3 2 6 1.5-3h1"/></svg>',
    returnplay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3l2.5 5.5L12 12 9.5 8.5zM12 12l4.5 2-1 5M12 12l-4.5 2 1 5M3.5 9.5l6 -1M20.5 9.5l-6-1"/></svg>',
    evaluacion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/><path d="M15 8h4v4"/></svg>',
  };
  $("#servicios").innerHTML = C.servicios
    .map((s) => `
      <article class="card reveal">
        <div class="card__icon" aria-hidden="true">${ICONOS[s.icono] || ICONOS.plan}</div>
        <h3>${esc(s.titulo)}</h3>
        <p>${esc(s.texto)}</p>
        <a class="btn btn--ghost btn--sm" href="${wa(`¡Hola! Quiero consultar por ${s.titulo} en GIM Adrogué.`)}" target="_blank" rel="noopener" aria-label="Consultar por ${esc(s.titulo)} por WhatsApp">${waIcon} Consultar</a>
      </article>`)
    .join("");

  // ---------- Contadores ----------
  $("#stats").innerHTML = C.numeros
    .map((n) => `<div class="stat reveal"><strong data-count="${n.valor}" data-pre="${esc(n.prefijo || "")}" data-suf="${esc(n.sufijo || "")}">${esc(n.prefijo || "")}${Number(n.valor).toLocaleString("es-AR")}${esc(n.sufijo || "")}</strong><span>${esc(n.texto)}</span></div>`)
    .join("");

  // ---------- Academia ----------
  const A = C.academia;
  $("#academia-foto").src = A.foto;
  $("#academia-curso").textContent = A.curso;
  $("#academia-inst").textContent = A.institucion;
  $("#academia-nota").textContent = A.nota;
  const inicio = A.fechaInicio ? `Inicio: ${A.fechaInicio}` : "Consultá próxima fecha de inicio";
  $("#academia-facts").innerHTML = [["Duración", A.duracion], ["Dónde", A.lugar], ["Inicio", A.fechaInicio || "Consultá próxima fecha de inicio"]]
    .map(([k, v]) => `<li><b>${k}</b><span>${esc(v)}</span></li>`).join("");
  $("#academia-temario").innerHTML = A.temario.map((t) => `<li><svg class="i" aria-hidden="true"><use href="#i-check"/></svg>${esc(t)}</li>`).join("");
  const acta = $("#academia-cta");
  acta.href = wa(`¡Hola ${A.contactoNombre}! Quiero info del ${A.curso} (IAAF) en GIM Adrogué. ${A.fechaInicio ? inicio + "." : "¿Cuándo es la próxima fecha de inicio?"}`, A.contactoWhatsapp);
  $("span", acta).textContent = `Inscribite con ${A.contactoNombre}`;

  // ---------- Tienda ----------
  const T = C.tienda;
  $("#tienda-categorias").innerHTML = T.categorias
    .map((c) => `
      <article class="card shop-card reveal">
        <img src="${esc(c.foto)}" alt="${esc(c.nombre)}" width="700" height="525" loading="lazy">
        <div class="shop-card__body">
          <h3>${esc(c.nombre)}</h3>
          <p>${esc(c.texto)}</p>
          <a class="btn btn--primary btn--sm" href="${wa(`¡Hola! Quiero consultar por ${c.nombre} en GIM Adrogué.`)}" target="_blank" rel="noopener" aria-label="Consultar por ${esc(c.nombre)} por WhatsApp">${waIcon} Consultar por WhatsApp</a>
        </div>
      </article>`)
    .join("");

  if (T.productos.length) {
    const cat = $("#catalogo");
    cat.hidden = false;
    const nombreCat = (id) => (T.categorias.find((c) => c.id === id) || {}).nombre || id;
    const usadas = [...new Set(T.productos.map((p) => p.categoria))];
    const filtros = $("#catalogo-filtros");
    filtros.innerHTML = ["todos", ...usadas].map((id, i) => `<button class="chip" data-cat="${esc(id)}" aria-pressed="${i === 0}">${id === "todos" ? "Todos" : esc(nombreCat(id))}</button>`).join("");
    const pintar = (f) => {
      $("#catalogo-grid").innerHTML = T.productos
        .filter((p) => f === "todos" || p.categoria === f)
        .map((p) => `
          <article class="card shop-card">
            ${p.foto ? `<img src="${esc(p.foto)}" alt="${esc(p.nombre)}" width="700" height="525" loading="lazy">` : ""}
            <div class="shop-card__body">
              <h3>${esc(p.nombre)}</h3>
              ${p.precio ? `<div class="precio">${precio(p.precio)}</div>` : ""}
              <a class="btn btn--primary btn--sm" href="${wa(`¡Hola! Quiero consultar por ${p.nombre}${p.precio ? " (" + precio(p.precio) + ")" : ""} en GIM Adrogué.`)}" target="_blank" rel="noopener">${waIcon} Consultar</a>
            </div>
          </article>`).join("");
    };
    filtros.addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      $$(".chip", filtros).forEach((x) => x.setAttribute("aria-pressed", x === b));
      pintar(b.dataset.cat);
    });
    pintar("todos");
  }

  // ---------- Equipo ----------
  const iniciales = (n) => /confirmar/i.test(n) ? "GIM" : n.replace(/^Lic\.\s*/i, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  $("#equipo-grid").innerHTML = C.equipo
    .map((m) => `
      <article class="card member reveal">
        ${m.foto ? `<img class="member__photo" src="${esc(m.foto)}" alt="${esc(m.nombre)}" width="128" height="128" loading="lazy">` : `<div class="member__initials" aria-hidden="true">${esc(iniciales(m.nombre))}</div>`}
        <h3>${esc(m.nombre)}</h3>
        <p>${esc(m.rol)}</p>
      </article>`)
    .join("");

  // ---------- Galería + lightbox ----------
  const G = C.galeria;
  $("#gallery").innerHTML = G.map((g, i) => `<button type="button" data-i="${i}" class="reveal" aria-label="Ampliar foto: ${esc(g.alt)}"><img src="${esc(g.thumb || g.src)}" alt="${esc(g.alt)}" width="600" height="450" loading="lazy"></button>`).join("");
  const lb = $("#lightbox"), lbImg = $("#lightbox-img");
  let actual = 0;
  const mostrar = (i) => { actual = (i + G.length) % G.length; lbImg.src = G[actual].src; lbImg.alt = G[actual].alt; };
  $("#gallery").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; mostrar(+b.dataset.i); lb.showModal(); });
  $("[data-prev]", lb).addEventListener("click", () => mostrar(actual - 1));
  $("[data-next]", lb).addEventListener("click", () => mostrar(actual + 1));
  $("[data-close]", lb).addEventListener("click", () => lb.close());
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") mostrar(actual - 1); if (e.key === "ArrowRight") mostrar(actual + 1); });
  let tx = null;
  lb.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) mostrar(actual + (dx < 0 ? 1 : -1)); tx = null; });

  // ---------- Testimonios (carrusel) ----------
  const track = $("#carousel-track"), dots = $("#carousel-dots");
  track.innerHTML = C.testimonios
    .map((t, i) => `<figure class="quote" role="group" aria-roledescription="opinión" aria-label="${i + 1} de ${C.testimonios.length}">
        <div class="quote__stars" aria-label="${t.estrellas} de 5 estrellas">${"★".repeat(t.estrellas)}</div>
        <blockquote><p>${esc(t.texto)}</p></blockquote>
        <figcaption><cite>— ${esc(t.autor)}</cite></figcaption>
      </figure>`).join("");
  const slides = $$(".quote", track);
  dots.innerHTML = slides.map((_, i) => `<button type="button" aria-label="Ver opinión ${i + 1}"></button>`).join("");
  const dotBtns = $$("button", dots);
  const ir = (i) => track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: "smooth" });
  const marcar = () => {
    const i = Math.round(track.scrollLeft / (slides[0].offsetWidth + 18));
    dotBtns.forEach((b, j) => b.setAttribute("aria-current", j === Math.min(i, slides.length - 1)));
  };
  dotBtns.forEach((b, i) => b.addEventListener("click", () => ir(i)));
  track.addEventListener("scroll", () => requestAnimationFrame(marcar), { passive: true });
  marcar();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pausa = false;
  ["mouseenter", "focusin", "touchstart"].forEach((ev) => track.addEventListener(ev, () => (pausa = true), { passive: true }));
  ["mouseleave", "focusout"].forEach((ev) => track.addEventListener(ev, () => (pausa = false)));
  if (!reduce) setInterval(() => {
    if (pausa || document.hidden) return;
    const max = track.scrollWidth - track.clientWidth;
    if (max <= 4) return;
    track.scrollLeft >= max - 4 ? track.scrollTo({ left: 0, behavior: "smooth" }) : track.scrollBy({ left: slides[0].offsetWidth + 18, behavior: "smooth" });
  }, 5500);

  // ---------- FAQ ----------
  $("#faq-list").innerHTML = C.faq
    .map((f) => `<details class="reveal"><summary>${esc(f.pregunta)}</summary><div class="faq__body"><p>${esc(f.respuesta)}</p><a href="${wa(f.mensaje)}" target="_blank" rel="noopener">${waIcon} Escribinos por WhatsApp</a></div></details>`)
    .join("");

  // ---------- Header, menú y animaciones ----------
  const header = $("#header"), burger = $("#burger"), nav = $("#nav");
  const flotante = $(".reserva-float");
  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 40);
    flotante && flotante.classList.toggle("is-visible", window.scrollY > window.innerHeight * 0.7);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  const toggle = (open) => { burger.setAttribute("aria-expanded", open); burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú"); nav.classList.toggle("is-open", open); };
  burger.addEventListener("click", () => toggle(burger.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) toggle(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });

  const contar = (el) => {
    const fin = +el.dataset.count, pre = el.dataset.pre, suf = el.dataset.suf, t0 = performance.now(), dur = 1400;
    const paso = (t) => {
      const k = Math.min((t - t0) / dur, 1), v = Math.round(fin * (1 - Math.pow(1 - k, 3)));
      el.textContent = pre + v.toLocaleString("es-AR") + suf;
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-visible");
        const n = $("[data-count]", en.target); if (n) contar(n);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    $$(".reveal").forEach((el) => io.observe(el));
  } else {
    $$(".reveal").forEach((el) => el.classList.add("is-visible"));
  }

  // ---------- Datos estructurados (schema.org) ----------
  const dc = C.contacto.direccionCompleta;
  const nombresDia = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const schema = {
    "@context": "https://schema.org",
    "@type": C.seo.tipoSchema,
    name: C.negocio.nombre,
    alternateName: "GIM – Club Atlético Adrogué",
    url: C.seo.url,
    image: new URL(C.seo.ogImage, C.seo.url).href,
    logo: new URL("img/apple-touch-icon.png", C.seo.url).href,
    telephone: C.contacto.telefono,
    address: { "@type": "PostalAddress", streetAddress: dc.calle, addressLocality: dc.localidad, addressRegion: dc.provincia, postalCode: dc.cp, addressCountry: dc.pais },
    openingHoursSpecification: Object.entries(C.horarios).flatMap(([d, ts]) => ts.map(([a, b]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: nombresDia[d], opens: a, closes: b }))),
    sameAs: [C.contacto.instagram],
    founder: { "@type": "Person", name: C.negocio.fundador },
    amenityFeature: [{ "@type": "LocationFeatureSpecification", name: "Ambiente climatizado", value: true }],
  };
  const ld = document.createElement("script");
  ld.type = "application/ld+json";
  ld.textContent = JSON.stringify(schema);
  document.head.appendChild(ld);
})();
