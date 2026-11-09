// ============================================================
// Página del pedido (pedido.html?c=CÓDIGO&t=TOKEN): estado, instrucciones de pago (Yape / transferencia),
// subida de comprobante y seguimiento del pago con tarjeta (Mercado Pago).
// ============================================================
(function () {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const code = params.get("c");
  const token = params.get("t");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const soles = (n) => window.ACCatalog.formatPEN(n);
  const WHATSAPP = "51943613883";
  const SHOPS = {
    cdm: { logo: "public/cdm/logo.png", home: "cdm.html", favicon: "public/favicon/cdm-32.png" },
    maderin: { logo: "public/maderin/logo-maderin.png", home: "maderin.html", favicon: "public/favicon/maderin-32.png" }
  };
  let order = null;
  let timer = null;

  function fail(msg) {
    $("pdLoading").hidden = true;
    $("pdContent").hidden = true;
    $("pdError").hidden = false;
    $("pdError").innerHTML = `<p>${esc(msg)}</p><a class="btn btn-buy" href="cdm.html">Ir a la tienda</a>`;
  }

  async function load() {
    const res = await fetch(`/api/orders?c=${encodeURIComponent(code || "")}&t=${encodeURIComponent(token || "")}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "No pudimos cargar tu pedido.");
    return data;
  }

  function copyBtn(value, label) {
    return `<button type="button" class="pd-copy" data-copy="${esc(value)}" aria-label="Copiar ${esc(label)}">Copiar</button>`;
  }

  // Encabezado personalizado: agradece por el nombre y muestra el estado, con botón para actualizarlo
  let lastUpdated = null;
  const clock = (d) => d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  const ICON_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_REFRESH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4M4 5v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4M20 19v-4h-4"/></svg>';

  function hero(o) {
    const m = o.payment.method;
    const mp = params.get("mp");
    const first = String(o.customer.name || "").trim().split(/\s+/)[0];
    const who = first ? `, ${esc(first)}` : "";
    const pendingText = m === "card"
      ? (o.payment.payUrl || mp
        ? (mp === "fail" ? "El pago no se completó. Puedes intentarlo de nuevo cuando quieras." : mp === "pending" ? "Tu pago está en proceso. Apenas se acredite, lo verás aquí." : "Tu pedido está reservado. Completa el pago con tarjeta para continuar.")
        : `Falta un paso: escríbenos por WhatsApp con el resumen de tu pedido y te enviamos el link para pagar ${soles(o.total)} con tarjeta.`)
      : `Falta un paso: paga ${soles(o.total)} por ${m === "yape" ? "Yape" : "transferencia"} y sube tu comprobante.`;
    const map = {
      pending: [`¡Gracias por tu pedido${who}!`, pendingText],
      review: [`¡Recibimos tu comprobante${who}!`, "Estamos revisando tu pago. Te escribiremos apenas lo confirmemos."],
      paid: [`¡Pago confirmado${who}!`, "Gracias por tu compra. Empezaremos a preparar tu pedido y te escribiremos para coordinar los detalles."],
      preparing: [`Estamos preparando tu pedido${who}`, "Te avisaremos apenas esté listo."],
      ready: [`¡Tu pedido está listo${who}!`, o.delivery.mode === "pickup" ? `Te esperamos en ${o.store.address}.` : "Coordinaremos contigo la entrega."],
      delivered: [`¡Disfruta tu pedido${who}!`, `Gracias por confiar en ${o.shopName}. Esperamos que te encante.`],
      cancelled: ["Pedido cancelado", "Si crees que es un error, escríbenos por WhatsApp."]
    };
    const [title, text] = map[o.status] || map.pending;
    const when = new Date(o.createdAt).toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return `<div class="pd-hero-icon is-${o.status}">${o.status === "cancelled" ? ICON_X : ICON_OK}</div>
      <h1>${title}</h1>
      <p class="pd-hero-meta">Pedido <b>${esc(o.code)}</b> · ${esc(when)}</p>
      <p class="pd-hero-text">${esc(text)}</p>
      <div class="pd-status-row">
        <span class="pd-badge pd-badge-${o.status}">${esc(statusLabel(o.status))}</span>
        <button type="button" class="pd-refresh" data-refresh>${ICON_REFRESH}<span>Actualizar estado</span></button>
      </div>
      <p class="pd-updated" id="pdUpdated" role="status" aria-live="polite">${lastUpdated ? `Actualizado a las ${clock(lastUpdated)}` : ""}</p>`;
  }
  const statusLabel = (s) => ({ pending: "Esperando pago", review: "Comprobante en revisión", paid: "Pagado", preparing: "En preparación", ready: "Listo", delivered: "Entregado", cancelled: "Cancelado" }[s] || s);

  function payBlock(o) {
    const el = $("pdPay");
    if (o.status !== "pending" && o.status !== "review") { el.hidden = true; return; }
    el.hidden = false;
    const amount = `<div class="pd-amount"><span>Monto a pagar</span><b>${soles(o.total)}</b><small>Pedido <b>${esc(o.code)}</b></small></div>`;
    if (o.payment.method === "card") {
      el.innerHTML = `<h2>Pago con tarjeta</h2>${amount}${o.payment.payUrl
        ? `<a class="btn btn-buy pd-pay-btn" href="${esc(o.payment.payUrl)}">Pagar con tarjeta</a><p class="co-note">Te llevamos a Mercado Pago. Tus datos de tarjeta no pasan por esta página.</p>`
        : `<a class="btn btn-buy pd-wa-btn" href="${esc(o.whatsappUrl || "#")}" target="_blank" rel="noopener">Solicitar link de pago por WhatsApp</a><p class="co-note">Se abre WhatsApp con el resumen de tu pedido y el monto a pagar ${o.feeRate ? `(incluye el recargo de ${o.feeRate}% por tarjeta)` : ""}.</p>`}`;
      return;
    }
    const info = o.payInfo;
    const askWa = (what) => `<p>Escríbenos por WhatsApp y te pasamos los datos para pagar.</p><a class="btn btn-buy pd-wa-btn" href="https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, quiero pagar el pedido ${o.code} (${soles(o.total)}) por ${what}. ¿Me pasan los datos?`)}" target="_blank" rel="noopener">Pedir los datos por WhatsApp</a>`;
    if (o.payment.method === "yape") {
      const y = info.yape;
      el.innerHTML = `<h2>Paga con Yape</h2>${amount}` + (!y.number && !y.qr ? askWa("Yape") : `
        <div class="pd-yape">
          ${y.qr ? `<img src="${esc(y.qr)}" alt="Código QR de Yape${y.holder ? ` de ${esc(y.holder)}` : ""}" width="220">` : ""}
          <div class="pd-lines">
            <p>${y.qr ? "Escanea el QR" : "Yapea"}${y.number ? (y.qr ? " o yapea al número:" : " al número:") : ":"}</p>
            ${y.number ? `<p class="pd-big">${esc(y.number)} ${copyBtn(y.number, "número de Yape")}</p>` : ""}
            ${y.holder ? `<p>a nombre de <b>${esc(y.holder)}</b></p>` : ""}
            <p class="co-note">Yapea exactamente ${soles(o.total)}. Después sube la captura de tu pago aquí abajo.</p>
          </div>
        </div>`);
    } else {
      const b = info.bank;
      el.innerHTML = `<h2>Paga por transferencia${b.name ? ` (${esc(b.name)})` : ""}</h2>${amount}` + (!b.account && !b.cci ? askWa("transferencia") : `
        <dl class="pd-bank">
          ${b.name ? `<div><dt>Banco</dt><dd>${esc(b.name)} — cuenta en ${esc(b.currency)}</dd></div>` : ""}
          ${b.account ? `<div><dt>Nº de cuenta</dt><dd>${esc(b.account)} ${copyBtn(b.account, "número de cuenta")}</dd></div>` : ""}
          ${b.cci ? `<div><dt>CCI (interbancaria)</dt><dd>${esc(b.cci)} ${copyBtn(b.cci, "CCI")}</dd></div>` : ""}
          ${b.holder ? `<div><dt>Titular</dt><dd>${esc(b.holder)}</dd></div>` : ""}
        </dl>
        <p class="co-note">Transfiere exactamente ${soles(o.total)}. Después sube la captura de tu pago aquí abajo.</p>`);
    }
  }

  function proofBlock(o) {
    const el = $("pdProof");
    const show = o.payment.method !== "card" && (o.status === "pending" || o.status === "review");
    el.hidden = !show;
    if (!show) return;
    const img = $("pdProofImg");
    img.hidden = !o.payment.proofUrl;
    img.innerHTML = o.payment.proofUrl ? `<img src="${esc(o.payment.proofUrl)}" alt="Tu comprobante">` : "";
    $("pdUploadText").textContent = o.payment.proofUrl ? "Cambiar comprobante" : "Subir comprobante";
    $("pdProofNote").textContent = o.status === "review" ? "Ya recibimos tu comprobante. Si te equivocaste de imagen, puedes subir otra." : "Sube una captura de tu pago (JPG, PNG o WebP). Así podemos confirmarlo más rápido.";
    $("pdWa").href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, ya realicé el pago del pedido ${o.code} (${soles(o.total)}).`)}`;
  }

  // Seguimiento: todos los estados como nodos que se van marcando
  function renderTracker(o) {
    const card = o.payment.method === "card";
    const steps = [
      ["pending", "Esperando pago"],
      ...(card ? [] : [["review", "Comprobante en revisión"]]),
      ["paid", "Pago confirmado"],
      ["preparing", "En preparación"],
      ["ready", o.delivery.mode === "pickup" ? "Listo para recoger" : "Listo para el envío"],
      ["delivered", "Entregado"]
    ];
    const cancelled = o.status === "cancelled";
    const cur = steps.findIndex(([k]) => k === o.status);
    const fmt = (iso) => (iso ? new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
    const html = steps.map(([k, label], i) => {
      const reached = !!o.times[k];
      const state = cancelled ? (reached ? "done" : "todo") : i < cur || (i === cur && k === "delivered") ? "done" : i === cur ? "current" : "todo";
      const when = state !== "todo" ? fmt(o.times[k]) : "";
      return `<li class="pd-step is-${state}"${state === "current" ? ' aria-current="step"' : ""}>
        <span class="pd-dot" aria-hidden="true">${state === "done" ? "✓" : i + 1}</span>
        <span class="pd-step-text"><b>${esc(label)}</b>${when ? `<small>${esc(when)}</small>` : ""}<span class="pd-sr">${state === "done" ? " (completado)" : state === "current" ? " (en curso)" : " (pendiente)"}</span></span>
      </li>`;
    }).join("") + (cancelled ? `<li class="pd-step is-cancelled" aria-current="step"><span class="pd-dot" aria-hidden="true">✕</span><span class="pd-step-text"><b>Cancelado</b>${o.times.cancelled ? `<small>${esc(fmt(o.times.cancelled))}</small>` : ""}</span></li>` : "");
    $("pdSteps").innerHTML = html;
    $("pdSteps").classList.toggle("is-cancelled", cancelled);
  }

  function render(o) {
    order = o;
    const s = SHOPS[o.shop] || SHOPS.cdm;
    document.body.className = `theme-${o.shop} checkout-page`;
    $("pdLogo").src = s.logo;
    $("pdBrand").href = $("pdBack").href = s.home;
    $("pdFavicon").href = s.favicon;
    document.title = `Pedido ${o.code} | ${o.shopName}`;
    $("pdLoading").hidden = true;
    $("pdContent").hidden = false;
    $("pdHero").innerHTML = hero(o);
    $("pdCode").textContent = o.code;
    $("pdItems").innerHTML = o.items.map((i) => {
      const extra = [i.color && esc(i.color), i.text && `${esc(i.textLabel)}: “${esc(i.text)}”`].filter(Boolean).join(" · ");
      return `<li><span class="co-item-info"><b>${i.qty} × ${esc(i.name)}</b>${extra ? `<small>${extra}</small>` : ""}</span><span class="co-item-price">${i.listPrice && i.listPrice > i.unitPrice ? `<s class="co-old" aria-label="Precio regular">${soles(i.listPrice * i.qty)}</s>` : ""}<span>${soles(i.lineTotal)}</span></span></li>`;
    }).join("");
    $("pdSubtotal").textContent = soles(o.subtotal);
    $("pdProdDiscRow").hidden = !(o.productDiscount > 0);
    $("pdProdDisc").textContent = `− ${soles(o.productDiscount || 0)}`;
    $("pdRegularRow").hidden = !(o.productDiscount > 0);
    $("pdRegular").textContent = soles((o.subtotal || 0) + (o.productDiscount || 0));
    $("pdCouponRow").hidden = !(o.discount > 0);
    if (o.discount > 0) { $("pdCouponLabel").textContent = `Cupón ${o.coupon ? o.coupon.code : ""}`; $("pdCouponAmt").textContent = `− ${soles(o.discount)}`; }
    $("pdEta").hidden = !o.eta;
    if (o.eta) $("pdEta").innerHTML = `<b>Plazo estimado de entrega:</b> ${esc(o.eta.text)}`;
    $("pdBoleta").hidden = !o.boleta;
    $("pdShipping").textContent = o.delivery.mode === "pickup" ? "Recojo en tienda · S/0" : soles(o.shipping);
    $("pdFeeRow").hidden = !o.fee;
    $("pdFeeRow").querySelector("dt").textContent = `Recargo tarjeta (${o.feeRate}%)`;
    $("pdFee").textContent = soles(o.fee);
    $("pdTotal").textContent = soles(o.total);
    $("pdDelivery").innerHTML = o.delivery.mode === "pickup"
      ? `<b>Recojo en tienda:</b> ${esc(o.store.address)} · <a href="${esc(o.store.map)}" target="_blank" rel="noopener">Ver ubicación</a>`
      : `<b>Envío a:</b> ${esc(o.delivery.address)}, ${esc(o.delivery.district)}`;
    renderTracker(o);
    payBlock(o);
    proofBlock(o);
    clearCartIfDone(o);
    // Tarjeta pendiente: se vuelve a consultar hasta que Mercado Pago confirme
    clearInterval(timer);
    if (o.payment.method === "card" && o.status === "pending") {
      timer = setInterval(refresh, 8000);
    }
  }

  // El carrito se conserva hasta que el pedido avanza (comprobante enviado o pago confirmado)
  function clearCartIfDone(o) {
    if (!["review", "paid", "preparing", "ready", "delivered"].includes(o.status)) return;
    try {
      const last = JSON.parse(localStorage.getItem(`${o.shop}LastOrder`));
      if (last && last.code === o.code) {
        localStorage.setItem(`${o.shop}Cart`, "[]");
        localStorage.removeItem(`${o.shop}LastOrder`);
      }
    } catch (e) { /* ignorar */ }
  }

  async function refresh() {
    try { const data = await load(); lastUpdated = new Date(); render(data); } catch (e) { /* se reintenta */ }
  }

  // Botón «Actualizar estado»: vuelve a consultar el pedido
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-refresh]");
    if (!b || b.disabled) return;
    const label = b.querySelector("span");
    b.disabled = true;
    b.classList.add("is-loading");
    label.textContent = "Actualizando…";
    try {
      const [data] = await Promise.all([load(), new Promise((ok) => setTimeout(ok, 700))]);
      const changed = order && data.status !== order.status;
      lastUpdated = new Date();
      render(data);
      if (changed) $("pdUpdated").textContent = `¡Tu pedido cambió de estado! Actualizado a las ${clock(lastUpdated)}`;
    } catch (ex) {
      b.disabled = false;
      b.classList.remove("is-loading");
      label.textContent = "Actualizar estado";
      $("pdUpdated").textContent = "No pudimos actualizar. Revisa tu conexión e inténtalo otra vez.";
    }
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    navigator.clipboard?.writeText(b.dataset.copy).then(() => {
      const t = b.textContent;
      b.textContent = "¡Copiado!";
      setTimeout(() => { b.textContent = t; }, 1500);
    }).catch(() => {});
  });

  // Comprobante: se reduce en el navegador antes de subirlo
  function toDataUrl(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No pude leer esa imagen.")); };
      img.src = url;
    });
  }
  $("pdFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const err = $("pdUploadError");
    err.hidden = true;
    $("pdUploadText").textContent = "Subiendo…";
    try {
      const res = await fetch("/api/orders?op=proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c: code, t: token, img: await toDataUrl(file) })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo subir el comprobante.");
      render(data);
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      if (order) proofBlock(order);
    }
  });

  (async function init() {
    if (!code || !token) return fail("Este enlace no es válido.");
    try { render(await load()); } catch (e) { fail(e.message); }
  })();
})();
