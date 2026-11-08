// ============================================================
// Panel de administración de Maderin y Corazón de Madera
// - Edita precios, textos, plazos, disponibilidad, etiquetas, fotos y orden de los productos.
// - Los cambios se acumulan localmente y se publican de una vez con "Publicar cambios" (POST /api/admin?op=save).
// ============================================================
(function () {
  const C = window.ACCatalog;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const SHOP_PAGES = { maderin: "maderin.html#productos", cdm: "cdm.html#productos" };
  const STOCK_LABELS = { order: "Sobre pedido", ready: "Listo para entrega", out: "Agotado" };

  const state = {
    shop: "maderin",
    catalog: { maderin: [], cdm: [], textures: [], shipping: { maderin: {}, cdm: {} }, coupons: [], heroes: [] },
    orders: [],
    ordersFilter: "open",
    saved: "",
    search: "",
    storage: "blob"
  };
  let editing = null; // { product, isNew, index }

  // ---------------------------------------------------------------- API
  async function api(op, { method = "GET", body } = {}) {
    const res = await fetch(`/api/admin?op=${op}`, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* respuesta sin JSON */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------------------------------------------------------------- Utilidades de UI
  let toastTimer;
  function toast(msg, isError = false) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.toggle("error", isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 6000 : 3500);
  }
  const snapshot = () => JSON.stringify(state.catalog);
  const isDirty = () => snapshot() !== state.saved;
  const list = () => state.catalog[state.shop];

  function refreshDirty() {
    const dirty = isDirty();
    const status = $("#saveStatus");
    status.textContent = dirty ? "Tienes cambios sin publicar" : "Todo publicado";
    status.classList.toggle("dirty", dirty);
    $("#publishBtn").disabled = !dirty;
    $("#discardBtn").disabled = !dirty;
  }

  function uniqueId(base) {
    const all = new Set([...state.catalog.maderin, ...state.catalog.cdm].map((p) => p.id));
    let id = base || "producto";
    let n = 2;
    while (all.has(id)) id = `${base}-${n++}`;
    return id;
  }
  const slugify = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

  // ---------------------------------------------------------------- Lista de productos
  function badgeOptions(current) {
    const opts = ['<option value="">Sin etiqueta</option>'];
    const presets = C.BADGES[state.shop];
    const known = presets.map((b) => b.toLowerCase());
    for (const b of presets) opts.push(`<option value="${esc(b)}"${current && current.toLowerCase() === b.toLowerCase() ? " selected" : ""}>${esc(b)}</option>`);
    if (current && !known.includes(current.toLowerCase())) opts.push(`<option value="${esc(current)}" selected>${esc(current)}</option>`);
    return opts.join("");
  }

  function rowHtml(p, index, total, canReorder) {
    const cat = C.SHOPS[state.shop].categories.find((c) => c.id === p.category);
    const photo = C.hasPhoto(p) ? `<img src="${esc(C.photoUrl(p, 480, state.shop))}" alt="" loading="lazy">` : p.svg;
    const meta = [cat ? cat.label : "", p.sku || ""].filter(Boolean).join(" · ");
    return `<li class="row${p.hidden ? " is-hidden" : ""}" data-id="${esc(p.id)}">
      <button type="button" class="grip" aria-label="Arrastrar para reordenar ${esc(p.name)}"${canReorder ? "" : " disabled"}>⋮⋮</button>
      <div class="row-thumb">${photo}</div>
      <div class="row-meta">
        <strong title="${esc(p.name)}">${esc(p.name)}</strong>
        <span>${p.hidden ? '<b class="tag-hidden">Oculto · </b>' : ""}${esc(meta)}</span>
      </div>
      <label class="field f-price">Precio
        <span class="price-wrap"><i>S/</i><input type="number" inputmode="decimal" min="0" step="1" value="${p.price ?? ""}" placeholder="—" data-field="price" aria-label="Precio de ${esc(p.name)}"></span>
      </label>
      <label class="field f-stock">Disponibilidad
        <select data-field="stock" aria-label="Disponibilidad de ${esc(p.name)}">
          ${Object.entries(STOCK_LABELS).map(([v, l]) => `<option value="${v}"${p.stock === v ? " selected" : ""}>${l}</option>`).join("")}
        </select>
      </label>
      <label class="field f-badge">Etiqueta
        <select data-field="badge" aria-label="Etiqueta de ${esc(p.name)}">${badgeOptions(p.badge)}</select>
      </label>
      <div class="row-actions">
        <button type="button" class="icon-btn eye" data-act="toggle-hidden" aria-pressed="${p.hidden}" title="${p.hidden ? "Oculto en la tienda. Clic para mostrar" : "Visible en la tienda. Clic para ocultar"}" aria-label="${p.hidden ? "Mostrar" : "Ocultar"} ${esc(p.name)}">${p.hidden ? "🚫" : "👁"}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="edit">Editar</button>
      </div>
      <div class="row-moves">
        <button type="button" class="icon-btn" data-act="up" aria-label="Subir ${esc(p.name)}"${canReorder && index > 0 ? "" : " disabled"}>▲</button>
        <button type="button" class="icon-btn" data-act="down" aria-label="Bajar ${esc(p.name)}"${canReorder && index < total - 1 ? "" : " disabled"}>▼</button>
      </div>
    </li>`;
  }

  function renderRows() {
    const items = list();
    const q = state.search.trim().toLowerCase();
    const canReorder = !q;
    const html = items.map((p, i) => ({ p, i }))
      .filter(({ p }) => !q || `${p.name} ${p.sku || ""} ${p.badge || ""}`.toLowerCase().includes(q))
      .map(({ p, i }) => rowHtml(p, i, items.length, canReorder))
      .join("");
    $("#rows").innerHTML = html;
    $("#emptyMsg").hidden = !!html;
    $("#reorderHint").textContent = canReorder
      ? "Arrastra ⋮⋮ o usa las flechas para cambiar el orden en que aparecen en la tienda. El primero se muestra arriba a la izquierda."
      : "Borra la búsqueda para poder reordenar.";
    $("#countMaderin").textContent = state.catalog.maderin.length;
    $("#countCdm").textContent = state.catalog.cdm.length;
    $("#countTex").textContent = state.catalog.textures.length;
    refreshDirty();
  }

  function move(id, delta) {
    const items = list();
    const i = items.findIndex((p) => p.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    renderRows();
    const btn = $(`.row[data-id="${CSS.escape(id)}"] [data-act="${delta < 0 ? "up" : "down"}"]`);
    if (btn && !btn.disabled) btn.focus();
  }

  // Secciones con página propia (el resto de pestañas son las tiendas)
  const PAGES = ["orders", "campaigns", "coupons", "shipping"];
  function setShop(shop) {
    const isPage = PAGES.includes(shop);
    if (state.view === "coupons" && shop !== "coupons") cleanCoupons();
    state.view = shop;
    $(".content").dataset.view = isPage ? shop : "shop";
    $$(".tab[data-shop]").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.shop === shop)));
    if (isPage) {
      document.body.dataset.shop = state.shop === "cdm" ? "cdm" : "maderin";
      $("#viewShopLink").href = SHOP_PAGES[state.shop];
      window.scrollTo(0, 0);
      if (shop === "orders") loadOrders();
      else if (shop === "campaigns") { heroDraft = null; renderHeroList(); }
      else if (shop === "coupons") renderCoupons();
      else { shipShop = state.shop === "cdm" ? "cdm" : "maderin"; renderShip(); }
      return;
    }
    state.shop = shop;
    state.search = "";
    $("#searchInput").value = "";
    document.body.dataset.shop = shop;
    $("#viewShopLink").href = SHOP_PAGES[shop];
    renderRows();
  }

  // Edición rápida en la fila (precio, disponibilidad, etiqueta)
  $("#rows").addEventListener("change", (e) => {
    const field = e.target.dataset.field;
    const row = e.target.closest(".row");
    if (!field || !row) return;
    const p = list().find((x) => x.id === row.dataset.id);
    if (!p) return;
    if (field === "price") {
      const v = e.target.value.trim();
      p.price = v === "" ? null : Math.max(0, Number(v));
      if (p.oldPrice !== null && (p.price === null || p.oldPrice <= p.price)) p.oldPrice = null;
    } else if (field === "stock") {
      p.stock = e.target.value;
    } else if (field === "badge") {
      p.badge = e.target.value || null;
    }
    refreshDirty();
    renderRows();
  });

  $("#rows").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    const row = e.target.closest(".row");
    if (!btn || !row) return;
    const id = row.dataset.id;
    const act = btn.dataset.act;
    if (act === "up") move(id, -1);
    if (act === "down") move(id, 1);
    if (act === "edit") openEditor(id);
    if (act === "toggle-hidden") {
      const p = list().find((x) => x.id === id);
      p.hidden = !p.hidden;
      renderRows();
    }
  });

  // ---------------------------------------------------------------- Arrastrar y soltar (escritorio)
  let dragId = null;
  $("#rows").addEventListener("pointerdown", (e) => {
    const grip = e.target.closest(".grip");
    if (grip && !grip.disabled) grip.closest(".row").draggable = true;
  });
  $("#rows").addEventListener("dragstart", (e) => {
    const row = e.target.closest(".row");
    if (!row || !row.draggable) return;
    dragId = row.dataset.id;
    row.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });
  $("#rows").addEventListener("dragover", (e) => {
    if (!dragId) return;
    e.preventDefault();
    const row = e.target.closest(".row");
    $$(".drop-before, .drop-after").forEach((r) => r.classList.remove("drop-before", "drop-after"));
    if (!row || row.dataset.id === dragId) return;
    const rect = row.getBoundingClientRect();
    row.classList.add(e.clientY < rect.top + rect.height / 2 ? "drop-before" : "drop-after");
  });
  $("#rows").addEventListener("drop", (e) => {
    if (!dragId) return;
    e.preventDefault();
    const row = e.target.closest(".row");
    if (row && row.dataset.id !== dragId) {
      const rect = row.getBoundingClientRect();
      const after = e.clientY >= rect.top + rect.height / 2;
      const items = list();
      const from = items.findIndex((p) => p.id === dragId);
      const [moved] = items.splice(from, 1);
      let to = items.findIndex((p) => p.id === row.dataset.id);
      if (after) to += 1;
      items.splice(to, 0, moved);
    }
    dragId = null;
    renderRows();
  });
  $("#rows").addEventListener("dragend", () => {
    dragId = null;
    $$(".row").forEach((r) => { r.draggable = false; r.classList.remove("dragging", "drop-before", "drop-after"); });
  });

  // ---------------------------------------------------------------- Editor de producto
  const form = $("#editorForm");
  const editor = $("#editor");
  const f = (name) => form.elements[name];

  function fillCategorySelect() {
    f("category").innerHTML = C.SHOPS[state.shop].categories.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("");
  }
  function fillBadgeSelect(current) {
    const presets = C.BADGES[state.shop];
    const known = presets.map((b) => b.toLowerCase());
    const custom = current && !known.includes(current.toLowerCase());
    f("badgePreset").innerHTML = ['<option value="">Sin etiqueta</option>']
      .concat(presets.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`))
      .concat('<option value="__custom">Otra (escribir)…</option>').join("");
    f("badgePreset").value = !current ? "" : custom ? "__custom" : presets.find((b) => b.toLowerCase() === current.toLowerCase());
    f("badgeCustom").value = custom ? current : "";
    $("#badgeCustomWrap").hidden = !custom;
  }

  function renderPhotoPreview(p) {
    $("#photoPreview").innerHTML = C.hasPhoto(p) ? `<img src="${esc(C.photoUrl(p, 900, state.shop))}" alt="Foto actual">` : p.svg;
    $("#photoRemove").hidden = !C.hasPhoto(p);
  }

  // ---------------------------------------------------------------- Texturas de un producto
  const texBg = (id) => { const t = C.textureOf({ tex: id }); return t ? `url("${t.thumb || t.img}")` : ""; };
  const texOptions = (current) => ['<option value="">Elegir textura…</option>']
    .concat(state.catalog.textures.map((t) => `<option value="${esc(t.id)}"${t.id === current ? " selected" : ""}>${esc(t.name)}</option>`)).join("");

  function colorRow(c = { name: "", hex: "#E5DCCB" }) {
    const row = document.createElement("div");
    row.className = "color-row";
    row.dataset.hex = /^#[0-9a-f]{3,8}$/i.test(c.hex) ? c.hex : "#E5DCCB";
    row.innerHTML = `<span class="tex-dot" aria-hidden="true"></span>
      <select aria-label="Textura">${texOptions(c.tex)}</select>
      <input type="text" value="${esc(c.name)}" maxlength="40" placeholder="Nombre" aria-label="Nombre de la textura">
      <button type="button" class="icon-btn" aria-label="Quitar textura">✕</button>`;
    const sel = row.querySelector("select");
    const nameInput = row.querySelector('input[type="text"]');
    row.dataset.auto = (state.catalog.textures.find((t) => t.id === c.tex) || {}).name === c.name ? c.name : "";
    const paintDot = () => {
      const dot = row.querySelector(".tex-dot");
      dot.style.backgroundImage = texBg(sel.value);
      dot.style.backgroundColor = sel.value ? "" : row.dataset.hex;
    };
    paintDot();
    sel.addEventListener("change", () => {
      const t = state.catalog.textures.find((x) => x.id === sel.value);
      if (t && (!nameInput.value.trim() || nameInput.value === row.dataset.auto)) { nameInput.value = t.name; row.dataset.auto = t.name; }
      paintDot();
      previewIdx = $$(".color-row", editor).indexOf(row);
      renderTexPreview();
    });
    nameInput.addEventListener("input", renderTexPreview);
    row.querySelector("button").addEventListener("click", () => { row.remove(); previewIdx = 0; renderTexPreview(); });
    return row;
  }

  let previewIdx = 0;
  // Vista previa: producto + textura elegida en grande + círculos como los ve el cliente
  function renderTexPreview() {
    if (!editing) return;
    const rows = $$(".color-row", editor).map((row) => ({
      tex: row.querySelector("select").value, hex: row.dataset.hex, name: row.querySelector('input[type="text"]').value.trim()
    }));
    if (previewIdx >= rows.length) previewIdx = 0;
    const cur = rows[previewIdx];
    const p = editing.product;
    $("#texPreviewProd").innerHTML = C.hasPhoto(p) ? `<img src="${esc(C.photoUrl(p, 900, state.shop))}" alt="">` : p.svg;
    const tile = $("#texPreviewTile");
    tile.style.backgroundImage = cur ? texBg(cur.tex) : "";
    tile.style.backgroundColor = cur && !cur.tex ? cur.hex : "";
    tile.hidden = !cur;
    $("#texPreviewName").textContent = cur ? (cur.name || (cur.tex ? "Sin nombre" : "Elige una textura")) : "Sin texturas";
    $("#texPreviewHint").textContent = cur
      ? (cur.tex ? "Haz clic en los círculos para comparar. Así los verá el cliente." : "Esta opción aún no tiene textura; elige una de la lista.")
      : "Agrega una textura para ver cómo se muestra.";
    $("#texPreviewDots").innerHTML = rows.map((r, i) =>
      `<button type="button" class="tex-chip${i === previewIdx ? " active" : ""}" data-i="${i}" title="${esc(r.name)}" aria-label="${esc(r.name || "Textura")}" aria-pressed="${i === previewIdx}" style="${r.tex ? `background-image:${esc(texBg(r.tex))}` : `background-color:${esc(r.hex)}`}"></button>`).join("");
  }
  $("#texPreviewDots").addEventListener("click", (e) => {
    const b = e.target.closest(".tex-chip");
    if (!b) return;
    previewIdx = Number(b.dataset.i);
    renderTexPreview();
  });

  function updateDiscountPreview() {
    const price = f("price").value === "" ? null : Number(f("price").value);
    const old = f("oldPrice").value === "" ? null : Number(f("oldPrice").value);
    const el = $("#discountPreview");
    if (old !== null && price !== null && old > price) el.textContent = `En la tienda se mostrará: ${C.formatPEN(price)} (antes ${C.formatPEN(old)}) · Ahorra ${C.formatPEN(old - price)}`;
    else if (old !== null) el.textContent = "El precio anterior solo se muestra si es mayor que el precio actual.";
    else if (price === null) el.textContent = "Sin precio, el producto se consulta por WhatsApp y no entra al carrito.";
    else el.textContent = "";
  }

  function openEditor(id) {
    const isNew = id === null;
    const shop = state.shop;
    const base = isNew
      ? C.normalize([{ id: "nuevo", name: "Nuevo producto", category: C.SHOPS[shop].categories[0].id, badge: "Nuevo", stock: "order" }], shop)[0]
      : clone(list().find((p) => p.id === id));
    editing = { product: base, isNew, original: id };
    form.reset();
    $("#editorError").hidden = true;
    $("#editorTitle").textContent = isNew ? "Nuevo producto" : "Editar producto";
    editor.classList.toggle("is-maderin", shop === "maderin");
    $$(".only-maderin", editor).forEach((el) => { el.hidden = shop !== "maderin"; });
    $$(".only-cdm", editor).forEach((el) => { el.hidden = shop !== "cdm"; });
    fillCategorySelect();
    fillBadgeSelect(base.badge);

    f("name").value = isNew ? "" : base.name;
    f("category").value = base.category;
    f("desc").value = base.desc || "";
    $(".lbl-desc").textContent = shop === "maderin" ? "Descripción completa (ficha del producto)" : "Descripción";
    f("price").value = base.price ?? "";
    f("oldPrice").value = base.oldPrice ?? "";
    f("stock").value = base.stock;
    f("deliveryTime").value = base.deliveryTime || "";
    f("hidden").checked = base.hidden;
    f("rating").value = base.rating ?? "";
    f("reviewsCount").value = base.reviewsCount || "";
    if (shop === "maderin") {
      f("subtitle").value = isNew ? "" : base.subtitle;
      f("cardDesc").value = isNew ? "" : base.cardDesc;
      f("sku").value = base.sku || "";
      f("ageRange").value = isNew ? "" : (base.ageRange === "Por confirmar" ? "" : base.ageRange);
      f("dimensions").value = isNew ? "" : (base.dimensions === "Por confirmar" ? "" : base.dimensions);
      f("material").value = isNew ? "" : (base.material === "Por confirmar" ? "" : base.material);
      f("finish").value = isNew ? "" : (base.finish === "Por confirmar" ? "" : base.finish);
    } else {
      f("unit").value = base.unit;
      const cu = base.custom;
      f("customOn").checked = !!cu;
      f("customLabel").value = cu ? cu.label : "";
      f("customHint").value = cu ? cu.hint : "";
      f("customMax").value = cu ? cu.max : "";
      f("customRequired").checked = !!(cu && cu.required);
      $("#customFields").hidden = !cu;
      f("spec1").value = base.specs[0] || "";
      f("spec2").value = base.specs[1] || "";
    }
    const colorList = $("#colorList");
    colorList.innerHTML = "";
    base.colors.filter((c) => c.name !== "Por definir").forEach((c) => colorList.appendChild(colorRow(c)));
    previewIdx = 0;
    renderPhotoPreview(base);
    renderTexPreview();
    $("#photoMsg").textContent = "JPG, PNG o WebP. Se optimiza sola para la web.";
    updateDiscountPreview();
    editor.showModal();
    f("name").focus();
  }

  function collectEditor() {
    const shop = state.shop;
    const p = editing.product;
    const out = { ...p };
    out.name = f("name").value.trim();
    out.category = f("category").value;
    out.desc = f("desc").value.trim();
    out.price = f("price").value === "" ? null : Math.max(0, Number(f("price").value));
    out.oldPrice = f("oldPrice").value === "" ? null : Math.max(0, Number(f("oldPrice").value));
    out.stock = f("stock").value;
    out.deliveryTime = f("deliveryTime").value.trim() || null;
    out.hidden = f("hidden").checked;
    out.rating = f("rating").value === "" ? null : Number(f("rating").value);
    out.reviewsCount = f("reviewsCount").value === "" ? 0 : Number(f("reviewsCount").value);
    const preset = f("badgePreset").value;
    out.badge = preset === "__custom" ? (f("badgeCustom").value.trim() || null) : (preset || null);
    if (shop === "maderin") {
      out.subtitle = f("subtitle").value.trim();
      out.cardDesc = f("cardDesc").value.trim();
      out.sku = f("sku").value.trim() || null;
      out.ageRange = f("ageRange").value.trim();
      out.dimensions = f("dimensions").value.trim();
      out.material = f("material").value.trim();
      out.finish = f("finish").value.trim();
    } else {
      out.unit = f("unit").value.trim() || "unidad";
      out.custom = f("customOn").checked
        ? { label: f("customLabel").value.trim() || "Personalización", hint: f("customHint").value.trim(), max: Number(f("customMax").value) || 60, required: f("customRequired").checked }
        : null;
      out.specs = [f("spec1").value.trim(), f("spec2").value.trim()].filter(Boolean);
    }
    out.colors = $$(".color-row", editor).map((row) => {
      const c = { hex: row.dataset.hex, name: row.querySelector('input[type="text"]').value.trim() };
      const tex = row.querySelector("select").value;
      if (tex) c.tex = tex;
      return c;
    }).filter((c) => c.name);
    // El icono de respaldo sigue a la categoría mientras no haya foto
    if (!C.hasPhoto(out)) out.svg = C.iconSvg(out.category);
    return out;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const out = collectEditor();
    const err = $("#editorError");
    if (!out.name) { err.textContent = "Escribe el nombre del producto."; err.hidden = false; f("name").focus(); return; }
    if (out.price !== null && !Number.isFinite(out.price)) { err.textContent = "El precio no es válido."; err.hidden = false; return; }
    if (out.rating !== null && (!Number.isFinite(out.rating) || out.rating < 0 || out.rating > 5)) { err.textContent = "La calificación debe estar entre 0 y 5."; err.hidden = false; return; }
    const items = list();
    if (editing.isNew) {
      out.id = uniqueId(slugify(out.name) || "producto");
      items.unshift(C.normalize([out], state.shop)[0]);
    } else {
      const i = items.findIndex((p) => p.id === editing.original);
      items[i] = C.normalize([out], state.shop)[0];
    }
    editor.close();
    editing = null;
    renderRows();
    toast("Cambios aplicados. Recuerda publicar para que se vean en la tienda.");
  });

  const closeEditor = () => { editor.close(); editing = null; };
  $("#editorClose").addEventListener("click", closeEditor);
  $("#editorCancel").addEventListener("click", closeEditor);
  editor.addEventListener("click", (e) => { if (e.target === editor) closeEditor(); });
  editor.addEventListener("cancel", () => { editing = null; });
  f("customOn").addEventListener("change", () => {
    $("#customFields").hidden = !f("customOn").checked;
    if (f("customOn").checked) f("customLabel").focus();
  });
  f("price").addEventListener("input", updateDiscountPreview);
  f("oldPrice").addEventListener("input", updateDiscountPreview);
  f("badgePreset").addEventListener("change", () => {
    const custom = f("badgePreset").value === "__custom";
    $("#badgeCustomWrap").hidden = !custom;
    if (custom) f("badgeCustom").focus();
  });
  $("#addColor").addEventListener("click", () => {
    const row = colorRow();
    $("#colorList").appendChild(row);
    previewIdx = $$(".color-row", editor).length - 1;
    renderTexPreview();
    row.querySelector("select").focus();
  });

  // Foto: se reduce en el navegador (480 y 900 px, WebP) y se sube al almacenamiento
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No pude leer esa imagen")); };
      img.src = url;
    });
  }
  function resizeToDataUrl(img, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.82);
  }

  $("#photoInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file || !editing) return;
    const msg = $("#photoMsg");
    msg.textContent = "Subiendo foto…";
    try {
      const img = await loadImage(file);
      const slug = slugify(f("name").value) || editing.product.id;
      const res = await api("upload", {
        method: "POST",
        body: { id: slug, img480: resizeToDataUrl(img, 480), img900: resizeToDataUrl(img, 900) }
      });
      Object.assign(editing.product, { img480: res.img480, img900: res.img900, photo: undefined });
      delete editing.product.photo;
      renderPhotoPreview(editing.product);
      renderTexPreview();
      msg.textContent = "Foto lista. Aplica los cambios y publica para verla en la tienda.";
    } catch (err) {
      msg.textContent = err.status === 401 ? "Tu sesión venció. Vuelve a entrar." : `No se pudo subir: ${err.message}`;
      if (err.status === 401) showLogin();
    }
  });
  $("#photoRemove").addEventListener("click", () => {
    if (!editing) return;
    for (const k of ["img480", "img900", "photo"]) delete editing.product[k];
    editing.product.svg = C.iconSvg(f("category").value);
    renderPhotoPreview(editing.product);
    renderTexPreview();
    $("#photoMsg").textContent = "Foto quitada. Se mostrará el icono de la categoría.";
  });

  // ---------------------------------------------------------------- Biblioteca de texturas (compartida)
  const MAX_TEX = 10;
  const texDialog = $("#texDialog");
  const syncTextures = () => C.setTextures(state.catalog.textures);
  const texUsage = (id) => [...state.catalog.maderin, ...state.catalog.cdm].filter((p) => p.colors.some((c) => c.tex === id)).length;

  function renderTexLib() {
    const items = state.catalog.textures;
    $("#texGrid").innerHTML = items.map((t) => `<li class="tex-card" data-id="${esc(t.id)}">
      <div class="tex-img" style="background-image:url(&quot;${esc(t.thumb || t.img)}&quot;)"></div>
      <input type="text" value="${esc(t.name)}" maxlength="40" aria-label="Nombre de la textura">
      <button type="button" data-act="del">Eliminar</button>
    </li>`).join("") || '<li class="muted small">Aún no hay texturas. Sube la primera.</li>';
    $("#countTex").textContent = items.length;
    $("#texUploadBtn").hidden = items.length >= MAX_TEX;
    $("#texMsg").textContent = items.length >= MAX_TEX
      ? "Llegaste al máximo de 10 texturas. Elimina una para subir otra."
      : `${items.length} de ${MAX_TEX}. JPG, PNG o WebP; se recorta a cuadrado y se optimiza sola. Sube la imagen en buena calidad (mínimo 800 px).`;
    refreshDirty();
  }
  // Tras cambiar la biblioteca, las listas desplegables del editor (si está abierto) se actualizan
  function refreshEditorTextures() {
    if (!editing) return;
    $$(".color-row", editor).forEach((row) => {
      const sel = row.querySelector("select");
      const cur = state.catalog.textures.some((t) => t.id === sel.value) ? sel.value : "";
      sel.innerHTML = texOptions(cur);
      const dot = row.querySelector(".tex-dot");
      dot.style.backgroundImage = texBg(cur);
      dot.style.backgroundColor = cur ? "" : row.dataset.hex;
    });
    renderTexPreview();
  }
  const openTexLib = () => { renderTexLib(); texDialog.showModal(); };
  const closeTexLib = () => { texDialog.close(); refreshEditorTextures(); renderRows(); };
  $("#texBtn").addEventListener("click", openTexLib);
  $("#openTexLib").addEventListener("click", openTexLib);
  $("#texClose").addEventListener("click", closeTexLib);
  $("#texDone").addEventListener("click", closeTexLib);
  texDialog.addEventListener("cancel", () => setTimeout(() => { refreshEditorTextures(); renderRows(); }));
  texDialog.addEventListener("click", (e) => { if (e.target === texDialog) closeTexLib(); });
  $("#texGrid").addEventListener("change", (e) => {
    const card = e.target.closest(".tex-card");
    const t = card && state.catalog.textures.find((x) => x.id === card.dataset.id);
    if (!t || e.target.tagName !== "INPUT") return;
    t.name = e.target.value.trim() || t.name;
    e.target.value = t.name;
    refreshDirty();
  });
  $("#texGrid").addEventListener("click", (e) => {
    const btn = e.target.closest('[data-act="del"]');
    const card = btn && btn.closest(".tex-card");
    if (!card) return;
    const t = state.catalog.textures.find((x) => x.id === card.dataset.id);
    const n = texUsage(t.id);
    if (!confirm(n ? `"${t.name}" se usa en ${n} producto(s). Si la eliminas, esos productos mostrarán un color liso en su lugar. ¿Eliminar?` : `¿Eliminar la textura "${t.name}"?`)) return;
    state.catalog.textures = state.catalog.textures.filter((x) => x.id !== t.id);
    syncTextures();
    renderTexLib();
  });
  function cropSquareDataUrl(img, size, quality = 0.85) {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(size, side);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", quality);
  }
  $("#texInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (state.catalog.textures.length >= MAX_TEX) return;
    const msg = $("#texMsg");
    msg.textContent = "Subiendo textura…";
    try {
      const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 40) || "Textura";
      const base = slugify(name) || "textura";
      let id = base;
      const taken = new Set(state.catalog.textures.map((t) => t.id));
      for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
      const img = await loadImage(file);
      const res = await api("upload", { method: "POST", body: { kind: "texture", id, img: cropSquareDataUrl(img, 800, 0.9), thumb: cropSquareDataUrl(img, 160, 0.85) } });
      state.catalog.textures.push({ id, name, img: res.img, thumb: res.thumb });
      syncTextures();
      renderTexLib();
      toast("Textura subida. Ponle nombre y publica para verla en la tienda.");
    } catch (err) {
      msg.textContent = err.status === 401 ? "Tu sesión venció. Vuelve a entrar." : `No se pudo subir: ${err.message}`;
      if (err.status === 401) { texDialog.close(); showLogin(true); }
    }
  });

  // ---------------------------------------------------------------- Nuevo, restaurar, descartar, publicar
  $("#newBtn").addEventListener("click", () => openEditor(null));
  $("#searchInput").addEventListener("input", (e) => { state.search = e.target.value; renderRows(); });
  $$(".tab").forEach((t) => t.addEventListener("click", () => setShop(t.dataset.shop)));

  $("#discardBtn").addEventListener("click", () => {
    if (!confirm("¿Descartar todos los cambios sin publicar?")) return;
    state.catalog = JSON.parse(state.saved);
    syncTextures();
    setShop(state.view || state.shop);
  });

  $("#publishBtn").addEventListener("click", async () => {
    const btn = $("#publishBtn");
    cleanCoupons();
    btn.disabled = true;
    $("#saveStatus").textContent = "Publicando…";
    try {
      const res = await api("save", { method: "POST", body: { maderin: state.catalog.maderin, cdm: state.catalog.cdm, textures: state.catalog.textures, shipping: state.catalog.shipping, coupons: state.catalog.coupons, heroes: state.catalog.heroes } });
      state.catalog = {
        maderin: C.normalize(res.catalog.maderin, "maderin"),
        cdm: C.normalize(res.catalog.cdm, "cdm"),
        textures: res.catalog.textures || [],
        shipping: { maderin: {}, cdm: {}, ...(res.catalog.shipping || {}) },
        coupons: res.catalog.coupons || [],
        heroes: res.catalog.heroes || []
      };
      syncTextures();
      state.saved = snapshot();
      renderRows();
      toast("Publicado. La tienda ya muestra los cambios.");
    } catch (err) {
      refreshDirty();
      if (err.status === 401) { toast("Tu sesión venció. Entra de nuevo; tus cambios siguen aquí.", true); showLogin(true); }
      else toast(`No se pudo publicar: ${err.message}`, true);
    }
  });

  // Delete / duplicate viven en el editor para evitar acciones accidentales desde la lista
  const foot = $(".editor-foot");
  const dupBtn = document.createElement("button");
  dupBtn.type = "button"; dupBtn.className = "btn btn-ghost"; dupBtn.textContent = "Duplicar";
  const delBtn = document.createElement("button");
  delBtn.type = "button"; delBtn.className = "btn btn-ghost"; delBtn.textContent = "Eliminar"; delBtn.style.color = "var(--danger)";
  foot.insertBefore(delBtn, $("#editorCancel"));
  foot.insertBefore(dupBtn, $("#editorCancel"));
  const syncExtraButtons = new MutationObserver(() => { dupBtn.hidden = delBtn.hidden = !editing || editing.isNew; });
  syncExtraButtons.observe(editor, { attributes: true, attributeFilter: ["open"] });

  delBtn.addEventListener("click", () => {
    if (!editing || editing.isNew) return;
    if (!confirm(`¿Eliminar "${editing.product.name}" de la tienda? Si solo quieres quitarlo por ahora, mejor márcalo como oculto.`)) return;
    const items = list();
    items.splice(items.findIndex((p) => p.id === editing.original), 1);
    closeEditor();
    renderRows();
  });
  dupBtn.addEventListener("click", () => {
    if (!editing || editing.isNew) return;
    const items = list();
    const i = items.findIndex((p) => p.id === editing.original);
    const copy = clone(items[i]);
    copy.id = uniqueId(`${copy.id}-copia`);
    copy.name = `${copy.name} (copia)`;
    copy.sku = null;
    copy.hidden = true;
    items.splice(i + 1, 0, copy);
    closeEditor();
    renderRows();
    toast("Copia creada y oculta. Edítala y muéstrala cuando esté lista.");
  });

  window.addEventListener("beforeunload", (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ""; } });

  // ---------------------------------------------------------------- Pedidos de los clientes
  const ORDER_STATUS = {
    pending: "Esperando pago", review: "Comprobante por revisar", paid: "Pagado", preparing: "En preparación",
    ready: "Listo", delivered: "Entregado", cancelled: "Cancelado"
  };
  const PAY_LABEL = { yape: "Yape", transfer: "Transferencia", card: "Tarjeta (Mercado Pago)" };
  const SHOP_LABEL = { maderin: "Maderin", cdm: "CDM" };
  const ORDER_FILTERS = [
    ["open", "Por atender"], ["review", "Por confirmar pago"], ["paid", "Pagados"], ["delivered", "Entregados"], ["cancelled", "Cancelados"], ["all", "Todos"]
  ];
  const orderMatches = (o, f) => ({
    all: true,
    open: !["delivered", "cancelled"].includes(o.status),
    review: ["pending", "review"].includes(o.status),
    paid: ["paid", "preparing", "ready"].includes(o.status),
    delivered: o.status === "delivered",
    cancelled: o.status === "cancelled"
  }[f]);
  const soles = (n) => C.formatPEN(n);
  const fmtDate = (iso) => new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  function waLinkFor(o) {
    let phone = String(o.customer.phone).replace(/\D/g, "");
    if (phone.length === 9) phone = `51${phone}`;
    const shopName = o.shop === "cdm" ? "Corazón de Madera" : "Maderin";
    const msg = o.payment.method === "card" && ["pending", "review"].includes(o.status)
      ? `Hola ${o.customer.name}, te escribimos de ${shopName}. Aquí tienes el link de pago con tarjeta de tu pedido ${o.code} por ${soles(o.total)}: `
      : `Hola ${o.customer.name}, te escribimos de ${shopName} por tu pedido ${o.code}.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }

  function orderHtml(o) {
    const d = o.delivery;
    const items = o.items.map((i) => `<li>${i.qty} × ${esc(i.name)}${i.color ? ` (${esc(i.color)})` : ""} — ${soles(i.lineTotal)}${i.text ? `<br><small>${esc(i.textLabel)}: “${esc(i.text)}”</small>` : ""}</li>`).join("");
    const statusOpts = Object.entries(ORDER_STATUS).map(([v, l]) => `<option value="${v}"${o.status === v ? " selected" : ""}>${l}</option>`).join("");
    const proof = o.payment.proofUrl ? `<div class="order-proof"><h4>Comprobante</h4><a href="${esc(o.payment.proofUrl)}" target="_blank" rel="noopener"><img src="${esc(o.payment.proofUrl)}" alt="Comprobante de pago" loading="lazy"></a></div>` : "";
    const hist = (o.history || []).map((h) => `<li>${fmtDate(h.at)} — ${esc(h.text)}</li>`).join("");
    return `<details class="order" data-code="${esc(o.code)}">
      <summary>
        <span class="order-code">${esc(o.code)}</span>
        <span class="order-meta"><b>${esc(o.customer.name)}</b> · ${SHOP_LABEL[o.shop]} · ${PAY_LABEL[o.payment.method]} · ${fmtDate(o.createdAt)}</span>
        <span class="order-total">${soles(o.total)}</span>
        <span class="badge badge-${o.status}">${ORDER_STATUS[o.status]}${o.status === "cancelled" && o.cancelledAt ? ` · ${fmtDate(o.cancelledAt)}` : ""}</span>
      </summary>
      <div class="order-body">
        <div><h4>Cliente</h4>${esc(o.customer.name)} · ${esc(o.customer.phone)}${o.customer.email ? ` · ${esc(o.customer.email)}` : ""}</div>
        <div><h4>Entrega</h4>${d.mode === "pickup" ? "Recojo en tienda" : `Envío a domicilio — ${esc(d.address)}, ${esc(d.district)}`}</div>
        <div><h4>Productos</h4><ul class="order-items">${items}</ul></div>
        <div class="order-totals">
          <div><span>Subtotal</span><span>${soles(o.subtotal)}</span></div>
          ${o.productDiscount ? `<div><span>Descuentos del producto (incluidos)</span><span>${soles(o.productDiscount)}</span></div>` : ""}
          ${o.discount ? `<div><span>Cupón ${esc(o.coupon ? o.coupon.code : "")}</span><span>− ${soles(o.discount)}</span></div>` : ""}
          <div><span>Envío</span><span>${soles(o.shipping)}</span></div>
          ${o.fee ? `<div><span>Recargo tarjeta</span><span>${soles(o.fee)}</span></div>` : ""}
          <div><b>Total</b><b>${soles(o.total)}</b></div>
        </div>
        ${o.eta ? `<div><h4>Plazo estimado</h4>${esc(o.eta.text)}</div>` : ""}
        ${o.invoice ? `<div><h4>Boleta</h4>Solicitada · DNI ${esc(o.invoice.dni)}</div>` : ""}
        ${o.notes ? `<div><h4>Nota del cliente</h4>${esc(o.notes)}</div>` : ""}
        ${proof}
        <div class="order-actions">
          <label>Estado <select data-act="status" data-current="${esc(o.status)}" aria-label="Estado del pedido ${esc(o.code)}">${statusOpts}</select></label>
          <button type="button" class="btn btn-primary btn-sm" data-act="save-status" disabled>Guardar estado</button>
          ${["pending", "review"].includes(o.status) ? `<button type="button" class="btn btn-primary btn-sm" data-act="confirm">Confirmar pago</button>` : ""}
          <a class="btn btn-ghost btn-sm" href="${esc(waLinkFor(o))}" target="_blank" rel="noopener">WhatsApp al cliente</a>
          <a class="btn btn-ghost btn-sm" href="pedido.html?c=${esc(o.code)}&t=${esc(o.token)}" target="_blank" rel="noopener">Ver página del cliente</a>
        </div>
        <div><h4>Historial</h4><ul class="order-history">${hist}</ul></div>
      </div>
    </details>`;
  }

  function renderOrders() {
    const needs = state.orders.filter((o) => ["pending", "review"].includes(o.status)).length;
    const badge = $("#countOrders");
    badge.textContent = needs;
    badge.hidden = needs === 0;
    $("#ordersFilters").innerHTML = ORDER_FILTERS.map(([k, l]) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${state.ordersFilter === k}">${l}</button>`).join("");
    const open = new Set($$("#ordersList .order[open]").map((el) => el.dataset.code));
    const list = state.orders.filter((o) => orderMatches(o, state.ordersFilter));
    $("#ordersList").innerHTML = list.map(orderHtml).join("");
    $$("#ordersList .order").forEach((el) => { if (open.has(el.dataset.code)) el.open = true; });
    $("#ordersEmpty").hidden = list.length > 0;
    $("#ordersEmpty").textContent = state.orders.length ? "No hay pedidos en este filtro." : "Aún no hay pedidos.";
    $("#ordersHint").textContent = state.ordersFilter === "cancelled"
      ? "Los pedidos cancelados se muestran durante 30 días desde que se cancelaron."
      : needs ? `${needs} pedido(s) esperando confirmación de pago.` : "";
  }

  async function loadOrders() {
    $("#ordersHint").textContent = "Cargando pedidos…";
    try {
      const res = await api("orders");
      state.orders = res.orders || [];
      renderOrders();
    } catch (err) {
      $("#ordersHint").textContent = "";
      if (err.status === 401) { toast("Tu sesión venció. Vuelve a entrar.", true); showLogin(true); }
      else toast(`No se pudieron cargar los pedidos: ${err.message}`, true);
    }
  }

  async function updateOrder(code, body) {
    try {
      const res = await api("order-update", { method: "POST", body: { code, ...body } });
      const i = state.orders.findIndex((o) => o.code === code);
      if (i >= 0) state.orders[i] = res.order;
      renderOrders();
      toast("Pedido actualizado.");
    } catch (err) {
      toast(`No se pudo actualizar: ${err.message}`, true);
      renderOrders();
    }
  }

  $("#ordersFilters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    state.ordersFilter = b.dataset.filter;
    renderOrders();
  });
  $("#ordersRefresh").addEventListener("click", loadOrders);
  // Ventana para cancelar un pedido: devuelve { reason } si se confirma, o null si se vuelve atrás
  const cancelDialog = $("#cancelDialog");
  let cancelResolve = null;
  function askCancel(o) {
    $("#cancelCode").textContent = o.code;
    $("#cancelSummary").textContent = `${o.customer.name} · ${soles(o.total)}`;
    $("#cancelPaidWarn").hidden = !["paid", "preparing", "ready"].includes(o.status);
    $("#cancelReason").value = "";
    return new Promise((resolve) => { cancelResolve = resolve; cancelDialog.returnValue = ""; cancelDialog.showModal(); });
  }
  cancelDialog.addEventListener("close", () => {
    const done = cancelResolve;
    cancelResolve = null;
    if (done) done(cancelDialog.returnValue === "confirm" ? { reason: $("#cancelReason").value.trim() } : null);
  });
  cancelDialog.addEventListener("click", (e) => { if (e.target === cancelDialog) cancelDialog.close(); });

  // Cambiar el estado se aplica con el botón «Guardar estado» (no al elegir en la lista)
  $("#ordersList").addEventListener("change", (e) => {
    const sel = e.target.closest('[data-act="status"]');
    const card = e.target.closest(".order");
    if (!sel || !card) return;
    card.querySelector('[data-act="save-status"]').disabled = sel.value === sel.dataset.current;
  });
  $("#ordersList").addEventListener("click", (e) => {
    const card = e.target.closest(".order");
    if (!card) return;
    const save = e.target.closest('[data-act="save-status"]');
    if (save && !save.disabled) {
      const status = card.querySelector('[data-act="status"]').value;
      const code = card.dataset.code;
      if (status === "cancelled") {
        // Ventana propia de confirmación (con motivo opcional) en vez del aviso del navegador
        askCancel(state.orders.find((x) => x.code === code)).then((res) => {
          if (!res) return;
          save.disabled = true;
          save.textContent = "Guardando…";
          updateOrder(code, { status, ...(res.reason ? { note: `Motivo de la cancelación: ${res.reason}` } : {}) });
        });
        return;
      }
      save.disabled = true;
      save.textContent = "Guardando…";
      updateOrder(code, { status });
      return;
    }
    const btn = e.target.closest('[data-act="confirm"]');
    if (btn && confirm("¿Confirmas que ya recibiste este pago?")) updateOrder(card.dataset.code, { status: "paid" });
  });

  // ---------------------------------------------------------------- Heros: campañas por temporada
  const heroForm = $("#heroForm");
  const heroDialog = $("#heroDialog");
  const HERO_SHOP_LABEL = { maderin: "Maderin", cdm: "Corazón de Madera", ac: "AC Mueblería" };
  const heroes = () => state.catalog.heroes;
  const limaToday = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  let heroDraft = null; // { isNew, original, c }

  // Misma regla que el servidor: por tienda gana la campaña vigente con inicio más reciente
  function heroWinners() {
    const t = limaToday();
    const out = {};
    for (const shop of Object.keys(HERO_SHOP_LABEL)) {
      const live = heroes().filter((c) => c.active !== false && c.shops.includes(shop) && (!c.start || c.start <= t) && (!c.end || c.end >= t));
      live.sort((a, b) => String(b.start || "").localeCompare(String(a.start || "")));
      out[shop] = live[0] ? live[0].id : null;
    }
    return out;
  }
  const fmtD = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  function heroStatus(c, winners) {
    const t = limaToday();
    if (c.active === false) return ["off", "Desactivada"];
    if (c.end && c.end < t) return ["off", "Terminada"];
    if (c.start && c.start > t) return ["sched", `Programada · empieza el ${fmtD(c.start)}`];
    const showing = c.shops.filter((s) => winners[s] === c.id);
    return showing.length ? ["live", `Mostrándose ahora en ${showing.map((s) => HERO_SHOP_LABEL[s]).join(", ")}`] : ["off", "Vigente, pero otra campaña tiene prioridad"];
  }

  // Portada por defecto de cada página (lo que se ve cuando no hay campaña vigente)
  const HERO_DEFAULT = {
    maderin: { image: "public/maderin/hero.png", html: 'Mobiliario infantil para <span class="hl">fomentar su autonomía</span>.', text: "Mobiliario diseñado para que los niños mejoren su independencia y crezcan a su propio ritmo", cta: "Ver catálogo infantil", ghost: "Síguenos en Instagram", micro: "Pedidos por WhatsApp · Entrega en Lima", badges: [["Materiales seguros", "Madera pino y melamina"], ["Diseño Montessori", "Pensado para jugar y crecer"]] },
    cdm: { image: "public/cdm/hero.png", html: "Regalos que dicen<br>lo que las palabras<br><em>no alcanzan.</em>", text: "Corazón de Madera crea detalles personalizados en madera y melamina — cuadros, organizadores y recuerdos — para cumpleaños, aniversarios y toda ocasión especial.", cta: "Ver productos", ghost: "Síguenos en Instagram", micro: "Pedidos por WhatsApp · Personalización incluida", badges: [["Personalizado", "con nombres y fechas"], ["Entrega rápida", "ideal para regalos"], ["Hecho a mano", "en madera y melamina"]] },
    ac: { image: "public/ac_muebleria/hero-img.png", html: "Muebles que <em>transforman tu espacio</em>", text: "Cocinas, closets, muebles de TV y proyectos completos, fabricados en nuestro taller de principio a fin.", cta: "Cotiza tu proyecto", ghost: "Ver nuestros trabajos", micro: "Cotización en menos de 30 minutos, sin compromiso", badges: [["+100", "proyectos entregados"], ["+200", "diseños 3D realizados"]] }
  };
  // Plantillas de temporada: nombre, textos y fechas sugeridas (mes-día)
  const HERO_TEMPLATES = [
    { id: "navidad", label: "Navidad", name: "Navidad", title: "Esta Navidad,\nregala algo especial", text: "Ofertas de temporada hasta el 25 de diciembre.", cta: "Ver ofertas", from: "12-01", to: "12-26" },
    { id: "madre", label: "Día de la Madre", name: "Día de la Madre", title: "Para mamá,\ncon todo el cariño", text: "Detalles y regalos para celebrar a mamá.", cta: "Ver regalos", from: "05-01", to: "05-12" },
    { id: "padre", label: "Día del Padre", name: "Día del Padre", title: "Un regalo para papá", text: "Sorprende a papá con algo hecho para él.", cta: "Ver regalos", from: "06-01", to: "06-21" },
    { id: "nino", label: "Día del Niño", name: "Día del Niño", title: "Feliz Día del Niño", text: "Celebra a los peques con descuentos especiales.", cta: "Ver ofertas", from: "04-01", to: "04-14" },
    { id: "patrias", label: "Fiestas Patrias", name: "Fiestas Patrias", title: "Celebra con lo nuestro", text: "Ofertas por Fiestas Patrias.", cta: "Ver ofertas", from: "07-20", to: "07-29" },
    { id: "cyber", label: "Cyber Days", name: "Cyber Days", title: "Cyber Days", text: "Descuentos por tiempo limitado en toda la tienda.", cta: "Aprovechar ofertas", from: "10-27", to: "11-02" },
    { id: "black", label: "Black Friday", name: "Black Friday", title: "Black Friday", text: "Los mejores precios del año, solo por pocos días.", cta: "Ver ofertas", from: "11-24", to: "11-30" }
  ];
  const nl2br = (t) => esc(t).replace(/\n/g, "<br>");

  // Vista previa de una portada con el mismo diseño de la página (v.title vacío = título de siempre)
  function heroPreviewHtml(shop, v) {
    const d = HERO_DEFAULT[shop];
    const full = v.mode === "full";
    const img = v.image ? ` style="background-image:url(&quot;${esc(v.image)}&quot;)"` : "";
    const btn = (t, cls) => (t ? `<span class="${cls}">${esc(t)}</span>` : "");
    const copy = full
      ? (v.cta && v.ctaUrl ? btn(v.cta, "hp-btn hp-corner") : "")
      : `<h3>${v.title ? nl2br(v.title) : d.html}</h3><p class="hp-lede">${esc(v.text)}</p>
         <div class="hp-actions">${btn(v.cta, "hp-btn")}${btn(d.ghost, "hp-ghost")}</div>
         <p class="hp-micro">${esc(d.micro)}</p>
         <div class="hp-badges">${d.badges.map(([b, t]) => `<div><b>${esc(b)}</b>${esc(t)}</div>`).join("")}</div>`;
    return `<div class="hp hp-${shop}${full ? " hp-full" : ""}${v.image ? "" : " hp-noimg"}"${img}>${v.image ? "" : `<span class="hp-empty">Sin imagen</span>`}<div class="hp-overlay"></div><div class="hp-copy">${copy}</div></div>`;
  }

  let heroNowShop = "maderin";
  function renderHeroNow() {
    $$("[data-now]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.now === heroNowShop)));
    const id = heroWinners()[heroNowShop];
    const c = id && heroes().find((x) => x.id === id);
    const d = HERO_DEFAULT[heroNowShop];
    if (c) {
      $("#heroNow").innerHTML = heroPreviewHtml(heroNowShop, { mode: c.mode, image: c.image, title: c.title, text: c.text || d.text, cta: c.ctaLabel || (c.mode === "full" ? "" : d.cta), ctaUrl: c.ctaUrl });
      $("#heroNowCaption").textContent = `Campaña en vivo: «${c.name}»${c.end ? `, hasta el ${fmtD(c.end)}` : ""}.`;
    } else {
      $("#heroNow").innerHTML = heroPreviewHtml(heroNowShop, { mode: "text", image: d.image, title: "", text: d.text, cta: d.cta });
      $("#heroNowCaption").textContent = "Portada por defecto (no hay campañas en vivo hoy).";
    }
  }
  $$("[data-now]").forEach((b) => b.addEventListener("click", () => { heroNowShop = b.dataset.now; renderHeroNow(); }));

  function renderHeroList() {
    const w = heroWinners();
    renderHeroNow();
    $("#heroCards").innerHTML = heroes().length ? heroes().map((c, i) => {
      const [kind, label] = heroStatus(c, w);
      const dates = c.start || c.end ? `${c.start ? fmtD(c.start) : "—"} → ${c.end ? fmtD(c.end) : "sin fecha final"}` : "Sin fechas (siempre que esté activa)";
      return `<li class="hero-card" data-i="${i}">
        <div class="hero-card-img" style="background-image:url(&quot;${esc(c.image)}&quot;)" role="img" aria-label="${esc(c.alt || c.name)}"></div>
        <div class="hero-card-info">
          <strong>${esc(c.name)}</strong>
          <span><span class="badge badge-${kind === "live" ? "live" : kind === "sched" ? "sched" : "off"}">${esc(label)}</span></span>
          <span class="muted">${dates} · ${c.mode === "full" ? "Banner completo" : "Imagen con textos"}</span>
          <span class="hero-tags">${c.shops.map((s) => `<span class="hero-tag">${HERO_SHOP_LABEL[s]}</span>`).join("")}</span>
        </div>
        <div class="hero-card-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-act="edit">Editar</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="toggle">${c.active === false ? "Activar" : "Desactivar"}</button>
          <button type="button" class="btn btn-ghost btn-sm btn-danger-text" data-act="del">Eliminar</button>
        </div>
      </li>`;
    }).join("") : `<li class="hero-empty">Aún no hay campañas. Crea una desde una plantilla (Navidad, Día de la Madre, Cyber…) con «+ Nueva campaña».</li>`;
    refreshDirty();
  }

  // Vista previa dentro del modal: se actualiza con lo que se escribe
  function renderHeroPreview() {
    if (!heroDraft) return;
    const f = heroForm.elements;
    const shops = $$('input[name="shop"]:checked', heroForm).map((el) => el.value);
    const shop = shops[0] || "maderin";
    const d = HERO_DEFAULT[shop];
    const full = f.mode.value === "full";
    $("#heroPreviewShop").textContent = HERO_SHOP_LABEL[shop];
    $("#heroPreview").innerHTML = heroPreviewHtml(shop, {
      mode: full ? "full" : "text",
      image: heroDraft.c.image,
      title: f.title.value.trim(),
      text: f.text.value.trim() || d.text,
      cta: f.ctaLabel.value.trim() || (full ? "" : d.cta),
      ctaUrl: f.ctaUrl.value.trim()
    });
  }

  function paintHeroImages() {
    const c = heroDraft.c;
    $("#heroImgPrev").style.backgroundImage = c.image ? `url("${c.image}")` : "";
    $("#heroImgPrev").textContent = c.image ? "" : "Sin imagen";
    $("#heroImgBtn").textContent = c.image ? "Cambiar imagen" : "Subir imagen";
    $("#heroMobPrev").style.backgroundImage = c.imageMobile ? `url("${c.imageMobile}")` : "";
    $("#heroMobPrev").textContent = c.imageMobile ? "" : "Usa la de escritorio";
    $("#heroMobBtn").textContent = c.imageMobile ? "Cambiar imagen" : "Subir imagen";
    $("#heroMobRemove").hidden = !c.imageMobile;
    renderHeroPreview();
  }
  function syncHeroMode() {
    const full = heroForm.elements.mode.value === "full";
    $$(".hero-text-only", heroForm).forEach((el) => { el.hidden = full; });
    renderHeroPreview();
  }

  function openHeroForm(index) {
    const isNew = index === null;
    const c = isNew
      ? { id: "", name: "", shops: ["maderin", "cdm"], start: "", end: "", active: true, mode: "text", image: "", alt: "", title: "", text: "", ctaLabel: "", ctaUrl: "" }
      : clone(heroes()[index]);
    heroDraft = { isNew, index, c };
    const f = heroForm.elements;
    f.name.value = c.name;
    $$('input[name="shop"]', heroForm).forEach((el) => { el.checked = c.shops.includes(el.value); });
    f.start.value = c.start || "";
    f.end.value = c.end || "";
    f.active.checked = c.active !== false;
    f.alt.value = c.alt || "";
    f.mode.value = c.mode || "text";
    f.title.value = c.title || "";
    f.text.value = c.text || "";
    f.ctaLabel.value = c.ctaLabel || "";
    f.ctaUrl.value = c.ctaUrl || "";
    f.start.min = f.end.min = "2025-01-01";
    f.start.max = f.end.max = `${new Date().getFullYear() + 1}-12-31`;
    $("#heroImgError").hidden = true;
    $("#heroFormError").hidden = true;
    $("#heroFormTitle").textContent = isNew ? "Nueva campaña" : "Editar campaña";
    $("#heroSubmit").textContent = isNew ? "Crear campaña" : "Guardar cambios";
    $("#heroTemplate").value = "";
    $("#heroTemplate").closest("label").hidden = !isNew;
    paintHeroImages();
    syncHeroMode();
    heroDialog.showModal();
    $("#heroDialog .editor-body").scrollTop = 0;
  }

  // Plantillas de temporada
  $("#heroTemplate").innerHTML = `<option value="">En blanco</option>` + HERO_TEMPLATES.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join("");
  $("#heroTemplate").addEventListener("change", (e) => {
    const t = HERO_TEMPLATES.find((x) => x.id === e.target.value);
    if (!t) return;
    const f = heroForm.elements;
    const now = new Date();
    const today = limaToday();
    let y = now.getFullYear();
    if (`${y}-${t.to}` < today) y += 1; // si ya pasó este año, la próxima edición
    f.name.value = `${t.name} ${y}`;
    f.title.value = t.title;
    f.text.value = t.text;
    f.ctaLabel.value = t.cta;
    f.ctaUrl.value = "#productos";
    f.start.value = `${y}-${t.from}`;
    f.end.value = `${y}-${t.to}`;
    f.mode.value = "text";
    syncHeroMode();
    renderHeroPreview();
  });
  heroForm.addEventListener("input", renderHeroPreview);
  heroForm.addEventListener("change", renderHeroPreview);

  async function uploadHeroImage(file, maxSide, key) {
    const msg = $("#heroImgError");
    msg.hidden = true;
    const btn = key === "image" ? $("#heroImgBtn") : $("#heroMobBtn");
    const label = btn.textContent;
    btn.textContent = "Subiendo…";
    try {
      const img = await loadImage(file);
      const res = await api("upload", { method: "POST", body: { kind: "hero", id: `${slugify(heroForm.elements.name.value) || "hero"}-${key === "image" ? "pc" : "movil"}`, img: resizeToDataUrl(img, maxSide) } });
      heroDraft.c[key] = res.img;
      paintHeroImages();
    } catch (err) {
      btn.textContent = label;
      msg.textContent = err.status === 401 ? "Tu sesión venció. Vuelve a entrar." : `No se pudo subir la imagen: ${err.message}`;
      msg.hidden = false;
      if (err.status === 401) { heroDialog.close(); showLogin(true); }
    }
  }
  $("#heroImgInput").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) uploadHeroImage(f, 1920, "image"); });
  $("#heroMobInput").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) uploadHeroImage(f, 1350, "imageMobile"); });
  $("#heroMobRemove").addEventListener("click", () => { delete heroDraft.c.imageMobile; paintHeroImages(); });
  $$('input[name="mode"]', heroForm).forEach((el) => el.addEventListener("change", syncHeroMode));

  heroForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = heroForm.elements;
    const c = heroDraft.c;
    const err = $("#heroFormError");
    const fail = (m, el) => { err.textContent = m; err.hidden = false; if (el) el.focus(); };
    c.name = f.name.value.trim();
    c.shops = $$('input[name="shop"]:checked', heroForm).map((el) => el.value);
    c.start = f.start.value;
    c.end = f.end.value;
    c.active = f.active.checked;
    c.alt = f.alt.value.trim();
    c.mode = f.mode.value;
    c.title = f.title.value.trim();
    c.text = f.text.value.trim();
    c.ctaLabel = f.ctaLabel.value.trim();
    c.ctaUrl = f.ctaUrl.value.trim();
    if (!c.name) return fail("Ponle un nombre a la campaña (por ejemplo «Navidad 2026»).", f.name);
    if (!c.shops.length) return fail("Elige al menos una página donde se mostrará.");
    if (!c.image) return fail("Sube la imagen de escritorio.");
    if (c.start && c.end && c.end < c.start) return fail("La fecha «Hasta» no puede ser anterior a «Desde».", f.end);
    if (c.ctaUrl && !/^(#[\w-]+|\/[\w\-./?=&#%]*|https:\/\/\S+)$/.test(c.ctaUrl)) return fail("El enlace debe empezar con https://, con / o con # (por ejemplo #productos).", f.ctaUrl);
    if (c.mode === "text") { /* título y subtítulo vacíos conservan los de siempre */ } else { c.title = ""; c.text = ""; }
    if (!c.imageMobile) delete c.imageMobile;
    if (heroDraft.isNew) {
      const base = slugify(c.name) || "campana";
      const taken = new Set(heroes().map((x) => x.id));
      let id = base;
      for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
      c.id = id;
      heroes().unshift(c);
    } else {
      heroes()[heroDraft.index] = c;
    }
    heroDraft = null;
    heroDialog.close();
    renderHeroList();
    toast("Campaña guardada. Publica los cambios para que se vea en la web.");
  });
  const closeHero = () => { heroDraft = null; heroDialog.close(); };
  $("#heroCancel").addEventListener("click", closeHero);
  $("#heroClose").addEventListener("click", closeHero);
  heroDialog.addEventListener("cancel", () => { heroDraft = null; });

  $("#heroCards").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    const li = e.target.closest(".hero-card");
    if (!btn || !li) return;
    const i = Number(li.dataset.i);
    const c = heroes()[i];
    if (btn.dataset.act === "edit") openHeroForm(i);
    if (btn.dataset.act === "toggle") { c.active = c.active === false; renderHeroList(); }
    if (btn.dataset.act === "del" && confirm(`¿Eliminar la campaña «${c.name}»? Esta acción no se puede deshacer (hasta que descartes los cambios sin publicar).`)) { heroes().splice(i, 1); renderHeroList(); }
  });
  $("#heroAdd").addEventListener("click", () => openHeroForm(null));

  // ---------------------------------------------------------------- Cupones de descuento
  const COUPON_MIN = "2025-01-01";
  const COUPON_MAX = `${new Date().getFullYear()}-12-31`; // máximo: el año actual
  const coupons = () => state.catalog.coupons;
  function renderCoupons() {
    $("#couponTable").innerHTML = `<thead><tr><th>Código</th><th>Descuento</th><th>Tiendas</th><th>Compra mínima (S/)</th><th>Vence</th><th>Activo</th><th></th></tr></thead><tbody>` +
      (coupons().length ? coupons().map((c, i) => `<tr data-i="${i}" class="${c.active === false ? "is-off" : ""}">
        <td><input type="text" data-f="code" value="${esc(c.code)}" maxlength="30" placeholder="BIENVENIDA10" aria-label="Código del cupón"></td>
        <td><select data-f="type" aria-label="Tipo de descuento"><option value="percent"${c.type === "percent" ? " selected" : ""}>%</option><option value="amount"${c.type === "amount" ? " selected" : ""}>S/</option></select>
            <input type="number" data-f="value" min="1" step="1" value="${c.value ?? ""}" aria-label="Valor del descuento"></td>
        <td><select data-f="shops" aria-label="Tiendas"><option value="both"${(c.shops || []).length !== 1 ? " selected" : ""}>Ambas</option><option value="maderin"${(c.shops || []).length === 1 && c.shops[0] === "maderin" ? " selected" : ""}>Maderin</option><option value="cdm"${(c.shops || []).length === 1 && c.shops[0] === "cdm" ? " selected" : ""}>CDM</option></select></td>
        <td><input type="number" data-f="minSubtotal" min="0" step="1" value="${c.minSubtotal || ""}" placeholder="0" aria-label="Compra mínima"></td>
        <td><input type="date" data-f="expires" value="${esc(c.expires || "")}" min="2025-01-01" max="${COUPON_MAX}" aria-label="Fecha de vencimiento"></td>
        <td><input type="checkbox" data-f="active"${c.active !== false ? " checked" : ""} aria-label="Cupón activo"></td>
        <td><button type="button" class="icon-btn" data-act="del" aria-label="Eliminar cupón">✕</button></td>
      </tr>`).join("") : `<tr><td colspan="7" class="muted">Aún no hay cupones. Agrega el primero.</td></tr>`) + "</tbody>";
    const active = coupons().filter((c) => c.active !== false).length;
    $("#couponSummary").textContent = `${coupons().length} cupones · ${active} activos. Un código vence al final del día indicado (hora de Lima); sin fecha, no vence.`;
    refreshDirty();
  }
  function readCouponRow(tr) {
    const c = coupons()[Number(tr.dataset.i)];
    if (!c) return;
    const get = (f) => tr.querySelector(`[data-f="${f}"]`);
    c.code = get("code").value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    c.type = get("type").value;
    c.value = Number(get("value").value) || 0;
    const sh = get("shops").value;
    c.shops = sh === "both" ? ["maderin", "cdm"] : [sh];
    c.minSubtotal = Number(get("minSubtotal").value) || 0;
    c.expires = get("expires").value;
    c.active = get("active").checked;
  }
  const couponSummary = () => {
    const active = coupons().filter((c) => c.active !== false).length;
    $("#couponSummary").textContent = `${coupons().length} cupones · ${active} activos. Un código vence al final del día indicado (hora de Lima); sin fecha, no vence.`;
    refreshDirty();
  };
  $("#couponTable").addEventListener("change", (e) => {
    const tr = e.target.closest("tr[data-i]");
    if (!tr) return;
    readCouponRow(tr);
    tr.classList.toggle("is-off", coupons()[Number(tr.dataset.i)].active === false);
    couponSummary();
  });
  // La fecha se corrige al salir del campo (no mientras se escribe el año): desde 2025 en adelante
  $("#couponTable").addEventListener("focusout", (e) => {
    const el = e.target;
    if (el.dataset.f !== "expires" || !el.value) return;
    if (el.value < COUPON_MIN) el.value = COUPON_MIN;
    else if (el.value > COUPON_MAX) el.value = COUPON_MAX;
    readCouponRow(el.closest("tr[data-i]"));
    couponSummary();
  });
  $("#couponTable").addEventListener("click", (e) => {
    const btn = e.target.closest('[data-act="del"]');
    const tr = btn && btn.closest("tr[data-i]");
    if (!tr) return;
    const c = coupons()[Number(tr.dataset.i)];
    if (!confirm(`¿Eliminar el cupón ${c.code || "(sin código)"}?`)) return;
    coupons().splice(Number(tr.dataset.i), 1);
    renderCoupons();
  });
  $("#couponAdd").addEventListener("click", () => {
    coupons().push({ code: "", type: "percent", value: 10, shops: ["maderin", "cdm"], minSubtotal: 0, expires: "", active: true });
    renderCoupons();
    const last = $$("#couponTable tbody tr").pop();
    if (last) last.querySelector('[data-f="code"]').focus();
  });
  // Se descartan las filas vacías al salir de la página o al publicar
  function cleanCoupons() { state.catalog.coupons = coupons().filter((c) => c.code && c.value > 0); refreshDirty(); }

  // ---------------------------------------------------------------- Costos de envío por distrito
  const DISTRICTS = ["Ancón", "Ate", "Barranco", "Breña", "Carabayllo", "Chaclacayo", "Chorrillos", "Cieneguilla", "Comas", "El Agustino",
    "Independencia", "Jesús María", "La Molina", "La Victoria", "Lima (Cercado)", "Lince", "Los Olivos", "Lurigancho (Chosica)", "Lurín",
    "Magdalena del Mar", "Miraflores", "Pachacámac", "Pucusana", "Pueblo Libre", "Puente Piedra", "Punta Hermosa", "Punta Negra", "Rímac",
    "San Bartolo", "San Borja", "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores", "San Luis", "San Martín de Porres",
    "San Miguel", "Santa Anita", "Santa María del Mar", "Santa Rosa", "Santiago de Surco", "Surquillo", "Villa El Salvador",
    "Villa María del Triunfo", "Bellavista", "Callao", "Carmen de la Legua Reynoso", "La Perla", "La Punta", "Mi Perú", "Ventanilla"];
  const shipView = $("#shipView");
  let shipShop = "maderin";
  const shipOf = () => (state.catalog.shipping[shipShop] = state.catalog.shipping[shipShop] || {});

  function renderShip() {
    const map = shipOf();
    $$("[data-ship]", shipView).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ship === shipShop)));
    let ok = 0, no = 0, bad = 0;
    $("#shipTable").innerHTML = `<thead><tr><th>Distrito</th><th>¿Se envía?</th><th>Costo (S/)</th><th>Observación</th></tr></thead><tbody>` +
      DISTRICTS.map((d) => {
        const v = map[d] || {};
        const val = v.ok === true ? "yes" : v.ok === false ? "no" : "";
        const missing = val === "yes" && !(Number(v.cost) >= 0 && v.cost !== null && v.cost !== "");
        if (val === "yes" && !missing) ok++; else if (val === "no") no++; else bad++;
        return `<tr data-d="${esc(d)}" class="${missing ? "is-bad" : val === "no" ? "is-no" : ""}">
          <td>${esc(d)}</td>
          <td><select aria-label="¿Se envía a ${esc(d)}?"><option value=""${val === "" ? " selected" : ""}>—</option><option value="yes"${val === "yes" ? " selected" : ""}>Sí</option><option value="no"${val === "no" ? " selected" : ""}>No</option></select></td>
          <td><input type="number" min="0" step="0.5" value="${v.cost ?? ""}" aria-label="Costo de envío a ${esc(d)}"${val !== "yes" ? " disabled" : ""}></td>
          <td><input type="text" maxlength="120" value="${esc(v.note || "")}" aria-label="Observación de ${esc(d)}"></td>
        </tr>`;
      }).join("") + "</tbody>";
    $("#shipSummary").textContent = `${ok} distritos con envío · ${no} sin envío · ${bad} pendientes o sin costo (no se podrán elegir en la tienda).`;
    refreshDirty();
  }
  function readShipRow(tr) {
    const sel = tr.querySelector("select").value;
    const costVal = tr.querySelector('input[type="number"]').value;
    const note = tr.querySelector('input[type="text"]').value.trim();
    const map = shipOf();
    if (!sel) { delete map[tr.dataset.d]; return; }
    map[tr.dataset.d] = { ok: sel === "yes", cost: sel === "yes" && costVal !== "" ? Number(costVal) : null, note };
  }
  $("#shipTable").addEventListener("change", (e) => {
    const tr = e.target.closest("tr[data-d]");
    if (!tr) return;
    readShipRow(tr);
    renderShip();
  });
  $$("[data-ship]", shipView).forEach((b) => b.addEventListener("click", () => { shipShop = b.dataset.ship; renderShip(); }));

  // Importar el Excel (hojas «Maderin» y «CDM» con columnas Distrito, ¿Se envía?, Costo de envío, Observación)
  let xlsxPromise = null;
  const loadXlsx = () => xlsxPromise || (xlsxPromise = new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    sc.onload = () => resolve(window.XLSX);
    sc.onerror = () => { xlsxPromise = null; reject(new Error("No se pudo cargar el lector de Excel (revisa tu conexión)")); };
    document.head.appendChild(sc);
  }));
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  async function importShippingFile(file) {
    const XLSX = await loadXlsx();
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const found = {};
    for (const [key, label] of [["maderin", "maderin"], ["cdm", "cdm"]]) {
      const name = wb.SheetNames.find((n) => norm(n) === label);
      if (!name) continue;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
      const head = rows.findIndex((r) => r.some((c) => norm(c) === "distrito"));
      if (head < 0) continue;
      const col = (needle) => rows[head].findIndex((c) => norm(c).includes(needle));
      const cD = col("distrito"), cS = col("envia"), cC = col("costo"), cN = col("observ");
      if (cD < 0 || cS < 0 || cC < 0) continue;
      const map = {};
      let ok = 0, no = 0, pending = 0;
      for (const r of rows.slice(head + 1)) {
        const dist = DISTRICTS.find((d) => norm(d) === norm(r[cD]));
        if (!dist) continue;
        const sel = norm(r[cS]);
        const cost = r[cC] === "" ? null : Number(r[cC]);
        if (sel === "si" && cost !== null && Number.isFinite(cost) && cost >= 0) { map[dist] = { ok: true, cost, note: String(r[cN] ?? "").trim() }; ok++; }
        else if (sel === "no") { map[dist] = { ok: false, cost: null, note: String(r[cN] ?? "").trim() }; no++; }
        else pending++;
      }
      found[key] = { map, ok, no, pending };
    }
    if (!Object.keys(found).length) throw new Error("No encontré las hojas «Maderin» o «CDM» con sus columnas.");
    for (const [key, v] of Object.entries(found)) state.catalog.shipping[key] = v.map;
    renderShip();
    return Object.entries(found).map(([k, v]) => `${SHOP_LABEL[k]}: ${v.ok} con envío, ${v.no} sin envío${v.pending ? `, ${v.pending} sin completar` : ""}`).join(" · ");
  }
  $("#shipInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const summary = await importShippingFile(file);
      toast(`Excel importado. ${summary}. Publica los cambios para aplicarlos.`);
    } catch (err) {
      toast(err.message, true);
    }
  });

  // ---------------------------------------------------------------- Carga
  function setLoading(text) {
    $("#loadingView").hidden = !text;
    if (text) $("#loadingText").textContent = text;
  }

  // Ojo para ver u ocultar la contraseña
  $("#pwToggle").addEventListener("click", () => {
    const input = $("#loginPassword");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    const btn = $("#pwToggle");
    btn.setAttribute("aria-pressed", String(show));
    btn.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    btn.title = btn.getAttribute("aria-label");
    $(".icon-eye", btn).hidden = show;
    $(".icon-eye-off", btn).hidden = !show;
    input.focus();
  });

  // ---------------------------------------------------------------- Acceso
  function showLogin(keepState) {
    setLoading(false);
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    $("#loginPassword").value = "";
    $("#loginPassword").type = "password";
    $("#pwToggle").setAttribute("aria-pressed", "false");
    $(".icon-eye", $("#pwToggle")).hidden = false;
    $(".icon-eye-off", $("#pwToggle")).hidden = true;
    if (!keepState) state.saved = "";
    $("#loginPassword").focus();
  }

  async function enterApp(storage) {
    setLoading("Cargando catálogo…");
    state.storage = storage;
    const banner = $("#storageBanner");
    if (storage === "none") {
      banner.textContent = "Aún no está conectado el almacenamiento (Vercel Blob). Puedes explorar el panel, pero no podrás publicar hasta conectarlo.";
      banner.hidden = false;
    } else if (storage === "local") {
      banner.textContent = "Modo de prueba local: los cambios se guardan en la carpeta .data de este equipo, no en la web publicada.";
      banner.hidden = false;
    } else banner.hidden = true;

    if (!state.saved) {
      let remote = null;
      try { remote = await api("catalog"); } catch (e) { /* usa los valores originales */ }
      state.catalog = {
        maderin: remote && Array.isArray(remote.maderin) ? C.normalize(remote.maderin, "maderin") : C.defaultsFor("maderin"),
        cdm: remote && Array.isArray(remote.cdm) ? C.normalize(remote.cdm, "cdm") : C.defaultsFor("cdm"),
        textures: remote && Array.isArray(remote.textures) ? remote.textures : [],
        shipping: { maderin: {}, cdm: {}, ...(remote && remote.shipping && typeof remote.shipping === "object" ? remote.shipping : {}) },
        coupons: remote && Array.isArray(remote.coupons) ? remote.coupons : [],
        heroes: remote && Array.isArray(remote.heroes) ? remote.heroes : []
      };
      syncTextures();
      state.saved = snapshot();
    }
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    setShop(state.shop);
    setLoading(false);
    // Avisa en la pestaña Pedidos si hay pagos por confirmar
    api("orders").then((r) => { state.orders = r.orders || []; renderOrders(); }).catch(() => {});
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginBtn");
    const err = $("#loginError");
    err.hidden = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Entrando…';
    try {
      await api("login", { method: "POST", body: { password: $("#loginPassword").value } });
      const s = await api("session");
      await enterApp(s.storage);
    } catch (ex) {
      setLoading(false);
      err.textContent = ex.message;
      err.hidden = false;
      $("#loginPassword").select();
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    if (isDirty() && !confirm("Tienes cambios sin publicar. ¿Salir de todas formas?")) return;
    try { await api("logout", { method: "POST", body: {} }); } catch (e) { /* ya sin sesión */ }
    state.saved = "";
    showLogin();
  });

  (async function init() {
    try {
      const s = await api("session");
      if (s.authenticated) return enterApp(s.storage);
      if (!s.configured) {
        $("#loginError").textContent = "Falta definir la variable ADMIN_PASSWORD en el servidor.";
        $("#loginError").hidden = false;
      }
    } catch (e) {
      $("#loginError").textContent = "No pude conectar con el servidor.";
      $("#loginError").hidden = false;
    }
    setLoading(false);
    $("#loginView").hidden = false;
    $("#loginPassword").focus();
  })();
})();
