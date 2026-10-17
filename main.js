(function () {
  "use strict";

  var B = window.__BRAND__ || {};
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fineHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var escHTML = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function safe(fn, name) { try { fn(); } catch (e) { if (window.console) console.warn("[" + name + "]", e); } }
  function mxn(n) { return n == null || !isFinite(n) ? "—" : Math.round(n).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }); }
  window.__CN__ = { mxn: mxn, escHTML: escHTML, safe: safe };

  /* ---------- Fichas de proyecto (de ejemplo) ---------- */
  var FICHAS = {
    "casa-los-viñedos": {
      cat: "Residencial", title: "Casa Los Viñedos",
      imgs: ["proy-res-1", "proy-res-2", "proy-res-3"],
      alts: ["Fachada de la casa con concreto aparente y madera", "Sala a doble altura con ventanal", "Cocina con isla y acabados en madera"],
      data: [["m² construidos", "286 m²"], ["Terreno", "300 m²"], ["Ciudad", "Torreón"], ["Año", "2025"], ["Duración", "9 meses"], ["Sistema", "Losa aligerada y muros de block"]],
      story: [["Reto", "Terreno con pendiente y una familia que necesitaba mudarse antes del ciclo escolar."], ["Solución", "Proyecto en dos niveles con calendario firmado y avance semanal por WhatsApp."], ["Resultado", "Entrega en la fecha pactada y sin cambios al precio del contrato."]]
    },
    "ampliacion-campestre": {
      cat: "Remodelación", title: "Ampliación Campestre La Rosita",
      imgs: ["proy-rem-1", "proy-rem-2", "proy-rem-3"],
      alts: ["Casa con segundo piso nuevo y terraza", "Recámara principal en la ampliación", "Baño nuevo con regadera de piso"],
      data: [["m² ampliados", "94 m²"], ["Niveles", "1 → 2"], ["Ciudad", "Torreón"], ["Año", "2024"], ["Duración", "16 semanas"], ["Alcance", "Recámara, baño y terraza"]],
      story: [["Reto", "Subir un segundo piso sobre una casa de los años noventa con la familia viviendo dentro."], ["Solución", "Revisión estructural previa, refuerzo de cimentación y trabajo por zonas para mantener la casa habitable."], ["Resultado", "Tres espacios nuevos y la planta baja intacta."]]
    },
    "plaza-independencia": {
      cat: "Comercial", title: "Locales Plaza Independencia",
      imgs: ["proy-com-1", "proy-com-2", "proy-com-3"],
      alts: ["Plaza comercial con locales y fachada de cristal", "Interior de oficina con acabados contemporáneos", "Local comercial terminado listo para apertura"],
      data: [["m² construidos", "420 m²"], ["Locales", "4 + 2 oficinas"], ["Ciudad", "Gómez Palacio"], ["Año", "2024"], ["Duración", "6 meses"], ["Sistema", "Estructura metálica y losacero"]],
      story: [["Reto", "Abrir los locales antes de temporada alta con licencias en regla."], ["Solución", "Gestoría de permisos en paralelo al proyecto y obra en dos frentes."], ["Resultado", "Apertura en fecha y facturación completa por etapa."]]
    }
  };

  /* ---------- Nav, drawer y progreso ---------- */
  function initNav() {
    var burger = $("[data-burger]"), drawer = $("[data-drawer]");
    if (burger && drawer) {
      burger.addEventListener("click", function () {
        var open = burger.getAttribute("aria-expanded") === "true";
        burger.setAttribute("aria-expanded", String(!open));
        drawer.hidden = open;
      });
      $$("a", drawer).forEach(function (a) { a.addEventListener("click", function () { burger.setAttribute("aria-expanded", "false"); drawer.hidden = true; }); });
    }
    var bar = $(".scroll-progress");
    var ticking = false;
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var h = document.documentElement.scrollHeight - innerHeight;
        if (bar) bar.style.setProperty("--p", h > 0 ? (scrollY / h).toFixed(4) : 0);
        ticking = false;
      });
    }
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  /* ---------- Enlaces de WhatsApp ---------- */
  function initWhatsApp() {
    if (!B.whatsapp) return;
    $$("[data-wa]").forEach(function (a) {
      a.href = "https://wa.me/" + B.whatsapp + "?text=" + encodeURIComponent(a.getAttribute("data-wa") || "Hola");
    });
  }

  /* ---------- Reveals (IO con umbral bajo + red de seguridad) ---------- */
  function initReveals() {
    var els = $$(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("is-in"); }); return; }
    document.documentElement.classList.add("js-anim");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { threshold: 0.05, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (e, i) { e.style.transitionDelay = ((i % 4) * 70) + "ms"; io.observe(e); });
    setTimeout(function () { els.forEach(function (e) { e.classList.add("is-in"); }); }, 6000);
  }

  /* ---------- Contadores ---------- */
  function initCounters() {
    var els = $$("[data-count]");
    function fmt(el, v) {
      var s = el.getAttribute("data-format") === "miles" ? Math.round(v).toLocaleString("es-MX") : String(Math.round(v));
      el.textContent = s + (el.getAttribute("data-suffix") || "");
    }
    function run(el) {
      var to = parseFloat(el.getAttribute("data-count")), t0 = performance.now(), dur = 1800;
      (function tick(t) {
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        fmt(el, to * e);
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    }
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { run(x.target); io.unobserve(x.target); } });
    }, { threshold: 0.05 });
    els.forEach(function (el) { fmt(el, 0); io.observe(el); });
    setTimeout(function () { els.forEach(function (el) { if (el.textContent.charAt(0) === "0") fmt(el, parseFloat(el.getAttribute("data-count"))); }); }, 7000);
  }

  /* ---------- Tilt y botones magnéticos ---------- */
  function initTilt() {
    if (!fineHover) return;
    $$("[data-tilt]").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = "perspective(900px) rotateY(" + (x * 6) + "deg) rotateX(" + (-y * 6) + "deg) translateY(var(--ty,0))";
      });
      card.addEventListener("pointerleave", function () { card.style.transform = ""; });
    });
  }
  function initMagnetic() {
    if (!fineHover) return;
    $$(".magnetic").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = "translate(" + ((e.clientX - r.left - r.width / 2) * .18) + "px," + ((e.clientY - r.top - r.height / 2) * .28) + "px)";
      });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }

  /* ---------- Filtros del portafolio ---------- */
  function initFilters() {
    var btns = $$("[data-filter]"), cards = $$("[data-works] [data-categoria]"), empty = $("[data-works-empty]");
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        var f = b.getAttribute("data-filter"), shown = 0;
        btns.forEach(function (x) { var on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", String(on)); });
        cards.forEach(function (c) {
          var show = f === "todas" || c.getAttribute("data-categoria") === f;
          c.classList.toggle("is-hidden", !show);
          if (show) { shown++; if (!reduced && c.animate) c.animate([{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: 520, easing: "cubic-bezier(.16,1,.3,1)" }); }
        });
        $("[data-works]").classList.toggle("is-filtered", f !== "todas");
        if (empty) empty.hidden = shown > 0;
      });
    });
  }

  /* ---------- Fichas (dialog con galería) ---------- */
  function initFichas() {
    var dlg = $("#ficha");
    if (!dlg || typeof dlg.showModal !== "function") return;
    var main = $("[data-ficha-main]", dlg), thumbs = $("[data-ficha-thumbs]", dlg);
    function show(f, i) {
      main.src = "assets/img/" + f.imgs[i] + ".webp"; main.alt = f.alts[i];
      $$("button", thumbs).forEach(function (t, k) { t.classList.toggle("is-on", k === i); });
    }
    $$("[data-ficha]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var f = FICHAS[btn.getAttribute("data-ficha")]; if (!f) return;
        $("[data-ficha-cat]", dlg).textContent = f.cat;
        $("[data-ficha-title]", dlg).textContent = f.title;
        $("[data-ficha-data]", dlg).innerHTML = f.data.map(function (d) { return "<div><dt>" + escHTML(d[0]) + "</dt><dd>" + escHTML(d[1]) + "</dd></div>"; }).join("");
        $("[data-ficha-story]", dlg).innerHTML = f.story.map(function (s) { return "<p><b>" + escHTML(s[0]) + "</b>" + escHTML(s[1]) + "</p>"; }).join("");
        thumbs.innerHTML = f.imgs.map(function (im, k) { return '<button type="button" aria-label="Ver imagen ' + (k + 1) + '"><img src="assets/img/' + im + '.webp" alt="" loading="lazy" width="400" height="300"></button>'; }).join("");
        $$("button", thumbs).forEach(function (t, k) { t.addEventListener("click", function () { show(f, k); }); });
        show(f, 0);
        dlg.showModal();
      });
    });
    $$("[data-close]", dlg).forEach(function (c) { c.addEventListener("click", function () { dlg.close(); }); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  }

  /* ---------- Antes / después ---------- */
  function initBeforeAfter() {
    $$("[data-ba]").forEach(function (box) {
      var r = $(".ba-range", box);
      function set(v) { box.style.setProperty("--pos", v + "%"); }
      r.addEventListener("input", function () { set(r.value); });
      set(r.value);
      if (!reduced && "IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (en) {
          if (!en[0].isIntersecting) return; io.disconnect();
          var t0 = performance.now();
          (function tick(t) {
            var p = Math.min(1, (t - t0) / 1600), v = 50 + Math.sin(p * Math.PI * 2) * 22 * (1 - p);
            if (document.activeElement !== r) { set(v); r.value = v; }
            if (p < 1) requestAnimationFrame(tick);
          })(t0);
        }, { threshold: 0.3 });
        io.observe(box);
      }
    });
  }

  /* ---------- Simulador de mensualidades ---------- */
  function initSimulador() {
    var f = $("#simulador"); if (!f) return;
    function fill(inp) { var p = (inp.value - inp.min) / (inp.max - inp.min) * 100; inp.style.setProperty("--fill", p + "%"); }
    function calc() {
      var monto = +f.elements.monto.value, eng = +f.elements.enganche.value, plazo = +f.elements.plazo.value, tasa = +f.elements.tasa.value;
      var P = monto * (1 - eng / 100), i = tasa / 100 / 12, n = plazo * 12;
      var m = i === 0 ? P / n : P * i / (1 - Math.pow(1 + i, -n));
      $('[data-sim-out="monto"]', f).textContent = mxn(monto);
      $('[data-sim-out="enganche"]', f).textContent = eng + "% · " + mxn(monto * eng / 100);
      $('[data-sim-out="plazo"]', f).textContent = plazo + " años";
      $('[data-sim-out="tasa"]', f).textContent = tasa.toFixed(2) + "%";
      $('[data-sim="mensualidad"]', f).textContent = mxn(m);
      $('[data-sim="financiado"]', f).textContent = mxn(P);
      $('[data-sim="intereses"]', f).textContent = mxn(m * n - P);
      $$('input[type="range"]', f).forEach(fill);
    }
    f.addEventListener("input", calc); f.addEventListener("submit", function (e) { e.preventDefault(); });
    calc();
  }

  /* ---------- Mapa de cobertura ---------- */
  function initCoverage() {
    var el = $("#mapa-cobertura"); if (!el || !window.L) return;
    var map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true }).setView([25.548, -103.39], 11);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, subdomains: "abcd", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>' }).addTo(map);
    var zona = [[25.62, -103.58], [25.64, -103.42], [25.60, -103.18], [25.50, -103.16], [25.46, -103.30], [25.47, -103.50], [25.52, -103.60]];
    L.polygon(zona, { color: "#F2B705", weight: 2, fillColor: "#F2B705", fillOpacity: .1, dashArray: "6 6" }).addTo(map).bindTooltip("Zona de servicio · visita técnica sin costo", { sticky: true });
    var pins = [["Torreón", 25.5428, -103.4068], ["Gómez Palacio", 25.5611, -103.4983], ["Lerdo", 25.5386, -103.5244], ["Matamoros", 25.5280, -103.2280]];
    pins.forEach(function (p, i) {
      L.marker([p[1], p[2]], { icon: L.divIcon({ className: "", html: '<div class="pin' + (i === 0 ? " pin-office" : "") + '"></div>', iconSize: [24, 24], iconAnchor: [12, 12] }) })
        .addTo(map).bindPopup("<b>" + p[0] + "</b><br>" + (i === 0 ? "Oficina (ubicación de ejemplo)" : "Visita técnica sin costo"));
    });
    map.on("click", function () { map.scrollWheelZoom.enable(); });
  }

  /* ---------- Formulario de contacto → lead.php ---------- */
  function initContacto() {
    var f = $("#contacto-form"); if (!f) return;
    var msg = $("[data-c-msg]", f);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var tel = f.elements.telefono.value.replace(/\D/g, ""), email = f.elements.email.value.trim();
      msg.classList.remove("is-ok");
      if (tel.length < 10 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Déjanos un WhatsApp de 10 dígitos o un email para poder responderte."; return; }
      if (!f.elements.consent.checked) { msg.textContent = "Necesitamos tu aceptación del aviso de privacidad para contactarte."; return; }
      msg.textContent = "Enviando…";
      fetch("lead.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        tipo: "contacto", nombre: f.elements.nombre.value, telefono: f.elements.telefono.value, email: email,
        ciudad: f.elements.ciudad.value, mensaje: "[" + f.elements.tipo_proyecto.value + "] " + f.elements.mensaje.value,
        consent: true, empresa_web: f.elements.empresa_web.value
      }) }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.ok) { msg.classList.add("is-ok"); msg.textContent = "✅ ¡Listo! Recibimos tu solicitud. Te contactamos el mismo día hábil."; f.reset(); }
        else throw new Error("lead");
      }).catch(function () {
        msg.textContent = "No pudimos enviar el formulario. Escríbenos por WhatsApp y te atendemos enseguida.";
      });
    });
  }

  /* ---------- Asistente Bruno ---------- */
  function initChat() {
    var root = $("[data-chat]"); if (!root) return;
    var panel = $("#chat-panel"), log = $("[data-chat-log]", root), form = $("[data-chat-form]", root), sugs = $("[data-chat-sugs]", root);
    var fab = $(".chat-fab", root);
    var history = [], busy = false;
    function toggle(open) {
      if (open == null) open = panel.hidden;
      panel.hidden = !open; root.classList.toggle("is-open", open);
      fab.setAttribute("aria-expanded", String(open));
      if (open) setTimeout(function () { form.elements.q.focus(); }, 60);
    }
    $$("[data-chat-toggle]", root).forEach(function (b) { b.addEventListener("click", function () { toggle(); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) toggle(false); });
    function add(cls, text) {
      var d = document.createElement("div"); d.className = "msg " + cls; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
    }
    function actions(d) {
      var wa = B.whatsapp ? "https://wa.me/" + B.whatsapp + "?text=" + encodeURIComponent("Hola, platiqué con Bruno en su web y quiero agendar una visita técnica.") : "#contacto";
      var a = document.createElement("div"); a.className = "msg-actions";
      a.innerHTML = '<a href="#cotizador">Cotizar mi obra</a><a href="#contacto">Visita técnica gratis</a><a class="wa" target="_blank" rel="noopener" href="' + escHTML(wa) + '">WhatsApp</a>';
      $$("a", a).forEach(function (x) { if (x.getAttribute("href").charAt(0) === "#") x.addEventListener("click", function () { if (innerWidth < 720) toggle(false); }); });
      d.appendChild(a); log.scrollTop = log.scrollHeight;
    }
    function ask(q) {
      q = (q || "").trim(); if (!q || busy) return;
      busy = true; sugs.hidden = true;
      add("msg-user", q);
      var t = document.createElement("div"); t.className = "msg msg-bot msg-typing"; t.innerHTML = "<i></i><i></i><i></i>"; log.appendChild(t); log.scrollTop = log.scrollHeight;
      fetch("asistente-ia.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: q, history: history.slice(-8) }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { return (d && d.reply) || ""; })
        .catch(function () { return ""; })
        .then(function (reply) {
          t.remove();
          var ok = !!reply;
          if (!ok) reply = "Ahora mismo no puedo responder. Déjanos tus datos en el formulario o escríbenos por WhatsApp y un arquitecto te atiende.";
          var d = add("msg-bot", reply);
          if (ok) { history.push({ role: "user", text: q }, { role: "model", text: reply }); }
          if (!ok || history.length === 2 || /visita|cotiz|whats|precio|costo|m²|m2|presupuesto|crédito|credito|infonavit/i.test(reply)) actions(d);
          busy = false;
        });
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); var q = form.elements.q.value; form.elements.q.value = ""; ask(q); });
    $$("button", sugs).forEach(function (b) { b.addEventListener("click", function () { ask(b.textContent); }); });
  }

  /* ---------- GSAP: hero, parallax, proceso horizontal ---------- */
  function initHero() {
    var lines = $$(".hero-title .line > span");
    if (reduced) return;
    gsap.set(lines, { yPercent: 110 });
    var tl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: .15 });
    tl.to(lines, { yPercent: 0, duration: 1.3, stagger: .12 })
      .fromTo(".hero-title em", { "--u": 0 }, { "--u": 1, duration: 1, ease: "power3.inOut" }, "-=.6")
      .from([".hero .eyebrow", ".hero-sub", ".hero-certs li", ".hero-ctas .btn"], { y: 24, opacity: 0, duration: 1, stagger: .07 }, "-=1")
      .from(".hero-stats .stat", { y: 30, opacity: 0, duration: 1, stagger: .08 }, "-=.8");
    var paths = $$(".bp-lines path");
    paths.forEach(function (p) { var L = p.getTotalLength ? p.getTotalLength() : 600; p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    tl.to(paths, { strokeDashoffset: 0, duration: 2.2, stagger: .12, ease: "power2.inOut" }, .4);
    // red de seguridad: si algo falla, todo visible
    setTimeout(function () { gsap.set(lines, { yPercent: 0 }); }, 4000);
  }
  function initParallax() {
    if (reduced) return;
    gsap.to("[data-parallax]", { yPercent: 10, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".hero-blueprint", { yPercent: -25, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    $$(".svc-img img, .work-img img").forEach(function (img) {
      gsap.fromTo(img, { yPercent: -4 }, { yPercent: 4, ease: "none", scrollTrigger: { trigger: img.parentNode, start: "top bottom", end: "bottom top", scrub: true } });
    });
  }
  function initProcess() {
    var sec = $(".process"), track = $("[data-process-track] .steps"), bar = $("[data-process-bar]");
    if (!sec || !track || reduced) return;
    var mm = gsap.matchMedia();
    mm.add("(min-width: 960px)", function () {
      sec.classList.add("is-horizontal");
      var steps = $$(".step", track);
      var dist = function () { return Math.max(0, track.scrollWidth - innerWidth * .7); };
      var tw = gsap.to(track, {
        x: function () { return -dist(); }, ease: "none",
        scrollTrigger: {
          trigger: sec, start: "top top", end: function () { return "+=" + dist(); }, pin: ".process-pin", scrub: .6, invalidateOnRefresh: true,
          onUpdate: function (self) {
            if (bar) bar.style.transform = "scaleX(" + self.progress + ")";
            var idx = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
            steps.forEach(function (s, i) { s.classList.toggle("is-active", i <= idx); });
          }
        }
      });
      return function () { sec.classList.remove("is-horizontal"); tw.scrollTrigger && tw.scrollTrigger.kill(); gsap.set(track, { clearProps: "x" }); };
    });
  }

  function boot() {
    safe(initNav, "nav");
    safe(initWhatsApp, "whatsapp");
    safe(initReveals, "reveals");
    safe(initCounters, "counters");
    safe(initTilt, "tilt");
    safe(initMagnetic, "magnetic");
    safe(initFilters, "filters");
    safe(initFichas, "fichas");
    safe(initBeforeAfter, "beforeAfter");
    safe(initSimulador, "simulador");
    safe(initCoverage, "coverage");
    safe(initContacto, "contacto");
    safe(initChat, "chat");
    if (window.gsap && window.ScrollTrigger) {
      try { gsap.registerPlugin(ScrollTrigger); } catch (_) {}
      safe(initHero, "hero");
      safe(initParallax, "parallax");
      safe(initProcess, "process");
      addEventListener("load", function () { ScrollTrigger.refresh(); });
    }
    document.documentElement.classList.add("is-ready");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
