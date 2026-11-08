// ============================================================
// Campañas del hero (promociones por temporada), administradas desde /admin → Heros.
// Sirve para las tres páginas (AC Mueblería, Maderin y Corazón de Madera): cambia la imagen de fondo y,
// según el modo, los textos del hero o lo reemplaza por un banner completo.
// - Se aplica al instante desde la caché local (sin parpadeo) y se actualiza en segundo plano.
// - Si no hay campaña vigente, el hero se queda como está.
// Va justo después del </header> del hero para ejecutarse antes del primer pintado.
// ============================================================
(function () {
  var hero = document.querySelector("header.hero");
  if (!hero) return;
  var cls = document.body.classList;
  var shop = cls.contains("theme-maderin") ? "maderin" : cls.contains("theme-cdm") ? "cdm" : "ac";
  var KEY = "heroCampaign:" + shop;
  var picture = hero.querySelector(".hero-bg picture");
  var h1 = hero.querySelector(".hero-copy h1");
  var lede = hero.querySelector(".hero-copy .section-lede");
  var cta = hero.querySelector(".hero-actions .btn-wa");
  if (!picture) return;

  var original = null; // hero original, para volver a él si la campaña termina
  var current = null;

  // Fecha de hoy en Lima (UTC-5), AAAA-MM-DD
  function today() { return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10); }
  function live(c) { var t = today(); return !!c && (!c.start || c.start <= t) && (!c.end || c.end >= t); }
  var same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

  function snapshot() {
    if (original) return;
    original = {
      picture: picture.innerHTML,
      h1: h1 ? h1.innerHTML : "",
      lede: lede ? lede.innerHTML : "",
      cta: cta ? { text: cta.textContent, href: cta.getAttribute("href") } : null
    };
  }
  function clearExtras() {
    var old = hero.querySelector(".hero-campaign-cta");
    if (old) old.remove();
    hero.classList.remove("hero--campaign", "hero--banner", "hero--promo", "hero--swap", "hero--has-mobile");
  }
  function setLink(a, url) {
    a.setAttribute("href", url);
    if (/^https:/i.test(url)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
    else { a.removeAttribute("target"); a.removeAttribute("rel"); }
  }

  function reset() {
    if (!original) return;
    picture.innerHTML = original.picture;
    if (h1) h1.innerHTML = original.h1;
    if (lede) lede.innerHTML = original.lede;
    if (cta && original.cta) { cta.textContent = original.cta.text; setLink(cta, original.cta.href); }
    clearExtras();
    current = null;
  }

  function apply(c, animate) {
    snapshot();
    clearExtras();
    // Imagen: versión móvil (≤1024 px) opcional + versión de escritorio
    picture.textContent = "";
    if (c.imageMobile) {
      var src = document.createElement("source");
      src.setAttribute("media", "(max-width: 1024px)");
      src.setAttribute("srcset", c.imageMobile);
      picture.appendChild(src);
    }
    var img = document.createElement("img");
    img.className = "hero-bg-img";
    img.src = c.image;
    img.alt = c.alt || "";
    img.setAttribute("fetchpriority", "high");
    img.decoding = "async";
    picture.appendChild(img);

    hero.classList.add("hero--campaign", c.mode === "full" ? "hero--banner" : "hero--promo");
    if (animate) hero.classList.add("hero--swap");
    if (c.imageMobile) hero.classList.add("hero--has-mobile");

    if (c.mode === "full") {
      // Banner completo: la imagen ya trae su diseño; solo se agrega un botón si hay enlace
      if (c.ctaUrl) {
        var a = document.createElement("a");
        a.className = "btn btn-wa hero-campaign-cta";
        a.textContent = c.ctaLabel || "Ver más";
        setLink(a, c.ctaUrl);
        hero.appendChild(a);
      }
    } else {
      // Imagen con los textos del hero; cada texto vacío conserva el original
      if (c.title && h1) {
        h1.textContent = "";
        c.title.split("\n").forEach(function (line, i) {
          if (i) h1.appendChild(document.createElement("br"));
          h1.appendChild(document.createTextNode(line));
        });
      }
      if (c.text && lede) lede.textContent = c.text;
      if (cta) {
        if (c.ctaLabel) cta.textContent = c.ctaLabel;
        if (c.ctaUrl) setLink(cta, c.ctaUrl);
      }
    }
    current = c;
  }

  // 1) Caché local: se aplica de inmediato si todavía está vigente
  try {
    var cached = JSON.parse(localStorage.getItem(KEY));
    if (cached && live(cached)) apply(cached, false);
  } catch (e) { /* sin caché */ }

  // 2) Datos frescos en segundo plano
  fetch("/api/catalog?part=heroes", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var c = d && d.heroes ? d.heroes[shop] : null;
      try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); } catch (e) { /* ignorar */ }
      if (c && live(c)) { if (!current || !same(current, c)) apply(c, !current); }
      else if (current) reset();
    })
    .catch(function () { /* sin conexión: se queda como está */ });
})();
