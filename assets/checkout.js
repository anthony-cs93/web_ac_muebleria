// ============================================================
// Página de pago (checkout.html): datos, entrega por distrito, forma de pago y creación del pedido.
// El carrito vive en localStorage (el mismo de la tienda); los precios finales los vuelve a calcular el servidor.
// ============================================================
(function () {
  const A = window.ACCatalog;
  const $ = (id) => document.getElementById(id);
  const shop = document.body.dataset.shop === "maderin" ? "maderin" : "cdm";
  const CFG = {
    cdm: { name: "Corazón de Madera", logo: "public/cdm/logo.png", home: "cdm.html", favicon: "public/favicon/cdm-32.png" },
    maderin: { name: "Maderin", logo: "public/maderin/logo-maderin.png", home: "maderin.html", favicon: "public/favicon/maderin-32.png" }
  }[shop];
  const CART_KEY = `${shop}Cart`;
  const FIELDS_KEY = `${shop}CartFields`;
  const LAST_KEY = `${shop}LastOrder`;
  const STORE = { address: "Ca. Argentina #201 - Comas", map: "https://maps.app.goo.gl/jKDX4kuzcDRxq7tb6", coords: [-11.960141, -77.058542] };
  const WHATSAPP = "51943613883";
  let CARD_RATE = 3.5; // % de recargo con tarjeta (lo configura el admin)
  const MAX_QTY = 10;
  const money = (n) => Math.round(n * 100) / 100;
  const soles = (n) => A.formatPEN(n);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const radio = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;

  $("coLogo").src = CFG.logo;
  $("coLogo").alt = CFG.name;
  $("coBrand").href = $("coBack").href = $("coEmptyLink").href = CFG.home;
  $("coFavicon").href = CFG.favicon;
  document.title = `Finalizar compra | ${CFG.name}`;
  $("coPickupAddr").textContent = STORE.address;
  $("coPickupText").textContent = STORE.address;
  $("coDistrictWa").href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola ${CFG.name}, quiero hacer un pedido pero no veo mi distrito en la lista de envíos. ¿Pueden enviar a mi zona?`)}`;

  let products = [];
  let lines = []; // { p, color, text, qty }
  let districts = [];
  let coupon = null; // { code, label, amount }
  const touched = new Set();

  // ------------------------------------------------------------ Carrito
  function readCart() {
    let raw = [];
    try { raw = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { raw = []; }
    return (Array.isArray(raw) ? raw : []).map((l) => {
      const p = products.find((x) => x.id === l.id);
      if (!p || p.hidden || p.price == null || A.stockInfo(p).state === "out") return null;
      const qty = Math.min(MAX_QTY, Math.max(1, Math.round(Number(l.qty)) || 1));
      return { p, color: typeof l.color === "string" ? l.color : "", text: p.custom && typeof l.text === "string" ? l.text : "", qty };
    }).filter(Boolean);
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(lines.map((l) => ({ id: l.p.id, color: l.color, qty: l.qty, text: l.text })))); } catch (e) { /* ignorar */ }
  }
  const cartSig = () => JSON.stringify(lines.map((l) => [l.p.id, l.color, l.text, l.qty]));

  // ------------------------------------------------------------ Totales
  const subtotalOf = () => money(lines.reduce((n, l) => n + l.p.price * l.qty, 0));
  const regularTotal = () => money(lines.reduce((n, l) => n + (l.p.oldPrice && l.p.oldPrice > l.p.price ? l.p.oldPrice : l.p.price) * l.qty, 0));
  const productSavings = () => money(lines.reduce((n, l) => n + (l.p.oldPrice && l.p.oldPrice > l.p.price ? (l.p.oldPrice - l.p.price) * l.qty : 0), 0));
  function shippingOf() {
    if (radio("coDelivery") !== "delivery") return 0;
    const d = districts.find((x) => x.district === $("coDistrict").value);
    return d ? d.cost : 0;
  }
  function totals() {
    const subtotal = subtotalOf();
    const discount = coupon ? Math.min(coupon.amount, subtotal) : 0;
    const shipping = shippingOf();
    const fee = radio("coMethod") === "card" ? money((subtotal - discount + shipping) * CARD_RATE / 100) : 0;
    return { subtotal, discount, shipping, fee, total: money(subtotal - discount + shipping + fee) };
  }

  // Plazo estimado: por producto («4 a 6 días hábiles»); con varios productos se suman
  function parseDays(text) {
    if (typeof text !== "string") return null;
    const m = /(\d+)\s*(?:a|-|–|al)\s*(\d+)/i.exec(text) || /(\d+)/.exec(text);
    if (!m) return null;
    const k = /semana/i.test(text) ? 5 : 1;
    const a = Number(m[1]) * k, b = Number(m[2] || m[1]) * k;
    return { min: Math.min(a, b), max: Math.max(a, b), business: /h[aá]bil/i.test(text) || k === 5 };
  }
  function eta() {
    let min = 0, max = 0, found = 0, business = true;
    for (const id of new Set(lines.map((l) => l.p.id))) {
      const d = parseDays(lines.find((l) => l.p.id === id).p.deliveryTime);
      if (!d) continue;
      min += d.min; max += d.max; found++; business = business && d.business;
    }
    if (!found) return null;
    const unit = business ? "días hábiles" : "días";
    return min === max ? `${max} ${unit}` : `${min} a ${max} ${unit}`;
  }

  // ------------------------------------------------------------ Validación de campos
  const digits = (s) => String(s).replace(/\D/g, "");
  const phoneDigits = () => { let d = digits($("coPhone").value); if (d.length === 11 && d.startsWith("51")) d = d.slice(2); return d; };
  const RULES = {
    coName: () => ($("coName").value.trim().replace(/\s+/g, " ").length >= 3 ? "" : "Escribe tu nombre y apellido."),
    coPhone: () => (/^9\d{8}$/.test(phoneDigits()) ? "" : "Escribe tu celular de 9 dígitos (empieza con 9)."),
    coEmail: () => (!$("coEmail").value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("coEmail").value.trim()) ? "" : "Revisa tu email (ej. maria@correo.com)."),
    coDni: () => (!$("coBoleta").checked || /^\d{8}$/.test($("coDni").value) ? "" : "Para la boleta escribe tu DNI de 8 dígitos."),
    coAddress: () => (radio("coDelivery") !== "delivery" || $("coAddress").value.trim().length >= 5 ? "" : "Escribe la dirección donde entregamos (calle, número, dpto.)."),
    coDistrict: () => (radio("coDelivery") !== "delivery" || $("coDistrict").value ? "" : "Elige tu distrito para calcular el envío.")
  };
  const MSG = { coMethod: () => (radio("coMethod") ? "" : "Elige cómo quieres pagar.") };

  function paint(id) {
    const el = $(id);
    const msg = RULES[id] ? RULES[id]() : "";
    const shown = touched.has(id);
    const isEmptyOptional = (id === "coEmail" && !el.value.trim());
    el.classList.toggle("is-invalid", shown && !!msg);
    el.classList.toggle("is-valid", shown && !msg && !isEmptyOptional && !!String(el.value).trim());
    el.setAttribute("aria-invalid", shown && msg ? "true" : "false");
    $(`${id}Err`).textContent = shown ? msg : "";
    return msg;
  }
  const FIELD_IDS = Object.keys(RULES);
  const paintAll = () => FIELD_IDS.forEach(paint);

  function stepDone() {
    const delivery = radio("coDelivery") === "delivery";
    return [
      !RULES.coName() && !RULES.coPhone() && !RULES.coEmail() && !RULES.coDni(),
      !delivery || (!RULES.coAddress() && !RULES.coDistrict()),
      !!radio("coMethod")
    ];
  }
  function paintSteps() {
    stepDone().forEach((done, i) => {
      const n = i + 1;
      $(`coStep${n}`).textContent = done ? "✓" : String(n);
      $(`coStep${n}`).classList.toggle("is-done", done);
      $(`coCard${n}`).classList.toggle("is-done", done);
      $(`coDone${n}`).hidden = !done;
    });
  }

  // ------------------------------------------------------------ Render
  function render() {
    $("coItems").innerHTML = lines.map((l, i) => {
      const photo = A.hasPhoto(l.p) ? `<img src="${esc(A.photoUrl(l.p, 480, shop))}" alt="">` : l.p.svg;
      const extra = [l.color && esc(l.color), l.text && `${esc(l.p.custom ? l.p.custom.label : "Personalización")}: “${esc(l.text)}”`].filter(Boolean).join(" · ");
      return `<li data-i="${i}">
        <span class="co-thumb">${photo}</span>
        <span class="co-item-info"><b>${esc(l.p.name)}</b>${extra ? `<small>${extra}</small>` : ""}
          <span class="co-qty" role="group" aria-label="Cantidad de ${esc(l.p.name)}">
            <button type="button" data-act="minus" aria-label="Disminuir cantidad"${l.qty <= 1 ? " disabled" : ""}>−</button>
            <span aria-live="polite">${l.qty}</span>
            <button type="button" data-act="plus" aria-label="Aumentar cantidad"${l.qty >= MAX_QTY ? " disabled" : ""}>+</button>
            <button type="button" class="co-remove" data-act="remove" aria-label="Quitar ${esc(l.p.name)}">Quitar</button>
          </span></span>
        <span class="co-item-price">${l.p.oldPrice && l.p.oldPrice > l.p.price ? `<s class="co-old" aria-label="Precio regular">${soles(l.p.oldPrice * l.qty)}</s>` : ""}<span>${soles(l.p.price * l.qty)}</span></span></li>`;
    }).join("");
    const t = totals();
    const savings = productSavings();
    $("coSubtotal").textContent = soles(t.subtotal);
    $("coProdDiscRow").hidden = savings <= 0;
    $("coProdDisc").textContent = `− ${soles(savings)}`;
    $("coRegularRow").hidden = savings <= 0;
    $("coRegular").textContent = soles(regularTotal());
    $("coCouponRow").hidden = !coupon;
    if (coupon) { $("coCouponLabel").textContent = `Cupón ${coupon.code}`; $("coCouponAmt").textContent = `− ${soles(t.discount)}`; }
    const delivery = radio("coDelivery") === "delivery";
    $("coShipping").textContent = delivery ? ($("coDistrict").value ? soles(t.shipping) : "Elige tu distrito") : "Recojo en tienda · S/0";
    $("coFeeRow").hidden = !t.fee;
    $("coFee").textContent = soles(t.fee);
    $("coTotal").textContent = soles(t.total);
    const saved = money(savings + t.discount);
    $("coSaved").hidden = saved <= 0;
    $("coSaved").textContent = `¡Ahorras ${soles(saved)} en esta compra!`;
    const e = eta();
    $("coEta").hidden = !e;
    $("coEta").innerHTML = e ? `<b>Plazo estimado de entrega:</b> ${esc(e)}` : "";
    $("coEtaSum").hidden = !e;
    $("coEtaSum").innerHTML = e ? `Entrega estimada: <b>${esc(e)}</b>${new Set(lines.map((l) => l.p.id)).size > 1 ? " <small>(suma de los plazos de cada producto)</small>" : ""}` : "";
    const card = radio("coMethod") === "card";
    $("coSubmit").textContent = card ? `Solicitar link de pago por WhatsApp · ${soles(t.total)}` : `Confirmar pedido · ${soles(t.total)}`;
    $("coSubmit").classList.toggle("co-submit-wa", card);
    $("coLegal").textContent = card
      ? "Crearemos tu pedido y te llevamos a WhatsApp con el resumen y el monto a pagar. Ahí te enviamos tu link de pago."
      : "Al confirmar, creamos tu pedido y te mostramos cómo completar el pago. Coordinaremos contigo la fabricación y la entrega.";
    paintSteps();
  }

  function syncDelivery() {
    const delivery = radio("coDelivery") === "delivery";
    $("coDeliveryFields").hidden = !delivery;
    $("coPickupInfo").hidden = delivery;
    if (delivery) setMap(false);
    paintAll();
    render();
  }
  // Medios de pago disponibles y recargo, según lo configurado en el admin
  function applyPayments() {
    const pm = A.getPayments();
    CARD_RATE = pm.card.fee || 0;
    for (const k of ["yape", "transfer", "card"]) {
      const input = document.querySelector(`input[name="coMethod"][value="${k}"]`);
      const label = input.closest("label");
      label.hidden = !pm[k].enabled;
      if (!pm[k].enabled) input.checked = false;
    }
    document.querySelector('input[name="coMethod"][value="card"]').closest("label").querySelector("small").textContent =
      `${CARD_RATE > 0 ? `Recargo de ${CARD_RATE}%` : "Sin recargo"} · te enviamos el link de pago por WhatsApp`;
    $("coFeeRow").querySelector("dt").textContent = `Recargo tarjeta (${CARD_RATE}%)`;
    if (!pm.yape.enabled && !pm.transfer.enabled && !pm.card.enabled) $("coMethodErr").textContent = "Por ahora no hay medios de pago disponibles. Escríbenos por WhatsApp.";
  }
  function syncMethod() {
    const m = radio("coMethod");
    $("coMethodNote").textContent = m === "card"
      ? `Te escribimos por WhatsApp con tu link de pago.${CARD_RATE > 0 ? ` El recargo del ${CARD_RATE}% se suma al total.` : ""}`
      : m ? "Al confirmar te mostramos los datos para pagar y podrás subir tu comprobante." : "";
    $("coMethodErr").textContent = "";
    render();
  }

  function fillDistricts() {
    districts = A.shippingFor(shop);
    const sel = $("coDistrict");
    sel.innerHTML = `<option value="">Elige tu distrito</option>` + districts.map((d) => `<option value="${esc(d.district)}">${esc(d.district)} — ${soles(d.cost)}</option>`).join("");
  }

  // ------------------------------------------------------------ Mapa de recojo (Leaflet + OpenStreetMap, se descarga al primer uso)
  let leafletPromise = null;
  const loadLeaflet = () => leafletPromise || (leafletPromise = new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    sc.onload = () => resolve(window.L);
    sc.onerror = () => { leafletPromise = null; reject(new Error("mapa no disponible")); };
    document.head.appendChild(sc);
  }));
  let map = null;
  let mapOpen = false;
  function setMap(open) {
    mapOpen = open;
    $("coMap").hidden = !open;
    $("coMapToggle").setAttribute("aria-expanded", String(open));
    $("coMapToggle").textContent = open ? "Ocultar mapa" : "Ver ubicación";
    if (!open) return;
    if (map) { setTimeout(() => map.invalidateSize(), 50); return; }
    loadLeaflet().then((L) => {
      if (map || !mapOpen) return;
      map = L.map($("coMap"), { center: STORE.coords, zoom: 16, scrollWheelZoom: false, doubleClickZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
      const pin = L.divIcon({
        className: "map-pin", iconSize: [32, 42], iconAnchor: [16, 42],
        html: '<svg viewBox="0 0 32 42" aria-hidden="true"><path d="M16 0C7.2 0 0 7 0 15.7 0 27 16 42 16 42s16-15 16-26.3C32 7 24.8 0 16 0Z" fill="#d93025"/><circle cx="16" cy="15.5" r="6" fill="#fff"/></svg>'
      });
      L.marker(STORE.coords, { icon: pin, keyboard: false, title: STORE.address }).addTo(map);
      map.on("click", () => window.open(STORE.map, "_blank", "noopener")); // un clic abre Google Maps
      map.on("focus", () => map.scrollWheelZoom.enable());
      map.on("blur", () => map.scrollWheelZoom.disable());
      setTimeout(() => map.invalidateSize(), 300);
    }).catch(() => { $("coMap").hidden = true; window.open(STORE.map, "_blank", "noopener"); });
  }
  $("coMapToggle").addEventListener("click", () => setMap(!mapOpen));

  // ------------------------------------------------------------ Cupón
  async function checkCoupon(code, quiet) {
    const msg = $("coCouponMsg");
    if (!quiet) { msg.className = "co-coupon-msg"; msg.textContent = "Revisando…"; }
    try {
      const res = await fetch("/api/orders?op=coupon", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, code, subtotal: subtotalOf() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo validar el cupón.");
      coupon = { code: data.code, label: data.label, amount: data.amount };
      msg.className = "co-coupon-msg is-ok";
      msg.innerHTML = `✓ Cupón <b>${esc(data.code)}</b> aplicado: ${esc(data.label)} <button type="button" class="link-btn" id="coCouponRemove">Quitar</button>`;
      $("coCouponInput").value = data.code;
      $("coCouponInput").disabled = true;
      $("coCouponBtn").hidden = true;
    } catch (err) {
      const had = !!coupon;
      removeCoupon(true);
      msg.className = "co-coupon-msg is-bad";
      msg.textContent = had ? `${err.message} Quitamos el cupón.` : err.message;
    }
    render();
  }
  function removeCoupon(keepMsg) {
    coupon = null;
    $("coCouponInput").disabled = false;
    $("coCouponBtn").hidden = false;
    if (!keepMsg) { $("coCouponMsg").textContent = ""; $("coCouponInput").value = ""; }
  }
  $("coCouponBtn").addEventListener("click", () => {
    const code = $("coCouponInput").value.trim();
    if (!code) { $("coCouponMsg").className = "co-coupon-msg is-bad"; $("coCouponMsg").textContent = "Escribe tu código de descuento."; return; }
    checkCoupon(code, false);
  });
  $("coCouponInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("coCouponBtn").click(); } });
  $("coCouponMsg").addEventListener("click", (e) => { if (e.target.id === "coCouponRemove") { removeCoupon(false); render(); } });

  // ------------------------------------------------------------ Cantidades
  $("coItems").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    const li = e.target.closest("li[data-i]");
    if (!btn || !li) return;
    const line = lines[Number(li.dataset.i)];
    if (!line) return;
    const act = btn.dataset.act;
    if (act === "plus") line.qty = Math.min(MAX_QTY, line.qty + 1);
    if (act === "minus") line.qty = Math.max(1, line.qty - 1);
    if (act === "remove") lines = lines.filter((l) => l !== line);
    saveCart();
    if (!lines.length) { $("coGrid").hidden = true; $("coEmpty").hidden = false; return; }
    render();
    if (coupon) checkCoupon(coupon.code, true); // el descuento depende del subtotal
  });

  // ------------------------------------------------------------ Campos
  function formatPhone() {
    const el = $("coPhone");
    let d = digits(el.value);
    if (d.length > 9 && !d.startsWith("51")) d = d.slice(0, 9);
    if (d.startsWith("51") && d.length > 9) d = d.slice(2, 11);
    el.value = d.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  }
  $("coDni").addEventListener("input", () => { $("coDni").value = digits($("coDni").value).slice(0, 8); });
  $("coPhone").addEventListener("input", formatPhone);
  $("coBoleta").addEventListener("change", () => {
    $("coBoletaFields").hidden = !$("coBoleta").checked;
    if ($("coBoleta").checked) $("coDni").focus(); else { $("coDni").value = ""; touched.delete("coDni"); }
    paint("coDni");
    render();
  });
  FIELD_IDS.forEach((id) => {
    const el = $(id);
    el.addEventListener("blur", () => { touched.add(id); paint(id); paintSteps(); });
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => { if (touched.has(id)) paint(id); render(); saveFields(); });
  });
  $("coDistrict").addEventListener("change", () => { touched.add("coDistrict"); paint("coDistrict"); render(); saveFields(); });
  $("coForm").addEventListener("change", (e) => {
    if (e.target.name === "coDelivery") syncDelivery(); // la modalidad no se recuerda: siempre empieza en envío a domicilio
    if (e.target.name === "coMethod") syncMethod();
  });
  $("coNotes").addEventListener("input", saveFields);

  function saveFields() {
    try {
      localStorage.setItem(FIELDS_KEY, JSON.stringify({
        name: $("coName").value, phone: $("coPhone").value, email: $("coEmail").value, address: $("coAddress").value,
        district: $("coDistrict").value, notes: $("coNotes").value
      }));
    } catch (e) { /* ignorar */ }
  }
  function restoreFields() {
    try {
      const f = JSON.parse(localStorage.getItem(FIELDS_KEY)) || {};
      if (f.name) $("coName").value = f.name;
      if (f.phone) { $("coPhone").value = f.phone; formatPhone(); }
      if (f.email) $("coEmail").value = f.email;
      if (f.address) $("coAddress").value = f.address;
      if (f.notes) $("coNotes").value = f.notes;
      if (f.district && districts.some((d) => d.district === f.district)) $("coDistrict").value = f.district;
    } catch (e) { /* sin datos guardados */ }
  }

  // ------------------------------------------------------------ Envío del pedido
  function showError(msg) {
    const el = $("coError");
    el.textContent = msg;
    el.hidden = !msg;
    if (msg) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  $("coForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    FIELD_IDS.forEach((id) => touched.add(id));
    paintAll();
    const methodMsg = MSG.coMethod();
    $("coMethodErr").textContent = methodMsg;
    const firstBad = FIELD_IDS.find((id) => {
      const el = $(id);
      return RULES[id]() && !el.closest("[hidden]");
    });
    if (firstBad || methodMsg) {
      paintSteps();
      showError("Revisa los campos marcados en rojo para continuar.");
      const target = firstBad ? $(firstBad) : document.querySelector('input[name="coMethod"]');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const btn = $("coSubmit");
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Creando tu pedido…";
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop, name: $("coName").value.trim(), phone: phoneDigits(), email: $("coEmail").value.trim(), notes: $("coNotes").value.trim(),
          website: $("coWebsite").value, deliveryMode: radio("coDelivery"), district: $("coDistrict").value, address: $("coAddress").value.trim(),
          method: radio("coMethod"), coupon: coupon ? coupon.code : "", boleta: $("coBoleta").checked, dni: $("coDni").value,
          items: lines.map((l) => ({ id: l.p.id, color: l.color, text: l.text, qty: l.qty }))
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No pudimos crear tu pedido. Inténtalo de nuevo.");
      // El carrito se conserva (si vuelves atrás no se pierde); se vacía cuando el pedido se paga
      try { localStorage.setItem(LAST_KEY, JSON.stringify({ code: data.code, token: data.token, sig: cartSig(), at: Date.now() })); } catch (err) { /* ignorar */ }
      location.href = data.payUrl || data.whatsappUrl || `pedido.html?c=${encodeURIComponent(data.code)}&t=${encodeURIComponent(data.token)}`;
    } catch (err) {
      showError(err.message);
      btn.disabled = false;
      btn.textContent = label;
      render();
    }
  });
  // Si el navegador restaura la página al volver atrás, se rehabilita el botón
  window.addEventListener("pageshow", (e) => { if (e.persisted) { $("coSubmit").disabled = false; render(); } });

  // Aviso si ya se creó un pedido con este mismo carrito (por ejemplo al volver atrás)
  function showExisting() {
    try {
      const last = JSON.parse(localStorage.getItem(LAST_KEY));
      if (last && last.sig === cartSig() && Date.now() - last.at < 3 * 24 * 3600 * 1000) {
        $("coExisting").hidden = false;
        $("coExisting").innerHTML = `Ya creaste el pedido <b>${esc(last.code)}</b> con este carrito. <a href="pedido.html?c=${encodeURIComponent(last.code)}&t=${encodeURIComponent(last.token)}">Ver mi pedido</a> · Si quieres hacer otro distinto, continúa abajo.`;
      }
    } catch (e) { /* ignorar */ }
  }

  (async function init() {
    products = await A.load(shop);
    lines = readCart();
    if (!lines.length) { $("coEmpty").hidden = false; return; }
    fillDistricts();
    restoreFields();
    applyPayments();
    $("coGrid").hidden = false;
    showExisting();
    syncDelivery();
    syncMethod();
  })();
})();
