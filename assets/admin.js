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
    catalog: { maderin: [], cdm: [] },
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

  function setShop(shop) {
    state.shop = shop;
    state.search = "";
    $("#searchInput").value = "";
    document.body.dataset.shop = shop;
    $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.shop === shop)));
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

  function colorRow(c = { name: "", hex: "#d8bc94" }) {
    const row = document.createElement("div");
    row.className = "color-row";
    row.innerHTML = `<input type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#d8bc94")}" aria-label="Color">
      <input type="text" value="${esc(c.name)}" maxlength="40" placeholder="Nombre del color" aria-label="Nombre del color">
      <button type="button" class="icon-btn" aria-label="Quitar color">✕</button>`;
    row.querySelector("button").addEventListener("click", () => row.remove());
    return row;
  }

  function updateDiscountPreview() {
    const price = f("price").value === "" ? null : Number(f("price").value);
    const old = f("oldPrice").value === "" ? null : Number(f("oldPrice").value);
    const el = $("#discountPreview");
    if (old !== null && price !== null && old > price) el.textContent = `En la tienda se mostrará: S/ ${price} (antes S/ ${old}) · Ahorra S/ ${old - price}`;
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
    if (shop === "maderin") {
      f("subtitle").value = isNew ? "" : base.subtitle;
      f("cardDesc").value = isNew ? "" : base.cardDesc;
      f("sku").value = base.sku || "";
      f("ageRange").value = isNew ? "" : (base.ageRange === "Por confirmar" ? "" : base.ageRange);
      f("dimensions").value = isNew ? "" : (base.dimensions === "Por confirmar" ? "" : base.dimensions);
      f("material").value = isNew ? "" : (base.material === "Por confirmar" ? "" : base.material);
      f("finish").value = isNew ? "" : (base.finish === "Por confirmar" ? "" : base.finish);
      f("rating").value = base.rating ?? "";
      f("reviewsCount").value = base.reviewsCount || "";
      const colorList = $("#colorList");
      colorList.innerHTML = "";
      const hasReal = base.colors.some((c) => c.name !== "Por definir");
      (hasReal ? base.colors : []).forEach((c) => colorList.appendChild(colorRow(c)));
    } else {
      f("unit").value = base.unit;
      f("spec1").value = base.specs[0] || "";
      f("spec2").value = base.specs[1] || "";
    }
    renderPhotoPreview(base);
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
      out.rating = f("rating").value === "" ? null : Number(f("rating").value);
      out.reviewsCount = f("reviewsCount").value === "" ? 0 : Number(f("reviewsCount").value);
      out.colors = $$(".color-row", editor).map((row) => ({
        hex: row.querySelector('input[type="color"]').value,
        name: row.querySelector('input[type="text"]').value.trim()
      })).filter((c) => c.name);
    } else {
      out.unit = f("unit").value.trim() || "unidad";
      out.specs = [f("spec1").value.trim(), f("spec2").value.trim()].filter(Boolean);
    }
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
    if (state.shop === "maderin" && out.rating !== null && (!Number.isFinite(out.rating) || out.rating < 0 || out.rating > 5)) { err.textContent = "La calificación debe estar entre 0 y 5."; err.hidden = false; return; }
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
    row.querySelector('input[type="text"]').focus();
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
    $("#photoMsg").textContent = "Foto quitada. Se mostrará el icono de la categoría.";
  });

  // ---------------------------------------------------------------- Nuevo, restaurar, descartar, publicar
  $("#newBtn").addEventListener("click", () => openEditor(null));
  $("#searchInput").addEventListener("input", (e) => { state.search = e.target.value; renderRows(); });
  $$(".tab").forEach((t) => t.addEventListener("click", () => setShop(t.dataset.shop)));

  $("#restoreBtn").addEventListener("click", () => {
    $(".more").open = false;
    if (!confirm(`¿Restaurar los productos originales de ${C.SHOPS[state.shop].label}? Se reemplaza toda la lista actual (hasta que publiques puedes descartar).`)) return;
    state.catalog[state.shop] = C.defaultsFor(state.shop);
    renderRows();
  });

  $("#discardBtn").addEventListener("click", () => {
    if (!confirm("¿Descartar todos los cambios sin publicar?")) return;
    state.catalog = JSON.parse(state.saved);
    renderRows();
  });

  $("#publishBtn").addEventListener("click", async () => {
    const btn = $("#publishBtn");
    btn.disabled = true;
    $("#saveStatus").textContent = "Publicando…";
    try {
      const res = await api("save", { method: "POST", body: { maderin: state.catalog.maderin, cdm: state.catalog.cdm } });
      state.catalog = {
        maderin: C.normalize(res.catalog.maderin, "maderin"),
        cdm: C.normalize(res.catalog.cdm, "cdm")
      };
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

  // ---------------------------------------------------------------- Acceso
  function showLogin(keepState) {
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    $("#loginPassword").value = "";
    if (!keepState) state.saved = "";
    $("#loginPassword").focus();
  }

  async function enterApp(storage) {
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
        cdm: remote && Array.isArray(remote.cdm) ? C.normalize(remote.cdm, "cdm") : C.defaultsFor("cdm")
      };
      state.saved = snapshot();
    }
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    setShop(state.shop);
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginBtn");
    const err = $("#loginError");
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = "Entrando…";
    try {
      await api("login", { method: "POST", body: { password: $("#loginPassword").value } });
      const s = await api("session");
      await enterApp(s.storage);
    } catch (ex) {
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
    $("#loginView").hidden = false;
    $("#loginPassword").focus();
  })();
})();
