/* cotizador.js — cotizador de obra en 5 pasos:
 * 1) plano/croquis → lector-documento.php (IA) prellena medidas (lo que no viene escrito queda vacío)
 * 2) dirección (geocode.php) + contorno del terreno dibujado sobre el mapa → m² de terreno
 * 3) tipo de obra, acabado, planos, forma de pago
 * 4) contacto → lead.php (se guarda la solicitud con todo el cálculo)
 * 5) cotización orientativa + WhatsApp con el resumen
 * Tarifas en window.__BRAND__.tarifas (lib/manifest.js). Todo es estimación orientativa sin IVA.
 */
(function () {
  "use strict";

  var B = window.__BRAND__ || {};
  var T = B.tarifas || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function num(v) { var n = parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(n) && n >= 0 ? n : null; }
  function mxn(n) { return n == null || !isFinite(n) ? "—" : Math.round(n).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }); }
  function redondeo(n) { return Math.round(n / 5000) * 5000; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function safe(fn, n) { try { fn(); } catch (e) { if (window.console) console.warn("[cotizador " + n + "]", e); } }

  var NOMBRES = {
    casa_habitacion: "Casa nueva", ampliacion: "Ampliación", remodelacion: "Remodelación",
    local_comercial: "Local comercial", oficinas: "Oficinas",
    economico: "Económico", medio: "Medio", residencial: "Residencial", premium: "Premium",
    contado: "Recursos propios", infonavit: "Crédito Infonavit", fovissste: "Crédito Fovissste", bancario: "Crédito bancario", no_se: "Aún no lo sé"
  };

  var form, step = 1, origenDatos = "manual", ubicacion = {}, poligono = [], areaDibujada = null, ultimo = null;

  /* ---------- Cálculo ---------- */
  function cotizar(d) {
    var m2 = num(d.m2);
    if (!m2 || m2 < 10) return null;
    var porM2 = T.porM2 || { medio: [10500, 14500] };
    var rango = porM2[d.acabado] || porM2.medio;
    var fTipo = (T.factorTipo || {})[d.tipoProyecto] || 1;
    var niveles = Math.min(3, Math.max(1, parseInt(d.niveles, 10) || 1));
    var fNiv = (T.factorNiveles || {})[niveles] || 1;
    var base = [m2 * rango[0] * fTipo * fNiv, m2 * rango[1] * fTipo * fNiv];
    var proyPct = d.tienePlanos === "no" ? (T.proyectoEjecutivoPct || 0.06) : 0;
    var min = base[0] * (1 + proyPct), max = base[1] * (1 + proyPct);
    var mid = (base[0] + base[1]) / 2;
    var pctNegra = T.obraNegraPct || 0.55;
    var ritmo = (T.m2PorSemana || {})[d.tipoProyecto] || 6;
    var semObra = Math.max(4, Math.ceil(m2 / ritmo));
    var perm = ((T.semanasPermisos || {})[d.tipoProyecto] || [4, 10]).slice();
    if (d.tienePlanos === "no") { perm[0] += 3; perm[1] += 6; }
    var r = {
      estimadoMin: redondeo(min), estimadoMax: redondeo(max),
      obraNegra: redondeo(mid * pctNegra), acabados: redondeo(mid * (1 - pctNegra)),
      proyecto: proyPct ? redondeo(mid * proyPct) : 0,
      semanas: semObra, semanasPermisos: perm, m2: m2, niveles: niveles,
      porM2: rango
    };
    // Mensualidad aproximada
    var cr = T.credito || {};
    var key = cr[d.financiamiento] ? d.financiamiento : "bancario";
    var c = cr[key];
    if (c) {
      var P = ((r.estimadoMin + r.estimadoMax) / 2) * (1 - c.enganche / 100), i = c.tasa / 100 / 12, n = c.plazo * 12;
      r.credito = { clave: key, nombre: c.nombre, tasa: c.tasa, plazo: c.plazo, enganche: c.enganche, financiado: Math.round(P), mensualidad: Math.round(P * i / (1 - Math.pow(1 + i, -n))), referencia: !cr[d.financiamiento] };
    }
    return r;
  }

  function datos() {
    var d = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === "file") return;
      if ((el.type === "radio" || el.type === "checkbox") && !el.checked) return;
      d[el.name] = el.value;
    });
    return d;
  }

  /* ---------- Pasos ---------- */
  function goto(n) {
    step = n;
    $$("[data-qstep]", form).forEach(function (s) { s.classList.toggle("is-on", +s.getAttribute("data-qstep") === n); });
    $$("[data-qstep-ind]").forEach(function (li) {
      var k = +li.getAttribute("data-qstep-ind");
      li.classList.toggle("is-on", k === n); li.classList.toggle("is-done", k < n);
    });
    if (n === 2) setTimeout(initMapa, 30);
    if (n === 3) { var m = form.elements.m2Confirm; if (!m.value && form.elements.m2.value) m.value = form.elements.m2.value; }
    var top = $("#cotizador").getBoundingClientRect().top + scrollY - 70;
    if (Math.abs(scrollY - top) > 200) scrollTo({ top: top, behavior: "smooth" });
  }
  function validar(n) {
    if (n === 3) {
      var err = $("[data-q-error]", form), m2 = num(form.elements.m2Confirm.value);
      if (!m2 || m2 < 10) { err.textContent = "Escribe los m² de construcción aproximados (mínimo 10) para poder calcular."; form.elements.m2Confirm.focus(); return false; }
      form.elements.m2.value = m2; err.textContent = "";
    }
    return true;
  }

  /* ---------- 1. Lector de plano / croquis ---------- */
  var MSG_FAIL = {
    sin_clave: "El lector automático se está configurando. Escribe las medidas a mano y seguimos.",
    tipo: "Ese archivo no es una imagen ni un PDF. Sube una foto (JPG, PNG, HEIC) o un PDF.",
    tamano: "El archivo pesa más de 10 MB. Prueba con una foto más ligera.",
    rate_min: "Vas muy rápido 🙂 Espera un minuto y vuelve a intentarlo.",
    rate_day: "Ya leímos varios documentos hoy desde tu conexión. Escribe las medidas a mano.",
    rate_global: "El lector está muy solicitado hoy. Escribe las medidas a mano y seguimos.",
    no_obra: "No parece un plano ni un croquis. Si lo es, escribe las medidas a mano.",
    ia: "No pudimos leer el documento. Escribe las medidas a mano y seguimos."
  };
  var CAMPOS = [["m2Terreno", "superficie_terreno_m2"], ["m2", "superficie_construccion_m2"], ["niveles", "niveles"], ["recamaras", "recamaras"], ["banos", "banos"]];

  function initLector() {
    var input = $("[data-file]", form), drop = $("[data-drop]", form);
    var scan = $("[data-scan]", form), img = $("[data-scan-img]", form), pdf = $("[data-scan-pdf]", form), msg = $("[data-scan-msg]", form), ext = $("[data-extract]", form);
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove("is-over"); }); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); if (e.dataTransfer.files[0]) { leer(e.dataTransfer.files[0]); } });
    input.addEventListener("change", function () { if (input.files[0]) leer(input.files[0]); });

    function leer(file) {
      scan.hidden = false; scan.classList.remove("is-done"); ext.hidden = true;
      var esPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
      var preview = !esPdf && /image\/(jpeg|png|webp|gif)/.test(file.type);
      pdf.hidden = preview; pdf.textContent = esPdf ? "PDF" : "IMG";
      if (preview) { img.src = URL.createObjectURL(file); img.hidden = false; } else { img.hidden = true; }
      if (file.size > 10 * 1024 * 1024) { fin(false, MSG_FAIL.tamano); return; }
      msg.textContent = "Leyendo las medidas escritas en tu documento…";
      $$(".fld", form).forEach(function (f) { f.classList.remove("is-ai", "is-missing"); });
      var fd = new FormData(); fd.append("documento", file, file.name);
      fetch("lector-documento.php", { method: "POST", body: fd })
        .then(function (r) { return r.json(); })
        .then(function (resp) {
          if (!resp || !resp.ok) { fin(false, MSG_FAIL[(resp && resp.reason)] || MSG_FAIL.ia); return; }
          var d = resp.data || {};
          if (d.es_documento_de_obra === false) { fin(false, MSG_FAIL.no_obra); return; }
          var leidos = 0;
          CAMPOS.forEach(function (c) {
            var el = form.elements[c[0]], fld = el.closest(".fld"), v = d[c[1]];
            if (v != null && v !== "") { el.value = v; fld.classList.add("is-ai"); leidos++; }
            else { el.value = ""; fld.classList.add("is-missing"); }
          });
          if (d.tipo_proyecto && form.querySelector('input[name="tipoProyecto"][value="' + d.tipo_proyecto + '"]')) form.querySelector('input[name="tipoProyecto"][value="' + d.tipo_proyecto + '"]').checked = true;
          if (d.tipo_documento === "plano") form.elements.tienePlanos.value = "si";
          origenDatos = d.tipo_documento === "plano" ? "plano_ia" : (d.tipo_documento === "croquis" ? "croquis_ia" : "documento_ia");
          var extra = d.espacios_detectados && d.espacios_detectados.length ? " Espacios rotulados: " + d.espacios_detectados.slice(0, 8).join(", ") + "." : "";
          fin(true, (leidos ? "✅ Listo: leímos " + leidos + " de 5 datos." : "Leímos el documento, pero no encontramos medidas escritas.") + extra + (d.observaciones ? " Nota: " + d.observaciones : ""));
          ext.hidden = false;
        })
        .catch(function () { fin(false, MSG_FAIL.ia); });
    }
    function fin(ok, text) { scan.classList.add("is-done"); msg.textContent = text; if (!ok) { ext.hidden = true; } }
  }

  /* ---------- 2. Dirección + contorno del terreno ---------- */
  var map, capaCalles, capaSat, enSat = false, vertices = [], poly, marcadorDir;
  function areaM2(latlngs) {
    if (latlngs.length < 3) return 0;
    var R = 6378137, lat0 = latlngs.reduce(function (a, p) { return a + p.lat; }, 0) / latlngs.length * Math.PI / 180;
    var pts = latlngs.map(function (p) { return [R * p.lng * Math.PI / 180 * Math.cos(lat0), R * p.lat * Math.PI / 180]; });
    var s = 0;
    for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(s / 2);
  }
  function redibujar() {
    var lls = vertices.map(function (m) { return m.getLatLng(); });
    if (poly) poly.setLatLngs(lls); else poly = L.polygon(lls, { color: "#F2B705", weight: 3, fillColor: "#F2B705", fillOpacity: .22 }).addTo(map);
    areaDibujada = lls.length >= 3 ? Math.round(areaM2(lls) * 10) / 10 : null;
    poligono = lls.map(function (p) { return [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6]; });
    $("[data-draw-area]", form).textContent = areaDibujada ? areaDibujada.toLocaleString("es-MX") + " m²" : (lls.length ? lls.length + " punto(s)…" : "—");
    $("[data-draw-use]", form).disabled = !areaDibujada;
  }
  function initMapa() {
    if (map || !window.L) return;
    var el = $("[data-draw-map]", form); if (!el) return;
    map = L.map(el, { zoomControl: true }).setView([25.5428, -103.4068], 13);
    capaCalles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    capaSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imágenes &copy; Esri" });
    map.on("click", function (e) {
      var m = L.marker(e.latlng, { draggable: true, icon: L.divIcon({ className: "", html: '<div class="vtx"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }) }).addTo(map);
      m.on("drag", redibujar);
      vertices.push(m); redibujar();
    });
    $("[data-draw-undo]", form).addEventListener("click", function () { var m = vertices.pop(); if (m) map.removeLayer(m); redibujar(); });
    $("[data-draw-clear]", form).addEventListener("click", function () { vertices.forEach(function (m) { map.removeLayer(m); }); vertices = []; redibujar(); });
    var btnCapa = $("[data-draw-layer]", form);
    btnCapa.addEventListener("click", function () { setSat(!enSat); });
    function setSat(on) {
      enSat = on;
      if (on) { map.removeLayer(capaCalles); capaSat.addTo(map); btnCapa.textContent = "Ver calles"; }
      else { map.removeLayer(capaSat); capaCalles.addTo(map); btnCapa.textContent = "Ver satélite"; }
    }
    map._setSat = setSat;
    $("[data-draw-use]", form).addEventListener("click", function () {
      if (!areaDibujada) return;
      var el2 = form.elements.m2Terreno; el2.value = areaDibujada;
      var fld = el2.closest(".fld"); fld.classList.remove("is-missing", "is-ai");
      this.textContent = "✓ " + areaDibujada.toLocaleString("es-MX") + " m² de terreno guardados";
    });
    if (ubicacion.lat) irA(ubicacion.lat, ubicacion.lon);
  }
  function irA(lat, lon) {
    if (!map) return;
    map.setView([lat, lon], 19);
    if (marcadorDir) map.removeLayer(marcadorDir);
    marcadorDir = L.circleMarker([lat, lon], { radius: 6, color: "#fff", weight: 2, fillColor: "#2D4759", fillOpacity: 1 }).addTo(map);
    if (map._setSat) map._setSat(true);
  }
  function initDireccion() {
    var inp = $("[data-addr]", form), list = $("[data-addr-list]", form), timer, items = [], sel = -1;
    function cerrar() { list.hidden = true; list.innerHTML = ""; items = []; sel = -1; inp.setAttribute("aria-expanded", "false"); }
    function elegir(it) {
      inp.value = it.label; cerrar();
      ubicacion = { label: it.label, lat: it.lat, lon: it.lon };
      irA(it.lat, it.lon);
    }
    inp.addEventListener("input", function () {
      clearTimeout(timer);
      ubicacion = { label: inp.value };
      var q = inp.value.trim(); if (q.length < 4) { cerrar(); return; }
      timer = setTimeout(function () {
        fetch("geocode.php?q=" + encodeURIComponent(q + (/torre[oó]n|g[oó]mez|lerdo|matamoros|coahuila|durango/i.test(q) ? "" : ", Torreón, Coahuila")))
          .then(function (r) { return r.json(); })
          .then(function (d) {
            items = (d && d.results) || [];
            if (!items.length) { cerrar(); return; }
            list.innerHTML = items.map(function (it, i) { return '<li role="option" id="addr-' + i + '" data-i="' + i + '">' + esc(it.label) + "</li>"; }).join("");
            list.hidden = false; inp.setAttribute("aria-expanded", "true");
            $$("li", list).forEach(function (li) { li.addEventListener("mousedown", function (e) { e.preventDefault(); elegir(items[+li.getAttribute("data-i")]); }); });
          }).catch(cerrar);
      }, 420);
    });
    inp.addEventListener("keydown", function (e) {
      if (list.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        $$("li", list).forEach(function (li, i) { li.setAttribute("aria-selected", String(i === sel)); });
      } else if (e.key === "Enter" && sel >= 0) { e.preventDefault(); elegir(items[sel]); }
      else if (e.key === "Escape") cerrar();
    });
    inp.addEventListener("blur", function () { setTimeout(cerrar, 150); });
  }

  /* ---------- 3. Etiquetas de precio por acabado ---------- */
  function initTiers() {
    var p = T.porM2 || {};
    $$("[data-tier]", form).forEach(function (el) {
      var r = p[el.getAttribute("data-tier")];
      if (r) el.textContent = "$" + (r[0] / 1000).toFixed(1) + "k – $" + (r[1] / 1000).toFixed(1) + "k / m²";
    });
    var m2 = form.elements.m2, m2c = form.elements.m2Confirm;
    m2.addEventListener("input", function () { m2c.value = m2.value; });
    m2c.addEventListener("input", function () { m2.value = m2c.value; });
  }

  /* ---------- 4 y 5. Contacto, guardado y resultado ---------- */
  function animarNumero(el, to) {
    var t0 = performance.now(), dur = 1300;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = mxn(to); return; }
    (function tick(t) { var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4); el.textContent = mxn(to * e); if (p < 1) requestAnimationFrame(tick); })(t0);
  }
  function resumenWA(d, r) {
    var lineas = [
      "Hola, hice mi cotización en la web de " + (B.short || "la constructora") + ":",
      "• Obra: " + (NOMBRES[d.tipoProyecto] || d.tipoProyecto) + ", acabado " + (NOMBRES[d.acabado] || d.acabado),
      "• Construcción: " + r.m2 + " m² en " + r.niveles + " nivel(es)" + (d.m2Terreno ? " · terreno " + d.m2Terreno + " m²" : ""),
      (d.recamaras || d.banos) ? "• " + (d.recamaras ? d.recamaras + " recámaras" : "") + (d.recamaras && d.banos ? " · " : "") + (d.banos ? d.banos + " baños" : "") : "",
      ubicacion.label ? "• Ubicación: " + ubicacion.label : "",
      "• Estimado: " + mxn(r.estimadoMin) + " – " + mxn(r.estimadoMax) + " (sin IVA)",
      "• Obra: ~" + r.semanas + " semanas · proyecto y permisos: " + r.semanasPermisos[0] + "–" + r.semanasPermisos[1] + " semanas",
      "• Pago: " + (NOMBRES[d.financiamiento] || d.financiamiento) + (r.credito && !r.credito.referencia ? " (mensualidad aprox. " + mxn(r.credito.mensualidad) + ")" : ""),
      "Me gustaría agendar la visita técnica. Mi nombre es " + (d.nombre || "—") + "."
    ];
    return lineas.filter(Boolean).join("\n");
  }
  function mostrar(d, r) {
    var res = $('[data-qstep="5"]', form);
    var set = function (k, v) { var el = $('[data-out="' + k + '"]', res); if (el) el.textContent = v; };
    animarNumero($('[data-out="min"]', res), r.estimadoMin);
    animarNumero($('[data-out="max"]', res), r.estimadoMax);
    set("contexto", (NOMBRES[d.tipoProyecto] || "") + " · " + r.m2 + " m² · " + r.niveles + " nivel(es) · acabado " + (NOMBRES[d.acabado] || "") + " (" + mxn(r.porM2[0]) + "–" + mxn(r.porM2[1]) + " por m²)" + (ubicacion.label ? " · " + ubicacion.label : ""));
    set("obraNegra", mxn(r.obraNegra)); set("acabados", mxn(r.acabados)); set("proyecto", mxn(r.proyecto));
    $("[data-proy-row]", res).hidden = !r.proyecto;
    set("semanas", "≈ " + r.semanas + " semanas");
    set("permisos", r.semanasPermisos[0] + "–" + r.semanasPermisos[1] + " semanas");
    if (r.credito) {
      set("creditoNombre", (r.credito.referencia ? "Si lo hicieras con crédito bancario" : "Mensualidad aprox. · " + r.credito.nombre));
      set("mensualidad", mxn(r.credito.mensualidad) + " /mes");
      set("creditoSupuestos", "Supuestos: " + r.credito.enganche + "% de enganche, " + r.credito.plazo + " años, tasa " + r.credito.tasa + "% anual. Financiado " + mxn(r.credito.financiado) + ".");
    }
    var total = r.obraNegra + r.acabados + r.proyecto || 1;
    requestAnimationFrame(function () {
      $('[data-bar="negra"]', res).style.width = (r.obraNegra / total * 100) + "%";
      $('[data-bar="acab"]', res).style.width = (r.acabados / total * 100) + "%";
      $('[data-bar="proy"]', res).style.width = (r.proyecto / total * 100) + "%";
    });
    var wa = $("[data-q-wa]", form);
    if (B.whatsapp) wa.href = "https://wa.me/" + B.whatsapp + "?text=" + encodeURIComponent(resumenWA(d, r));
  }
  function initEnvio() {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (step !== 4) return;
      var err = $("[data-q-error4]", form), d = datos();
      var tel = (d.telefono || "").replace(/\D/g, ""), emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((d.email || "").trim());
      if (tel.length < 10 && !emailOk) { err.textContent = "Escribe tu WhatsApp (10 dígitos) o un email válido para mostrarte la cotización."; return; }
      if (!form.elements.consent.checked) { err.textContent = "Necesitamos tu aceptación del aviso de privacidad."; return; }
      var r = cotizar(d);
      if (!r) { err.textContent = "Faltan los m² de construcción. Regresa al paso 3."; return; }
      err.textContent = "";
      ultimo = { d: d, r: r };
      var btn = $("[data-submit]", form); btn.disabled = true; btn.textContent = "Calculando…";
      var saved = $("[data-saved]", form);
      var payload = {
        tipo: "cotizacion", nombre: d.nombre, telefono: d.telefono, email: d.email, consent: true, empresa_web: d.empresa_web,
        ubicacion: { label: ubicacion.label || d.direccion || "", lat: ubicacion.lat, lon: ubicacion.lon },
        calc: {
          tipoProyecto: d.tipoProyecto, acabado: d.acabado, m2: r.m2, m2Terreno: num(d.m2Terreno), niveles: r.niveles,
          recamaras: num(d.recamaras), banos: num(d.banos), tienePlanos: d.tienePlanos, financiamiento: d.financiamiento,
          estimadoMin: r.estimadoMin, estimadoMax: r.estimadoMax, obraNegra: r.obraNegra, acabados: r.acabados, proyecto: r.proyecto,
          semanas: r.semanas, semanasPermisos: r.semanasPermisos.join("-"),
          mensualidad: r.credito ? r.credito.mensualidad : null, creditoSupuestos: r.credito ? (r.credito.nombre + " " + r.credito.tasa + "% " + r.credito.plazo + "a eng " + r.credito.enganche + "%") : "",
          areaDibujadaM2: areaDibujada, poligono: poligono, origenDatos: origenDatos
        }
      };
      fetch("lead.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (x) { return x.json(); })
        .then(function (resp) { saved.textContent = resp && resp.ok ? "✅ Guardamos tu solicitud. Un arquitecto te contactará para agendar la visita técnica sin costo." : "No pudimos guardar tu solicitud. Envíanos el resumen por WhatsApp y te atendemos."; })
        .catch(function () { saved.textContent = "No pudimos guardar tu solicitud. Envíanos el resumen por WhatsApp y te atendemos."; })
        .then(function () { btn.disabled = false; btn.textContent = "Mostrar mi cotización"; mostrar(d, r); goto(5); });
    });
    $("[data-restart]", form).addEventListener("click", function () { goto(1); });
  }

  function init() {
    form = $("#cotizador-form"); if (!form) return;
    $$("[data-next]", form).forEach(function (b) { b.addEventListener("click", function () { if (validar(step)) goto(step + 1); }); });
    $$("[data-prev]", form).forEach(function (b) { b.addEventListener("click", function () { goto(step - 1); }); });
    form.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.tagName === "INPUT" && step < 4 && !e.target.hasAttribute("data-addr")) { e.preventDefault(); if (validar(step)) goto(step + 1); }
    });
    safe(initLector, "lector");
    safe(initDireccion, "direccion");
    safe(initTiers, "tiers");
    safe(initEnvio, "envio");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
