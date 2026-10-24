// ============================================================
// AC Mueblería — lógica compartida (nav, WhatsApp, filtros, reveal)
// ============================================================

// TODO: reemplaza este número por el WhatsApp real del negocio (formato: 51XXXXXXXXX, sin "+")
const WHATSAPP_NUMBER = "51943613883";

function waLink(message){
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function openWhatsApp(message){
  window.open(waLink(message), "_blank", "noopener");
}

// --- Nav móvil ---
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links){
    // Abre/cierra el menú; en móvil el panel es a pantalla completa, así que se bloquea el scroll del fondo
    const setMenu = (open) => {
      links.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      document.body.classList.toggle("nav-open", open);
    };
    toggle.addEventListener("click", () => setMenu(!links.classList.contains("open")));
    links.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setMenu(false)));
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
    window.addEventListener("resize", () => { if (window.innerWidth > 860) setMenu(false); });
  }

  // --- Fallback para imágenes no encontradas ---
  document.querySelectorAll("img").forEach(img => {
    img.addEventListener("error", function() {
      if (!this.getAttribute("data-fallback-applied")) {
        this.setAttribute("data-fallback-applied", "true");
        this.src = "assets/workshop_placeholder.jpg";
      }
    });
  });

  // --- Botón flotante de WhatsApp: mensaje genérico ---
  const waFloat = document.querySelector("[data-wa-float]");
  if (waFloat){
    waFloat.href = waLink(waFloat.getAttribute("data-wa-message") || "Hola, quiero más información.");
  }

  // --- Botones con data-wa-message (CTAs de texto) ---
  document.querySelectorAll("[data-wa-message]:not([data-wa-float])").forEach(el => {
    if (el.tagName === "A"){
      el.href = waLink(el.getAttribute("data-wa-message"));
      el.target = "_blank";
      el.rel = "noopener";
    } else {
      el.addEventListener("click", () => openWhatsApp(el.getAttribute("data-wa-message")));
    }
  });

  // --- Filtro de categorías (portafolio / catálogo) ---
  const chips = document.querySelectorAll(".filter-chip:not(#maderinFilters .filter-chip)");
  const cards = document.querySelectorAll("#worksCarouselTrack [data-category], .catalog-grid:not(#maderinProductGrid) [data-category]");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const cat = chip.getAttribute("data-filter");
      let visibleIdx = 0;
      cards.forEach(card => {
        const show = cat === "todos" || card.getAttribute("data-category") === cat;
        card.style.display = show ? "" : "none";
        if (show && card.classList.contains("reveal")) {
          card.classList.add("in-view");
          card.style.transitionDelay = `${(visibleIdx % 4) * 60}ms`;
          visibleIdx++;
        }
      });
    });
  });

  // --- Reveal suave al hacer scroll (IntersectionObserver) ---
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

    revealEls.forEach(el => {
      // Auto-escalonamiento suave para tarjetas en grilla y badges
      if (el.classList.contains("feature-card") || el.classList.contains("product-card") || el.classList.contains("hero-badge")) {
        const parent = el.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(c => c.classList.contains("reveal"));
          const siblingIndex = siblings.indexOf(el);
          if (siblingIndex > 0) {
            el.style.transitionDelay = `${(siblingIndex % 6) * 80}ms`;
          }
        }
      }
      io.observe(el);
    });
  } else {
    revealEls.forEach(el => el.classList.add("in-view"));
  }

  // --- Sombra de nav y botón Volver Arriba al hacer scroll ---
  const nav = document.querySelector(".nav");
  const backToTop = document.getElementById("backToTop");

  window.addEventListener("scroll", () => {
    const scrollY = window.scrollY;
    if (nav) {
      nav.style.boxShadow = scrollY > 8 ? "0 8px 24px -18px rgba(0,0,0,.6)" : "none";
    }
    if (backToTop) {
      if (scrollY > 320) {
        backToTop.classList.add("show");
      } else {
        backToTop.classList.remove("show");
      }
    }
  });

  if (backToTop) {
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // --- Animación de conteo y texto en Hero Badges ---
  function initHeroCounters() {
    const counterEls = document.querySelectorAll(".hero-counter");
    const textEls = document.querySelectorAll(".hero-counter-text");

    // 1. Contadores numéricos (+300, 100%)
    counterEls.forEach(el => {
      const target = parseInt(el.getAttribute("data-target"), 10);
      const prefix = el.getAttribute("data-prefix") || "";
      const suffix = el.getAttribute("data-suffix") || "";
      if (isNaN(target)) return;

      const obj = { val: 0 };
      if (typeof gsap !== "undefined") {
        gsap.to(obj, {
          val: target,
          duration: 1.8,
          delay: 0.3,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = `${prefix}${Math.floor(obj.val)}${suffix}`;
          }
        });
      } else {
        const startTime = performance.now();
        const duration = 1800;
        function update(now) {
          const progress = Math.min((now - startTime) / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 3);
          el.textContent = `${prefix}${Math.floor(easeOut * target)}${suffix}`;
          if (progress < 1) requestAnimationFrame(update);
        }
        setTimeout(() => requestAnimationFrame(update), 300);
      }
    });

    // 2. Animación de texto "a medida" (revelado tipográfico fluido)
    textEls.forEach(el => {
      const fullText = el.getAttribute("data-text") || el.textContent.trim();
      el.textContent = "";
      let charIdx = 0;
      setTimeout(() => {
        const interval = setInterval(() => {
          if (charIdx <= fullText.length) {
            el.textContent = fullText.slice(0, charIdx);
            charIdx++;
          } else {
            clearInterval(interval);
          }
        }, 85);
      }, 400);
    });
  }

  initHeroCounters();

  // --- Carrusel de Fotos y Modal Emergente de Proyectos (Trabajos Realizados) ---
  function initWorksCarouselAndModal() {
    const carouselWrapper = document.getElementById("worksCarouselWrapper");
    const viewport = document.getElementById("worksCarouselViewport");
    const track = document.getElementById("worksCarouselTrack");
    const prevBtn = document.getElementById("carouselPrevBtn");
    const nextBtn = document.getElementById("carouselNextBtn");
    const dotsContainer = document.getElementById("carouselDots");
    const modal = document.getElementById("projectModal");

    if (!carouselWrapper || !viewport || !track) return;

    const cards = Array.from(track.querySelectorAll(".project-card"));
    if (!cards.length) return;

    const projectsData = [
      {
        index: 0,
        category: "Cocinas",
        counter: "01 / 06",
        title: "Cocina en L",
        subtitle: "Melamina Capri + Cuarzo negro",
        desc: "Módulos altos y bajos en melamina Capri RH resistente a la humedad, tiradores invisibles y cubierta de Cuarzo negro brillante.",
        location: "Independencia",
        dimensions: "2.20 mt x 2.80 mt",
        material: "Melamina Capri RH 18mm",
        finish: "Wall panel & Cuarzo",
        img: "public/ac_muebleria/trabajos/cocina-01.png",
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Cocina en L (Capri + Cuarzo negro).",
        filter: "cocinas",
        price: "Desde S/ 6,500",
        time: "15 días",
        install: "8 días",
        cta: "Quiero una cocina así"
      },
      {
        index: 1,
        category: "Closets & Vestidores",
        counter: "02 / 06",
        title: "Closet modular",
        subtitle: "Melamina Toquilla + Jaladores de bronce",
        desc: "Closet integral con iluminación LED interna, sabanera superior, cajonera con correderas telescópicas y doble zona de percheros.",
        location: "Los Olivos",
        dimensions: "1.80 mt × 2.40 mt × 60 cm",
        material: "Melamina Toquilla 18mm",
        finish: "Jaladores bronce + LED",
        img: "public/ac_muebleria/trabajos/vestidor-01.png",
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Closet modular (Toquilla).",
        filter: "closets",
        price: "Desde S/ 1,800",
        time: "10 días",
        install: "4 días",
        cta: "Quiero un closet así"
      },
      {
        index: 2,
        category: "Muebles de TV",
        counter: "03 / 06",
        title: "Mueble de TV flotante",
        subtitle: "Melamina blanca + Wall panel",
        desc: "Centro de entretenimiento flotante, compartimentos abiertos y cerrados. Wall panel y panel decorativo con tiras LED.",
        location: "SJL",
        dimensions: "2.40 mt × 40 cm × 45 cm",
        material: "Melamina Blanca Mate",
        finish: "Panel SPC + Wall panel",
        img: "public/ac_muebleria/trabajos/mueble-tv-01.png",
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Mueble de TV flotante con Wall panel.",
        filter: "tv",
        price: "Desde S/ 1,500",
        time: "5 días",
        install: "3 días",
        cta: "Quiero un mueble de TV así"
      },
      {
        index: 3,
        category: "Organizadores",
        counter: "04 / 06",
        title: "Mueble organizador",
        subtitle: "Melamina Blanca + Duna",
        desc: "Mueble a medida para almacenaje debajo de escalera y recibidor elegante con distribución inteligente de gavetas y repisas.",
        location: "Comas",
        dimensions: "1.40 mt × 1.80 mt × 1.00 mt",
        material: "Melamina Blanca 18mm",
        finish: "Jaladores negros mate",
        img: "public/ac_muebleria/trabajos/organizador-01.png",
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Mueble organizador bajo escalera.",
        filter: "organizadores",
        price: "Desde S/ 1,000",
        time: "5 días",
        install: "2 días",
        cta: "Quiero un organizador así"
      },
      {
        index: 4,
        category: "Oficinas",
        counter: "05 / 06",
        title: "Módulos de oficina",
        subtitle: "Melamina Espresso + Plomo",
        desc: "Estación de trabajo ergonómica con escritorio en L, archivador móvil, cajonera y repisas superiores con acabados de alta resistencia.",
        location: "Carabayllo",
        dimensions: "3.20 mt × 2.50 mt",
        material: "Melamina Espresso + Plomo",
        finish: "Tablero regrueso 36 mm",
        img: "public/ac_muebleria/trabajos/escritorio-01.png",
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Módulos de oficina.",
        filter: "oficinas",
        price: "Desde S/ 2,500",
        time: "10 días",
        install: "5 días",
        cta: "Quiero una oficina así"
      },
      {
        index: 5,
        category: "Bares & Cocinas",
        counter: "06 / 06",
        title: "Mueble bar",
        subtitle: "Melamina Espresso + Cuarzo negro",
        desc: "Mueble bar residencial con iluminación LED perimetral, vitrinas con puertas vidriadas y bisagras con sistema de cierre suave.",
        location: "La Molina",
        dimensions: "1.80 mt × 2.40 mt × 50 cm",
        material: "Melamina Espresso + Gris",
        finish: "Puertas de vidrio + Cuarzo",
        img: "public/ac_muebleria/trabajos/isla-cocina-01.png",
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Mueble bar con vitrinas vidriadas.",
        filter: "cocinas",
        price: "Desde S/ 2,000",
        time: "8 días",
        install: "3 días",
        cta: "Quiero un mueble bar así"
      }
    ];

    let currentActiveIndex = 0;
    let modalCurrentIndex = 0;

    // Tarjetas visibles según el filtro activo (posición en este arreglo = posición en dots y modal)
    let visibleCards = cards.slice();
    let carouselDots = [];

    // --- 1. Generación y sincronización de dots del carrusel ---
    function buildCarouselDots() {
      if (!dotsContainer) return;
      dotsContainer.innerHTML = "";
      visibleCards.forEach((card, idx) => {
        const dot = document.createElement("button");
        dot.className = `carousel-dot ${idx === 0 ? "active" : ""}`;
        dot.setAttribute("aria-label", `Ir al proyecto ${idx + 1}`);
        dot.setAttribute("data-index", idx);
        dot.addEventListener("click", () => {
          scrollToCard(idx);
        });
        dotsContainer.appendChild(dot);
      });
      carouselDots = Array.from(dotsContainer.querySelectorAll(".carousel-dot"));
    }
    buildCarouselDots();

    function updateActiveDot(index) {
      currentActiveIndex = Math.max(0, Math.min(index, visibleCards.length - 1));
      carouselDots.forEach((dot, idx) => {
        dot.classList.toggle("active", idx === currentActiveIndex);
      });
    }

    function scrollToCard(index) {
      const targetCard = visibleCards[index];
      if (!targetCard) return;
      const targetLeft = targetCard.offsetLeft - viewport.offsetLeft;
      viewport.scrollTo({
        left: targetLeft,
        behavior: "smooth"
      });
      updateActiveDot(index);
    }

    // Navegación con flechas Prev / Next del carrusel (flotantes y barra inferior)
    function getCardScrollStep() {
      const cardWidth = (visibleCards[0] || cards[0]).offsetWidth;
      const gap = parseInt(window.getComputedStyle(track).gap, 10) || 16;
      return cardWidth + gap;
    }

    function handleScrollPrev() {
      const step = getCardScrollStep();
      viewport.scrollBy({ left: -step, behavior: "smooth" });
    }

    function handleScrollNext() {
      const step = getCardScrollStep();
      viewport.scrollBy({ left: step, behavior: "smooth" });
    }

    if (prevBtn) prevBtn.addEventListener("click", handleScrollPrev);
    if (nextBtn) nextBtn.addEventListener("click", handleScrollNext);

    // Sincronizar dots al hacer scroll con debounce
    let scrollTimeout = null;
    viewport.addEventListener("scroll", () => {
      if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
      scrollTimeout = requestAnimationFrame(() => {
        const scrollLeft = viewport.scrollLeft;
        const step = getCardScrollStep();
        const activeIdx = Math.round(scrollLeft / step);
        updateActiveDot(activeIdx);
      });
    }, { passive: true });

    // Drag-to-scroll con mouse en desktop
    let isMouseDown = false;
    let startX = 0;
    let scrollLeftStart = 0;
    let hasDragged = false;

    viewport.addEventListener("mousedown", (e) => {
      isMouseDown = true;
      hasDragged = false;
      startX = e.pageX - viewport.offsetLeft;
      scrollLeftStart = viewport.scrollLeft;
    });

    window.addEventListener("mouseup", () => {
      isMouseDown = false;
    });

    viewport.addEventListener("mousemove", (e) => {
      if (!isMouseDown) return;
      e.preventDefault();
      const x = e.pageX - viewport.offsetLeft;
      const walk = (x - startX) * 1.4;
      if (Math.abs(walk) > 5) {
        hasDragged = true;
      }
      viewport.scrollLeft = scrollLeftStart - walk;
    });

    // --- 2. Modal Emergente de Proyectos ---
    const backdrop = document.getElementById("projectModalBackdrop");
    const closeBtn = document.getElementById("modalCloseBtn");
    const modalImg = document.getElementById("modalImg");
    const modalCategory = document.getElementById("modalCategory");
    const modalCounter = document.getElementById("modalCounter");
    const modalProjectTitle = document.getElementById("modalProjectTitle");
    const modalProjectSubtitle = document.getElementById("modalProjectSubtitle");
    const modalDesc = document.getElementById("modalDesc");
    const modalLocation = document.getElementById("modalLocation");
    const modalDimensions = document.getElementById("modalDimensions");
    const modalMaterial = document.getElementById("modalMaterial");
    const modalFinish = document.getElementById("modalFinish");
    const modalWaBtn = document.getElementById("modalWaBtn");
    const modalPrevBtn = document.getElementById("modalPrevBtn");
    const modalNextBtn = document.getElementById("modalNextBtn");
    const modalNavDotsContainer = document.getElementById("modalNavDots");

    const modalPrice = document.getElementById("modalPrice");
    const modalTime = document.getElementById("modalTime");
    const modalInstall = document.getElementById("modalInstall");
    const modalWaLabel = document.getElementById("modalWaLabel");

    // Crear dots internos del modal (uno por proyecto visible)
    let modalNavDots = [];
    function buildModalDots() {
      if (!modalNavDotsContainer) return;
      modalNavDotsContainer.innerHTML = "";
      visibleCards.forEach((_, idx) => {
        const mDot = document.createElement("button");
        mDot.className = `modal-nav-dot ${idx === 0 ? "active" : ""}`;
        mDot.setAttribute("aria-label", `Ver proyecto ${idx + 1}`);
        mDot.addEventListener("click", () => populateModal(idx, idx > modalCurrentIndex ? "next" : "prev"));
        modalNavDotsContainer.appendChild(mDot);
      });
      modalNavDots = Array.from(modalNavDotsContainer.querySelectorAll(".modal-nav-dot"));
    }
    buildModalDots();

    const pad2 = (n) => String(n).padStart(2, "0");

    function populateModal(index, direction = "next") {
      modalCurrentIndex = (index + visibleCards.length) % visibleCards.length;
      const data = projectsData[Number(visibleCards[modalCurrentIndex].dataset.index)];
      if (!data) return;

      // Actualizar datos
      if (modalCategory) modalCategory.textContent = data.category;
      if (modalCounter) modalCounter.textContent = `${pad2(modalCurrentIndex + 1)} / ${pad2(visibleCards.length)}`;
      if (modalPrice) modalPrice.textContent = data.price.replace(/^Desde\s*/, "");
      if (modalTime) modalTime.textContent = data.time;
      if (modalInstall) modalInstall.textContent = data.install;
      if (modalWaLabel) modalWaLabel.textContent = "Cotizar por WhatsApp";
      if (modalProjectTitle) modalProjectTitle.textContent = data.title;
      if (modalProjectSubtitle) modalProjectSubtitle.textContent = data.subtitle;
      if (modalDesc) modalDesc.textContent = data.desc;
      if (modalLocation) modalLocation.textContent = data.location;
      if (modalDimensions) modalDimensions.textContent = data.dimensions;
      if (modalMaterial) modalMaterial.textContent = data.material;
      if (modalFinish) modalFinish.textContent = data.finish;
      if (modalWaBtn) modalWaBtn.href = waLink(`${data.waText} ${data.cta}.`);

      // Transición de imagen
      if (modalImg) {
        modalImg.style.opacity = "0.4";
        modalImg.style.transform = direction === "next" ? "scale(0.97)" : "scale(1.03)";
        setTimeout(() => {
          modalImg.src = data.img;
          modalImg.alt = `${data.title} | ${data.subtitle}`;
          modalImg.style.opacity = "1";
          modalImg.style.transform = "scale(1)";
        }, 150);
      }

      // Actualizar dots del modal
      modalNavDots.forEach((dot, idx) => {
        dot.classList.toggle("active", idx === modalCurrentIndex);
      });
    }

    function openModal(index) {
      if (!modal) return;
      populateModal(index);
      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");

      // Enfocar el modal para accesibilidad
      if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
      if (!modal) return;
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

    // Eventos de click en tarjetas del carrusel para abrir el modal
    cards.forEach((card) => {
      card.addEventListener("click", (e) => {
        if (hasDragged) return; // Evitar abrir si fue un drag
        openModal(visibleCards.indexOf(card));
      });

      // Soporte para teclado (Enter / Espacio)
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(visibleCards.indexOf(card));
        }
      });
    });

    // --- 3. Entrada escalonada de tarjetas (al aparecer la sección y al filtrar) ---
    function animateCardsIn() {
      visibleCards.forEach((card, i) => {
        card.style.setProperty("--i", i);
        card.classList.remove("card-enter");
        void card.offsetWidth; // reinicia la animación
        card.classList.add("card-enter");
      });
    }

    if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      carouselWrapper.classList.add("cards-pending");
      const enterObserver = new IntersectionObserver((entries) => {
        if (!entries.some((en) => en.isIntersecting)) return;
        enterObserver.disconnect();
        animateCardsIn();
        carouselWrapper.classList.remove("cards-pending");
      }, { threshold: 0.2 });
      enterObserver.observe(carouselWrapper);
    }

    // --- 4. Filtros por tipo de proyecto ---
    const filterBar = document.getElementById("worksFilters");
    if (filterBar) {
      const filterBtns = Array.from(filterBar.querySelectorAll(".filter-chip"));
      filterBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const filter = btn.dataset.filter;
          filterBtns.forEach((b) => {
            const on = b === btn;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
          });
          cards.forEach((card) => {
            card.hidden = !(filter === "all" || card.dataset.filter === filter);
          });
          visibleCards = cards.filter((card) => !card.hidden);
          animateCardsIn();
          viewport.scrollTo({ left: 0, behavior: "auto" });
          buildCarouselDots();
          buildModalDots();
          updateActiveDot(0);
        });
      });
    }

    // Cerrar modal
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (backdrop) backdrop.addEventListener("click", closeModal);

    // Navegación dentro del modal
    if (modalPrevBtn) {
      modalPrevBtn.addEventListener("click", () => {
        populateModal(modalCurrentIndex - 1, "prev");
      });
    }

    if (modalNextBtn) {
      modalNextBtn.addEventListener("click", () => {
        populateModal(modalCurrentIndex + 1, "next");
      });
    }

    // Teclado global: Esc para cerrar modal, Flechas para navegar proyectos cuando el modal está abierto
    window.addEventListener("keydown", (e) => {
      if (modal && modal.classList.contains("active")) {
        if (e.key === "Escape") {
          closeModal();
        } else if (e.key === "ArrowLeft") {
          populateModal(modalCurrentIndex - 1, "prev");
        } else if (e.key === "ArrowRight") {
          populateModal(modalCurrentIndex + 1, "next");
        }
      }
    });

    // Soporte táctil / swipe dentro del modal en móviles
    let modalTouchStartX = 0;
    const modalDialog = modal ? modal.querySelector(".project-modal-dialog") : null;
    if (modalDialog) {
      modalDialog.addEventListener("touchstart", (e) => {
        if (e.touches && e.touches[0]) {
          modalTouchStartX = e.touches[0].clientX;
        }
      }, { passive: true });

      modalDialog.addEventListener("touchend", (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          const diffX = e.changedTouches[0].clientX - modalTouchStartX;
          if (Math.abs(diffX) > 50) {
            if (diffX < 0) {
              populateModal(modalCurrentIndex + 1, "next");
            } else {
              populateModal(modalCurrentIndex - 1, "prev");
            }
          }
        }
      }, { passive: true });
    }
  }

  initWorksCarouselAndModal();

  // --- Lógica del timeline "Cómo trabajamos" (GSAP ScrollTrigger) ---
  // GSAP solo se carga en index.html; en las sub-marcas se omite este bloque
  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);

    ScrollTrigger.matchMedia({
      // Desktop (> 980px): Pin de la sección para recorrer y visualizar todos los pasos antes de avanzar
      "(min-width: 981px)": function() {
        // Reset de tarjetas de #elegirnos para desktop
        const featureCards = document.querySelectorAll("#elegirnos .feature-card");
        featureCards.forEach(card => {
          gsap.set(card, { clearProps: "all" });
          const img = card.querySelector(".feature-img");
          const h3 = card.querySelector("h3");
          const p = card.querySelector("p");
          if (img) gsap.set(img, { clearProps: "all" });
          if (h3) gsap.set(h3, { clearProps: "all" });
          if (p) gsap.set(p, { clearProps: "all" });
        });

        const procesoSection = document.getElementById("proceso");
        const hProgress = document.getElementById("processHProgress");
        const steps = document.querySelectorAll(".process-step");

        if (!procesoSection || !steps.length) return;

        // Reset inicial
        if (hProgress) gsap.set(hProgress, { width: "0%" });

        steps.forEach((step, idx) => {
          const dot = step.querySelector(".process-dot");
          const content = step.querySelector(".process-content");
          if (idx === 0) {
            gsap.set(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", scale: 1 });
            gsap.set(content, { opacity: 1, y: 0 });
          } else {
            gsap.set(dot, { borderColor: "rgba(255,255,255,0.08)", color: "rgba(242,236,223,0.6)", backgroundColor: "#1c1c1c", scale: 1 });
            gsap.set(content, { opacity: 0.35, y: 8 });
          }
        });

        const masterTl = gsap.timeline({
          scrollTrigger: {
            trigger: procesoSection,
            start: "top top",
            end: () => "+=" + Math.round(window.innerHeight * 1.1),
            pin: true,
            scrub: 0.5,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            fastScrollEnd: true,
            // Snap: se asienta en cada paso (1 scroll ≈ 1 paso)
            snap: {
              snapTo: [0, 0.1667, 0.3333, 0.5, 0.6667, 0.8333, 1],
              duration: { min: 0.15, max: 0.45 },
              delay: 0.04,
              ease: "power2.inOut",
              inertia: false,
            },
          }
        });

        // Pausa inicial: retiene el pin para ver el paso 1 antes de avanzar
        masterTl.to({}, { duration: 0.25 }, 0);

        // 1. Línea horizontal de progreso: avanza de 0% a 100% (tras la pausa inicial)
        if (hProgress) {
          masterTl.to(hProgress, {
            width: "100%",
            ease: "none",
            duration: 1.0,
          }, 0.25);
        }

        // 2. Activación secuencial: cada paso completa su fade justo en su punto de
        //    snap para que quede resaltado al asentar el scroll.
        // Paso 1 (01): activo desde el inicio (t=0)
        if (steps[0]) {
          const dot = steps[0].querySelector(".process-dot");
          const content = steps[0].querySelector(".process-content");
          masterTl.to(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", duration: 0.08 }, 0);
          masterTl.to(content, { opacity: 1, y: 0, duration: 0.12 }, 0);
        }

        // Paso 2 (02): termina de activarse en su punto de snap
        if (steps[1]) {
          const dot = steps[1].querySelector(".process-dot");
          const content = steps[1].querySelector(".process-content");
          masterTl.to(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", duration: 0.08 }, 0.42);
          masterTl.to(content, { opacity: 1, y: 0, duration: 0.12 }, 0.38);
        }

        // Paso 3 (03): termina de activarse en su punto de snap
        if (steps[2]) {
          const dot = steps[2].querySelector(".process-dot");
          const content = steps[2].querySelector(".process-content");
          masterTl.to(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", duration: 0.08 }, 0.67);
          masterTl.to(content, { opacity: 1, y: 0, duration: 0.12 }, 0.63);
        }

        // Paso 4 (04): termina de activarse en su punto de snap
        if (steps[3]) {
          const dot = steps[3].querySelector(".process-dot");
          const content = steps[3].querySelector(".process-content");
          masterTl.to(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", duration: 0.08 }, 0.92);
          masterTl.to(content, { opacity: 1, y: 0, duration: 0.12 }, 0.88);
        }

        // Paso 5 (05): termina de activarse en su punto de snap (t=1.25 del timeline)
        if (steps[4]) {
          const dot = steps[4].querySelector(".process-dot");
          const content = steps[4].querySelector(".process-content");
          masterTl.to(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", duration: 0.08 }, 1.17);
          masterTl.to(content, { opacity: 1, y: 0, duration: 0.12 }, 1.13);
        }

        // Pausa final: deja ver el proceso completo antes de soltar el pin
        masterTl.to({}, { duration: 0.25 });
      },

      // Mobile y Tablet (<= 980px): scroll vertical fluido con animación card-por-card en #elegirnos y seguimiento en #proceso
      "(max-width: 980px)": function() {
        // --- 1. Animación secuencial de tarjetas en vertical para #elegirnos ---
        const featureCards = document.querySelectorAll("#elegirnos .feature-card");

        featureCards.forEach((card) => {
          gsap.set(card, { clearProps: "all" });
          const img = card.querySelector(".feature-img");
          const h3 = card.querySelector("h3");
          const p = card.querySelector("p");
          if (img) gsap.set(img, { clearProps: "all" });
          if (h3) gsap.set(h3, { clearProps: "all" });
          if (p) gsap.set(p, { clearProps: "all" });

          // Animación de entrada suave tipo tarjeta con scrollTrigger
          gsap.fromTo(card,
            { y: 35, opacity: 0.15, scale: 0.97 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.75,
              ease: "power2.out",
              scrollTrigger: {
                trigger: card,
                start: "top 88%",
                toggleActions: "play none none none",
                invalidateOnRefresh: true,
              }
            }
          );
        });

        // --- 2. Timeline vertical en #proceso ---
        const timeline = document.querySelector(".process-timeline-container");
        const vProgress = document.getElementById("processProgress");
        const steps = document.querySelectorAll(".process-step");

        if (!timeline || !steps.length) return;

        // Reset inicial
        if (vProgress) gsap.set(vProgress, { height: "0%" });

        // Progreso vertical fluido con scrub sincronizado
        if (vProgress) {
          gsap.fromTo(vProgress, 
            { height: "0%" },
            {
              height: "100%",
              ease: "none",
              scrollTrigger: {
                trigger: timeline,
                start: "top 70%",
                end: "bottom 60%",
                scrub: 0.2,
                invalidateOnRefresh: true,
              }
            }
          );
        }

        // Activación y seguimiento sincronizado de cada paso
        steps.forEach((step, idx) => {
          const dot = step.querySelector(".process-dot");
          const content = step.querySelector(".process-content");

          // Estado inicial
          if (idx === 0) {
            gsap.set(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", scale: 1 });
            gsap.set(content, { opacity: 1, y: 0 });
          } else {
            gsap.set(dot, { borderColor: "rgba(255,255,255,0.08)", color: "rgba(242,236,223,0.6)", backgroundColor: "#1c1c1c", scale: 1 });
            gsap.set(content, { opacity: 0.35, y: 8 });
          }

          ScrollTrigger.create({
            trigger: step,
            start: "top 68%",
            onEnter: () => {
              gsap.to(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", scale: 1.06, duration: 0.3 });
              gsap.to(content, { opacity: 1, y: 0, duration: 0.35 });
            },
            onLeaveBack: () => {
              if (idx !== 0) {
                gsap.to(dot, { borderColor: "rgba(255,255,255,0.08)", color: "rgba(242,236,223,0.6)", backgroundColor: "#1c1c1c", scale: 1, duration: 0.25 });
                gsap.to(content, { opacity: 0.35, y: 8, duration: 0.25 });
              }
            }
          });
        });
      }
    });
  }

  // ==========================================================================
  // MADERIN: CATÁLOGO INFANTIL E-COMMERCE & MODAL INTERACTIVO
  // ==========================================================================
  async function initMaderinEcommerce() {
    const grid = document.getElementById("maderinProductGrid");
    const modal = document.getElementById("maderinProductModal");
    if (!grid || !modal) return;

    // Catálogo: lo publicado desde /admin (o los valores originales de assets/catalog.js si no hay nada guardado).
    // Los productos ocultos no aparecen en la tienda.
    const maderinProducts = (await window.ACCatalog.load("maderin")).filter(p => !p.hidden);

    // Elementos del Modal
    const modalBackdrop = modal.querySelector(".ecom-modal-backdrop") || document.getElementById("maderinModalBackdrop");
    const modalCloseBtn = modal.querySelector(".ecom-modal-close") || document.getElementById("maderinModalCloseBtn");
    const modalPrevBtn = document.getElementById("mModalPrevBtn") || document.getElementById("modalPrevProduct");
    const modalNextBtn = document.getElementById("mModalNextBtn") || document.getElementById("modalNextProduct");
    const modalCounterEl = document.getElementById("mModalCounter") || document.getElementById("modalNavCounter");
    const modalVisualEl = document.getElementById("mModalVisual") || document.getElementById("modalProductVisual");
    const modalBadge = document.getElementById("mModalBadge");
    const modalColorIndicator = document.getElementById("mModalActiveColorLabel") || document.getElementById("modalSelectedColorIndicator");
    const modalColorText = document.getElementById("mModalSelectedColorText");
    const modalCatTag = document.getElementById("mModalCategory") || document.getElementById("modalCatTag");
    const modalSku = document.getElementById("mModalSku") || document.getElementById("modalSku");
    const modalTitle = document.getElementById("mModalTitle") || document.getElementById("modalTitle");
    const modalRatingNum = document.getElementById("mModalRatingVal") || document.getElementById("modalRatingNum");
    const modalReviewsCount = document.getElementById("mModalReviews") || document.getElementById("modalReviewsCount");
    const modalCurrentPrice = document.getElementById("mModalPrice") || document.getElementById("modalCurrentPrice");
    const modalOldPrice = document.getElementById("mModalOldPrice") || document.getElementById("modalOldPrice");
    const modalDiscountTag = document.getElementById("mModalDiscount") || document.getElementById("modalDiscountTag");
    const modalDesc = document.getElementById("mModalDesc") || document.getElementById("modalDesc");
    const modalColorSwatches = document.getElementById("mModalColorSwatches") || document.getElementById("modalColorSwatches");
    const modalSpecAge = document.getElementById("mModalAge") || document.getElementById("modalSpecAge");
    const modalSpecDimensions = document.getElementById("mModalDimensions") || document.getElementById("modalSpecDimensions");
    const modalSpecMaterial = document.getElementById("mModalMaterial") || document.getElementById("modalSpecMaterial");
    const modalSpecDelivery = document.getElementById("mModalDelivery") || document.getElementById("modalSpecDelivery");
    const modalQtyDisplay = document.getElementById("mModalQtyVal") || document.getElementById("modalQtyDisplay");
    const qtyMinusBtn = document.getElementById("mModalQtyMinus") || document.getElementById("qtyMinusBtn");
    const qtyPlusBtn = document.getElementById("mModalQtyPlus") || document.getElementById("qtyPlusBtn");
    const modalWhatsAppBtn = document.getElementById("mModalWaOrderBtn") || document.getElementById("modalWhatsAppBtn");
    const modalWhatsAppBtnText = document.getElementById("mModalWaBtnText");
    const modalStock = document.getElementById("mModalStock");
    const modalAddBtn = document.getElementById("mModalAddBtn");
    const modalAddBtnText = document.getElementById("mModalAddBtnText");

    // Estado del modal
    let currentModalIndex = 0;
    let selectedQuantity = 1;
    let selectedColor = "";

    // ------------------------------------------------------------------------
    // LÓGICA DEL MODAL DE PRODUCTO
    // ------------------------------------------------------------------------
    function openModalForProduct(productId) {
      const idx = maderinProducts.findIndex(p => p.id === productId);
      if (idx === -1) return;
      currentModalIndex = idx;
      selectedQuantity = 1;
      populateModal(maderinProducts[currentModalIndex]);
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
      modal.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
      modal.classList.remove("open");
      document.body.style.overflow = "";
      modal.setAttribute("aria-hidden", "true");
    }

    function populateModal(product) {
      if (!product) return;

      // Resetear estado
      selectedColor = product.colors && product.colors.length ? product.colors[0].name : "Pino Natural";
      selectedQuantity = 1;

      // Navegación
      if (modalCounterEl) {
        const currentNum = String(currentModalIndex + 1).padStart(2, "0");
        const totalNum = String(maderinProducts.length).padStart(2, "0");
        modalCounterEl.textContent = `${currentNum} / ${totalNum}`;
      }

      // Visual & Badge
      if (modalVisualEl) {
        modalVisualEl.classList.toggle("has-photo", ACCatalog.hasPhoto(product));
        modalVisualEl.innerHTML = ACCatalog.hasPhoto(product)
          ? `<img src="${photoUrl(product, 900)}" alt="${product.name}" decoding="async">`
          : (product.svg || "");
      }
      if (modalBadge) {
        modalBadge.textContent = product.badge || "Destacado";
      }
      if (modalColorIndicator) {
        modalColorIndicator.textContent = selectedColor;
      }
      if (modalColorText) {
        modalColorText.textContent = selectedColor;
      }

      // Información de encabezado
      if (modalCatTag) modalCatTag.textContent = product.categoryLabel;
      if (modalSku) modalSku.textContent = `SKU: ${product.sku || "por asignar"}`;
      if (modalTitle) modalTitle.textContent = product.name;
      const ratingRow = modalRatingNum ? modalRatingNum.closest(".ecom-rating-row") : null;
      if (ratingRow) ratingRow.hidden = product.rating == null;
      if (product.rating != null) {
        if (modalRatingNum) modalRatingNum.textContent = product.rating.toFixed(1);
        if (modalReviewsCount) modalReviewsCount.textContent = `(${product.reviewsCount} opiniones verificadas)`;
      }

      // Precio
      if (modalCurrentPrice) modalCurrentPrice.textContent = product.price == null ? "Precio por confirmar" : `S/ ${product.price}`;
      if (modalOldPrice) {
        modalOldPrice.hidden = !product.oldPrice;
        if (product.oldPrice) modalOldPrice.textContent = `S/ ${product.oldPrice}`;
      }
      if (modalDiscountTag) {
        modalDiscountTag.hidden = !product.discount;
        if (product.discount) modalDiscountTag.textContent = product.discount;
      }

      // Descripción
      if (modalDesc) modalDesc.textContent = product.desc;

      // Muestras de color
      if (modalColorSwatches) {
        modalColorSwatches.innerHTML = "";
        product.colors.forEach((color, i) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `color-swatch-btn ${i === 0 ? "active" : ""}`;
          btn.innerHTML = `<span class="swatch-circle" style="background: ${color.hex};"></span><span>${color.name}</span>`;
          btn.addEventListener("click", () => {
            modalColorSwatches.querySelectorAll(".color-swatch-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedColor = color.name;
            if (modalColorIndicator) modalColorIndicator.textContent = selectedColor;
            if (modalColorText) modalColorText.textContent = selectedColor;
            updateWhatsAppButton(product);
          });
          modalColorSwatches.appendChild(btn);
        });
      }

      // Disponibilidad
      if (modalStock) {
        const av = getAvailability(product);
        modalStock.className = `p-stock p-stock--${av.state}`;
        modalStock.innerHTML = `<span class="p-stock-dot"></span>${av.label}`;
      }

      // Especificaciones
      if (modalSpecAge) modalSpecAge.textContent = product.ageRange;
      if (modalSpecDimensions) modalSpecDimensions.textContent = product.dimensions;
      if (modalSpecMaterial) modalSpecMaterial.textContent = product.material;
      if (modalSpecDelivery) modalSpecDelivery.textContent = product.deliveryTime || "Por confirmar";

      // Cantidad y Botón de WhatsApp
      updateQuantityUI();
      updateWhatsAppButton(product);
    }

    function updateQuantityUI() {
      if (modalQtyDisplay) modalQtyDisplay.textContent = selectedQuantity;
      if (qtyMinusBtn) qtyMinusBtn.disabled = selectedQuantity <= 1;
      if (qtyPlusBtn) qtyPlusBtn.disabled = selectedQuantity >= 10;
    }

    function updateWhatsAppButton(product) {
      if (!product) return;
      const hasPrice = product.price != null;
      const total = hasPrice ? product.price * selectedQuantity : null;

      // Botón principal: agregar al carrito (o consultar precio si aún no está definido)
      if (modalAddBtn) {
        const soldOut = getAvailability(product).state === "out";
        modalAddBtn.disabled = soldOut;
        if (modalAddBtnText) {
          modalAddBtnText.textContent = soldOut ? "Agotado por ahora"
            : hasPrice ? `Agregar al carrito · S/ ${total}`
            : "Consultar precio por WhatsApp";
        }
      }

      // Botón secundario: consulta por WhatsApp
      if (!modalWhatsAppBtn) return;
      const qtyText = selectedQuantity > 1 ? ` (${selectedQuantity} unidades)` : "";
      const message = hasPrice
        ? `Hola Maderin, tengo una consulta sobre: "${product.name}"${qtyText} en acabado ${selectedColor} (Precio: S/ ${total}). ¿Tienen disponibilidad y fecha de entrega?`
        : `Hola Maderin, tengo una consulta sobre: "${product.name}". ¿Me indican precio, medidas y fecha de entrega?`;

      modalWhatsAppBtn.href = waLink(message);
      modalWhatsAppBtn.setAttribute("target", "_blank");
      modalWhatsAppBtn.setAttribute("rel", "noopener");
    }

    // Controles de cantidad
    if (qtyMinusBtn) {
      qtyMinusBtn.addEventListener("click", () => {
        if (selectedQuantity > 1) {
          selectedQuantity--;
          updateQuantityUI();
          updateWhatsAppButton(maderinProducts[currentModalIndex]);
        }
      });
    }

    if (qtyPlusBtn) {
      qtyPlusBtn.addEventListener("click", () => {
        if (selectedQuantity < 10) {
          selectedQuantity++;
          updateQuantityUI();
          updateWhatsAppButton(maderinProducts[currentModalIndex]);
        }
      });
    }

    // Navegación dentro del modal (Anterior / Siguiente)
    if (modalPrevBtn) {
      modalPrevBtn.addEventListener("click", () => {
        currentModalIndex = (currentModalIndex - 1 + maderinProducts.length) % maderinProducts.length;
        populateModal(maderinProducts[currentModalIndex]);
      });
    }

    if (modalNextBtn) {
      modalNextBtn.addEventListener("click", () => {
        currentModalIndex = (currentModalIndex + 1) % maderinProducts.length;
        populateModal(maderinProducts[currentModalIndex]);
      });
    }

    // Cierre del modal
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);

    // Teclado (Escape, Flechas)
    document.addEventListener("keydown", (e) => {
      if (!modal.classList.contains("open")) return;
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowLeft" && modalPrevBtn) modalPrevBtn.click();
      if (e.key === "ArrowRight" && modalNextBtn) modalNextBtn.click();
    });

    // ------------------------------------------------------------------------
    // DISPONIBILIDAD POR PRODUCTO
    // product.stock: "order" (sobre pedido, por defecto) | "ready" (listo para entrega) | "out" (agotado)
    // ------------------------------------------------------------------------
    const photoUrl = (product, width) => ACCatalog.photoUrl(product, width, "maderin");

    const getAvailability = (product) => ACCatalog.stockInfo(product);

    const escAttr = (str) => String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.5-.5-1-1.1-1.4-1.8-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.2-.5.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.9-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.7.7-1 1.6-1 2.6.1 1.2.6 2.4 1.4 3.4 1.5 2 3.4 3.5 5.7 4.2.7.2 1.3.2 1.9.1.6-.1 1.4-.6 1.6-1.2.2-.5.2-1 .1-1.1-.1-.2-.3-.2-.5-.3Z"/></svg>';
    const CART_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 11.2a1.6 1.6 0 0 0 1.6 1.2h8.4a1.6 1.6 0 0 0 1.6-1.2L21 7H6"/></svg>';
    const SEARCH_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>';

    // Tarjeta del catálogo (misma estructura que usaba el HTML estático)
    function renderProductCard(p) {
      const av = getAvailability(p);
      const priced = p.price != null;
      const soldOut = av.state === "out";
      const filled = p.rating != null ? Math.min(5, Math.max(1, Math.round(p.rating))) : 0;
      const thumb = ACCatalog.hasPhoto(p)
        ? `<img class="thumb-photo" src="${escAttr(photoUrl(p, 480))}" alt="${escAttr(p.name)}" loading="lazy" decoding="async">`
        : `<div class="thumb-icon-wrap">${p.svg}</div>`;
      const priceBlock = priced
        ? `<div class="p-price-row"><span class="p-current-price">S/ ${p.price}</span>${p.oldPrice ? `<span class="p-old-price">S/ ${p.oldPrice}</span>` : ""}</div>${p.discount ? `<span class="p-discount-tag">${escAttr(p.discount)}</span>` : ""}`
        : `<div class="p-price-row"><span class="p-current-price p-price-pending">Precio por confirmar</span></div>`;
      const action = !priced
        ? `<button type="button" class="btn btn-buy btn-consult" data-consult-id="${escAttr(p.id)}" aria-label="Consultar precio por WhatsApp">${WA_ICON}<span>Consultar</span></button>`
        : `<button type="button" class="btn btn-buy btn-add-cart" data-add-id="${escAttr(p.id)}" aria-label="Agregar al carrito"${soldOut ? " disabled" : ""}>${CART_ICON}<span>${soldOut ? "Agotado" : "Agregar"}</span></button>`;
      return `<article class="product-card compact-card reveal in-view" data-id="${escAttr(p.id)}" data-category="${escAttr(p.category)}"${priced ? ` data-price="${p.price}"` : ""} data-name="${escAttr(p.name)}" role="button" tabindex="0" aria-label="Ver detalles de ${escAttr(p.name)}">
        <div class="product-thumb compact-thumb">
          ${p.badge ? `<span class="sample-badge${ACCatalog.isPromo(p.badge) ? " promo" : ""}">${escAttr(p.badge)}</span>` : ""}
          ${thumb}
          <div class="thumb-quick-hint"><span class="quick-hint-pill">${SEARCH_ICON} Ficha rápida</span></div>
        </div>
        <div class="product-body compact-body">
          <div class="p-card-header">
            <span class="p-card-cat">${escAttr(p.categoryLabel)}</span>
            ${p.rating != null ? `<div class="p-card-rating"><span class="stars">${"★".repeat(filled)}${"☆".repeat(5 - filled)}</span><span class="rating-val">${p.rating.toFixed(1)}</span></div>` : ""}
          </div>
          <h3 class="p-card-name">${escAttr(p.name)}</h3>
          <p class="desc">${escAttr(p.cardDesc)}</p>
          <div class="p-stock p-stock--${av.state}"><span class="p-stock-dot"></span>${escAttr(av.label)}</div>
          <div class="product-footer-row">
            <div class="p-pricing">${priceBlock}</div>
            <div class="p-actions-group">
              <button class="btn btn-outline-maderin btn-open-modal" aria-label="Ver ficha completa">Ver detalle</button>
              ${action}
            </div>
          </div>
        </div>
      </article>`;
    }

    grid.innerHTML = maderinProducts.length
      ? maderinProducts.map(renderProductCard).join("")
      : '<p class="catalog-empty">Estamos preparando nuevos productos. Escríbenos por WhatsApp y te contamos.</p>';

    // ------------------------------------------------------------------------
    // CARRITO: estado en localStorage, drawer lateral y resumen por WhatsApp
    // ------------------------------------------------------------------------
    const CART_KEY = "maderinCart";
    const CART_FIELDS_KEY = "maderinCartFields";
    const MAX_LINE_QTY = 10;
    const cartDrawer = document.getElementById("cartDrawer");
    const cartBackdrop = document.getElementById("cartBackdrop");
    const cartItemsEl = document.getElementById("cartItems");
    const cartEmptyEl = document.getElementById("cartEmpty");
    const cartFootEl = document.getElementById("cartFoot");
    const cartSubtotalEl = document.getElementById("cartSubtotal");
    const cartHeadCount = document.getElementById("cartHeadCount");
    const navCartBtn = document.getElementById("navCartBtn");
    const navCartCount = document.getElementById("navCartCount");
    const cartNameInput = document.getElementById("cartName");
    const cartDistrictInput = document.getElementById("cartDistrict");
    const cartToast = document.getElementById("cartToast");
    const cartToastText = document.getElementById("cartToastText");
    let toastTimer = null;

    const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const productById = (id) => maderinProducts.find(p => p.id === id);

    let cart = [];
    try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { cart = []; }
    // Descarta líneas inválidas o de productos que ya no existen / están agotados
    cart = (Array.isArray(cart) ? cart : []).filter(l => {
      const p = l && productById(l.id);
      return p && p.price != null && getAvailability(p).state !== "out" && Number.isInteger(l.qty) && l.qty > 0 && typeof l.color === "string";
    }).map(l => ({ id: l.id, color: l.color, qty: Math.min(l.qty, MAX_LINE_QTY) }));

    function saveCart() {
      try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* sin almacenamiento: el carrito vive solo en esta visita */ }
    }

    const cartCount = () => cart.reduce((n, l) => n + l.qty, 0);
    const cartTotal = () => cart.reduce((sum, l) => sum + productById(l.id).price * l.qty, 0);

    function showToast(text) {
      if (!cartToast) return;
      cartToastText.textContent = text;
      cartToast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => cartToast.classList.remove("show"), 3200);
    }

    function addToCart(id, color, qty) {
      const product = productById(id);
      if (!product || product.price == null || getAvailability(product).state === "out") return;
      const line = cart.find(l => l.id === id && l.color === color);
      if (line) line.qty = Math.min(line.qty + qty, MAX_LINE_QTY);
      else cart.push({ id, color, qty: Math.min(qty, MAX_LINE_QTY) });
      saveCart();
      renderCart();
      if (navCartBtn) {
        navCartBtn.classList.remove("bump");
        void navCartBtn.offsetWidth; // reinicia la animación
        navCartBtn.classList.add("bump");
      }
      showToast(`${product.name} agregado al carrito`);
    }

    function renderCart() {
      const count = cartCount();
      if (navCartCount) {
        navCartCount.textContent = count;
        navCartCount.hidden = count === 0;
      }
      if (cartHeadCount) cartHeadCount.textContent = count ? `(${count})` : "";
      if (!cartItemsEl) return;

      cartEmptyEl.hidden = count > 0;
      cartFootEl.hidden = count === 0;
      cartItemsEl.hidden = count === 0;

      cartItemsEl.innerHTML = cart.map((l, i) => {
        const p = productById(l.id);
        return `<div class="cart-line" data-index="${i}">
          <div class="cart-line-icon${ACCatalog.hasPhoto(p) ? " has-photo" : ""}">${ACCatalog.hasPhoto(p) ? `<img src="${photoUrl(p, 480)}" alt="">` : p.svg}</div>
          <div class="cart-line-info">
            <strong>${escapeHtml(p.name)}</strong>
            <span>${escapeHtml(l.color)}</span>
            <div class="cart-line-qty">
              <button type="button" data-act="minus" aria-label="Disminuir cantidad"${l.qty <= 1 ? " disabled" : ""}>&minus;</button>
              <span>${l.qty}</span>
              <button type="button" data-act="plus" aria-label="Aumentar cantidad"${l.qty >= MAX_LINE_QTY ? " disabled" : ""}>&plus;</button>
            </div>
          </div>
          <div class="cart-line-side">
            <strong>S/ ${p.price * l.qty}</strong>
            <button type="button" data-act="remove" class="cart-line-remove" aria-label="Quitar ${escapeHtml(p.name)} del carrito">Quitar</button>
          </div>
        </div>`;
      }).join("");

      if (cartSubtotalEl) cartSubtotalEl.textContent = `S/ ${cartTotal()}`;
    }

    function openCart() {
      if (!cartDrawer) return;
      cartDrawer.classList.add("open");
      cartBackdrop.classList.add("open");
      cartDrawer.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      cartToast.classList.remove("show");
      const closeBtn = document.getElementById("cartCloseBtn");
      if (closeBtn) closeBtn.focus();
    }

    function closeCart() {
      if (!cartDrawer || !cartDrawer.classList.contains("open")) return;
      cartDrawer.classList.remove("open");
      cartBackdrop.classList.remove("open");
      cartDrawer.setAttribute("aria-hidden", "true");
      if (!modal.classList.contains("open")) document.body.style.overflow = "";
      if (navCartBtn) navCartBtn.focus();
    }

    function buildOrderMessage() {
      const lines = cart.map(l => {
        const p = productById(l.id);
        return `• ${l.qty} × ${p.name} (${l.color}) — S/ ${p.price * l.qty}`;
      });
      const name = cartNameInput ? cartNameInput.value.trim() : "";
      const district = cartDistrictInput ? cartDistrictInput.value.trim() : "";
      const extra = [name && `Nombre: ${name}`, district && `Distrito de entrega: ${district}`].filter(Boolean);
      return [
        "Hola Maderin, quiero hacer este pedido:",
        "",
        ...lines,
        "",
        `Total: S/ ${cartTotal()}`,
        ...(extra.length ? ["", ...extra] : []),
        "",
        "¿Me confirman disponibilidad, costo de envío y cómo pagar? (transferencia, Yape o link de Mercado Pago)"
      ].join("\n");
    }

    // Recuerda nombre y distrito entre visitas
    try {
      const saved = JSON.parse(localStorage.getItem(CART_FIELDS_KEY)) || {};
      if (cartNameInput && saved.name) cartNameInput.value = saved.name;
      if (cartDistrictInput && saved.district) cartDistrictInput.value = saved.district;
    } catch (e) { /* sin datos guardados */ }
    [cartNameInput, cartDistrictInput].forEach(input => {
      if (!input) return;
      input.addEventListener("input", () => {
        try { localStorage.setItem(CART_FIELDS_KEY, JSON.stringify({ name: cartNameInput.value, district: cartDistrictInput.value })); } catch (e) { /* ignorar */ }
      });
    });

    if (cartItemsEl) {
      cartItemsEl.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-act]");
        const lineEl = e.target.closest(".cart-line");
        if (!btn || !lineEl) return;
        const line = cart[Number(lineEl.getAttribute("data-index"))];
        if (!line) return;
        const act = btn.getAttribute("data-act");
        if (act === "plus") line.qty = Math.min(line.qty + 1, MAX_LINE_QTY);
        if (act === "minus") line.qty = Math.max(line.qty - 1, 1);
        if (act === "remove") cart = cart.filter(l => l !== line);
        saveCart();
        renderCart();
      });
    }

    if (navCartBtn) navCartBtn.addEventListener("click", openCart);
    document.getElementById("cartCloseBtn")?.addEventListener("click", closeCart);
    if (cartBackdrop) cartBackdrop.addEventListener("click", closeCart);
    document.getElementById("cartToastBtn")?.addEventListener("click", openCart);
    document.getElementById("cartEmptyCta")?.addEventListener("click", () => {
      closeCart();
      document.getElementById("productos")?.scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("cartClearBtn")?.addEventListener("click", () => {
      cart = [];
      saveCart();
      renderCart();
    });
    document.getElementById("cartSendBtn")?.addEventListener("click", () => {
      if (!cart.length) return;
      openWhatsApp(buildOrderMessage());
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCart();
    });

    // Agregar desde el modal de producto
    if (modalAddBtn) {
      modalAddBtn.addEventListener("click", () => {
        const product = maderinProducts[currentModalIndex];
        if (!product) return;
        if (product.price == null) {
          openWhatsApp(`Hola Maderin, quiero consultar el precio de: "${product.name}". ¿Me indican precio, medidas y fecha de entrega?`);
          return;
        }
        addToCart(product.id, selectedColor, selectedQuantity);
        closeModal();
      });
    }

    renderCart();

    // ------------------------------------------------------------------------
    // RESEÑAS / FOTOS DE CLIENTES
    // Agrega aquí reseñas reales. La sección #familias permanece oculta mientras esté vacío.
    // (Hoy hay 3 reseñas de ejemplo con foto real y texto por completar.)
    // Formato: { name: "María P.", district: "Surco", rating: 5, text: "…", product: "Cama Casita Montessori", photo: "public/maderin/reviews/maria.webp" }
    // ("photo", "district" y "rating" son opcionales; sin rating no se muestran estrellas)
    // ------------------------------------------------------------------------
    const maderinReviews = [
      // Notas basadas en la conformidad confirmada por cada cliente (no son citas textuales). Si consigues sus palabras, reemplaza text por su comentario real.
      { photo: "public/maderin/reviews/closet-montessori.webp", product: "Closet Montessori", name: "Liliana", district: "Comas", rating: 5, text: "A mi hija le encanta elegir su ropa sola. Llegó rápido y se ve hermoso." },
      { photo: "public/maderin/reviews/organizador-juguetes.webp", product: "Organizador de Juguetes", name: "Sebastián", district: "Los Olivos", rating: 5, text: "Mi hijo juega todo el día aquí. Gracias! ." },
      { photo: "public/maderin/reviews/repisa-libros.webp", product: "Repisas para Libros", name: "Julia", district: "San Miguel", rating: 5, text: "Nuestra hija ama leer y tiene muchos libros. Estas repisas quedaron hermosas." }
    ];
    (function renderReviews() {
      const section = document.getElementById("familias");
      const wrap = document.getElementById("maderinReviews");
      if (!section || !wrap || !maderinReviews.length) return;
      wrap.innerHTML = maderinReviews.map(r => `<figure class="review-card">
        ${r.photo ? `<img class="review-photo" src="${escapeHtml(r.photo)}" alt="Mueble Maderin en casa de ${escapeHtml(r.name)}" loading="lazy">` : ""}
        ${r.rating ? `<div class="review-stars" aria-label="${Number(r.rating)} de 5 estrellas">${"★".repeat(Number(r.rating))}</div>` : ""}
        <blockquote>${escapeHtml(r.text)}</blockquote>
        <figcaption><strong>${escapeHtml(r.name)}</strong>${r.district ? ` · ${escapeHtml(r.district)}` : ""}${r.product ? `<span>${escapeHtml(r.product)}</span>` : ""}</figcaption>
      </figure>`).join("");
      section.hidden = false;
    })();

    // Delegación de clics en las tarjetas del catálogo
    grid.addEventListener("click", (e) => {
      // Botón "Consultar" (productos sin precio definido): abre WhatsApp sin abrir el modal
      const consultBtn = e.target.closest(".btn-consult");
      if (consultBtn) {
        e.stopPropagation();
        const product = maderinProducts.find(p => p.id === consultBtn.getAttribute("data-consult-id"));
        if (product) openWhatsApp(`Hola Maderin, quiero consultar el precio de: "${product.name}". ¿Me indican precio, medidas y fecha de entrega?`);
        return;
      }

      // Botón "Agregar" de la tarjeta: suma al carrito sin abrir el modal
      const addBtn = e.target.closest(".btn-add-cart");
      if (addBtn) {
        e.stopPropagation();
        const product = maderinProducts.find(p => p.id === addBtn.getAttribute("data-add-id"));
        if (product) addToCart(product.id, product.colors[0].name, 1);
        return;
      }

      const card = e.target.closest(".compact-card");
      if (card) {
        const productId = card.getAttribute("data-id");
        if (productId) {
          openModalForProduct(productId);
        }
      }
    });
  }

  // ==========================================================================
  // CORAZÓN DE MADERA: CATÁLOGO DESDE /admin (con respaldo en assets/catalog.js)
  // ==========================================================================
  async function initCdmCatalog() {
    const grid = document.getElementById("cdmProductGrid");
    if (!grid) return;
    const products = (await window.ACCatalog.load("cdm")).filter(p => !p.hidden);
    const esc = (str) => String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    grid.innerHTML = products.map((p) => {
      const av = ACCatalog.stockInfo(p);
      const soldOut = av.state === "out";
      const showStock = av.state !== "order" || p.deliveryTime;
      const msg = `Hola, quiero pedir: ${p.name} (Corazón de Madera). ¿Me ayudan con precio y disponibilidad?`;
      const media = ACCatalog.hasPhoto(p) ? `<img class="thumb-photo" src="${esc(ACCatalog.photoUrl(p, 480, "cdm"))}" alt="${esc(p.name)}" loading="lazy" decoding="async">` : p.svg;
      return `<article class="product-card reveal in-view" data-id="${esc(p.id)}" data-category="${esc(p.category)}">
        <div class="product-thumb">
          ${p.badge ? `<span class="sample-badge">${esc(p.badge)}</span>` : ""}
          ${media}
        </div>
        <div class="product-body">
          <h3>${esc(p.name)}</h3>
          <p class="desc">${esc(p.desc)}</p>
          ${p.specs.length ? `<div class="product-specs">${p.specs.map(s => `<span>${esc(s)}</span>`).join("")}</div>` : ""}
          ${showStock ? `<div class="p-stock p-stock--${av.state}"><span class="p-stock-dot"></span>${esc(av.label)}</div>` : ""}
          <div class="product-price">${p.price == null ? "Precio a consultar" : `S/ ${p.price} <small>/ ${esc(p.unit)}</small>`}${p.oldPrice ? ` <s class="product-old-price">S/ ${p.oldPrice}</s>` : ""}</div>
          <button class="btn btn-wa btn-sm" ${soldOut ? "disabled" : `data-wa-message="${esc(msg)}"`}>${soldOut ? "Agotado por ahora" : "Pedir por WhatsApp"}</button>
        </div>
      </article>`;
    }).join("") || '<p class="catalog-empty">Estamos preparando nuevos detalles. Escríbenos por WhatsApp y te contamos.</p>';

    grid.querySelectorAll("[data-wa-message]").forEach((el) => {
      el.addEventListener("click", () => openWhatsApp(el.getAttribute("data-wa-message")));
    });

    // Filtros por categoría
    document.querySelectorAll("#cdmFilters .filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const cat = chip.getAttribute("data-filter");
        grid.querySelectorAll(".product-card").forEach((card) => {
          card.style.display = cat === "todos" || card.getAttribute("data-category") === cat ? "" : "none";
        });
      });
    });
  }

  // Bosquejos en trazos por tipo de proyecto (viewBox 320×160). Cada elemento
  // lleva pathLength="1" para animar el dibujado con stroke-dashoffset.
  const QUOTE_SKETCHES = {
    "Cocina": [
      "M30 20h260v42H30z", "M110 20v42M200 20v42", "M100 50h8M202 50h8",
      "M24 92h272", "M30 92v58h260V92", "M117 92v58M203 92v58", "M108 108v10M212 108v10",
      "M136 78a8 4 0 1 0 16 0a8 4 0 1 0-16 0", "M168 78a8 4 0 1 0 16 0a8 4 0 1 0-16 0"
    ],
    "Closet": [
      "M50 10h220v140H50z", "M123 10v140M197 10v140", "M58 28h57", "M70 28l7 12h16l7-12",
      "M133 100h54M133 124h54", "M205 20v100", "M115 70v22M131 70v22", "M50 150v6M270 150v6"
    ],
    "Escritorio": [
      "M30 70h260v7H30z", "M40 77v73M280 77v73", "M196 77v73M280 77v0", "M196 105h84M196 128h84",
      "M232 112h12M232 135h12", "M105 28h90v36h-90z", "M150 64v6M132 70h36", "M205 58h24v12h-24z"
    ],
    "Centro de TV": [
      "M96 26h128v56H96z", "M160 82v10M136 92h48",
      "M30 100h260v42H30z", "M117 100v42M203 100v42", "M108 118h6M206 118h6",
      "M30 14h54v86M236 14h54v86", "M30 44h54M30 74h54M236 44h54M236 74h54"
    ],
    "Organizador": [
      "M80 10h160v140H80z", "M80 54h160M80 98h160", "M160 10v140",
      "M92 54v-18h26v18", "M170 54v-24h30v24", "M100 98v-26h40v26", "M180 98v-14h40v14",
      "M92 150v-30h56v30", "M172 150v-20h60v20"
    ],
    "Mueble bar": [
      "M70 10h180v140H70z", "M70 54h180", "M70 96h180", "M160 96v54",
      "M92 54v-26h8v26M108 54v-34h8v34M124 54v-22h8v22", "M180 54l8-26h14l8 26",
      "M206 28v-8", "M82 96v-14h18v14M104 96v-8h14v8", "M150 126h4M166 126h4"
    ]
  };

  // --- Cotizador express (AC Mueblería) ---
  // bindQuoteForm enlaza un formulario de cotización (ids con `prefix`) y arma
  // el mensaje de WhatsApp con tipo de proyecto, medidas y datos del cliente.
  // Lo usan el modal ("quote") y la sección inline ("inlineQuote").
  function bindQuoteForm(prefix, onSent) {
    const $ = (suffix) => document.getElementById(prefix + suffix);
    const form = $("Form");
    const waBtn = $("WaBtn");
    if (!form || !waBtn) return null;

    const chipsWrap = $("TypeChips");
    const chips = chipsWrap ? Array.from(chipsWrap.querySelectorAll(".quote-chip")) : [];
    const typeSelect = $("TypeSelect");
    const typeHint = $("TypeHint");
    const dimEls = [$("Width"), $("Height"), $("Depth")];
    const val = (suffix) => { const el = $(suffix); return el && el.value ? el.value.trim() : ""; };

    const sketchStage = $("SketchStage");
    const sketchCaption = $("SketchCaption");
    const sketchEmpty = sketchStage ? sketchStage.innerHTML : "";

    let selectedType = "";

    // Dibuja el bosquejo del tipo elegido (trazos que se animan con CSS)
    function renderSketch() {
      if (!sketchStage) return;
      const paths = QUOTE_SKETCHES[selectedType];
      if (!paths) {
        sketchStage.innerHTML = sketchEmpty;
        sketchStage.classList.remove("has-sketch");
        if (sketchCaption) sketchCaption.hidden = true;
        return;
      }
      const d = paths.map((path, i) => `<path d="${path}" pathLength="1" style="animation-delay:${i * 70}ms"/>`).join("");
      sketchStage.innerHTML = `<svg viewBox="0 0 320 160" role="img" aria-label="Bosquejo de ${selectedType}">${d}</svg>`;
      sketchStage.classList.add("has-sketch");
      updateCaption();
    }

    function updateCaption() {
      if (!sketchCaption || !selectedType) return;
      const dims = dimEls.map((el) => (el && el.value ? el.value.trim() : "")).filter(Boolean);
      sketchCaption.textContent = dims.length ? `${selectedType} · ${dims.join(" × ")} cm` : `${selectedType} · bosquejo referencial`;
      sketchCaption.hidden = false;
    }

    function buildMessage() {
      const lines = ["Hola AC Mueblería, quiero cotizar un proyecto:"];
      lines.push(`• Tipo: ${selectedType || "por definir"}`);
      const dims = dimEls.map((el) => (el && el.value ? el.value.trim() : "")).filter(Boolean);
      if (dims.length) lines.push(`• Medidas aprox. (cm): ${dims.join(" × ")}`);
      if (val("Name")) lines.push(`• Nombre: ${val("Name")}`);
      if (val("Zone")) lines.push(`• Zona: ${val("Zone")}`);
      if (val("Details")) lines.push(`• Detalles: ${val("Details")}`);
      return lines.join("\n");
    }

    function updateLink() { waBtn.href = waLink(buildMessage()); updateCaption(); }

    function clearError() {
      if (typeHint) typeHint.hidden = true;
      if (chipsWrap) chipsWrap.classList.remove("quote-chips-error");
    }

    function selectType(value) {
      selectedType = value;
      chips.forEach((chip) => {
        const on = chip.getAttribute("data-value") === value;
        chip.classList.toggle("active", on);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });
      if (typeSelect) typeSelect.value = value;
      clearError();
      renderSketch();
      updateLink();
    }

    function reset() {
      form.reset();
      selectedType = "";
      chips.forEach((chip) => { chip.classList.remove("active"); chip.setAttribute("aria-pressed", "false"); });
      if (typeSelect) typeSelect.value = "";
      clearError();
      renderSketch();
      updateLink();
    }

    chips.forEach((chip) => {
      chip.addEventListener("click", () => selectType(chip.getAttribute("data-value")));
    });
    if (typeSelect) typeSelect.addEventListener("change", () => selectType(typeSelect.value));
    form.addEventListener("input", updateLink);
    form.addEventListener("change", updateLink);

    // Enviar: exige el tipo de proyecto y luego abre WhatsApp
    waBtn.addEventListener("click", (event) => {
      if (!selectedType) {
        event.preventDefault();
        if (typeHint) typeHint.hidden = false;
        if (chipsWrap) chipsWrap.classList.add("quote-chips-error");
        if (typeSelect && typeSelect.offsetParent !== null) {
          typeSelect.focus();
        } else if (chips[0]) {
          chips[0].focus();
        }
        return;
      }
      // El href ya está actualizado; se abre en una pestaña nueva.
      window.setTimeout(() => {
        if (onSent) onSent();
        reset();
      }, 250);
    });

    updateLink();
    return { reset, clearError, updateLink };
  }

  // Los botones "Cotiza tu proyecto" llevan a #cotizar. El timeline de "Cómo trabajamos"
  // está pineado con GSAP y frena el scroll suave a medio camino, así que se corrige la
  // posición al terminar hasta que la sección quede alineada.
  function initQuoteAnchors() {
    const target = document.getElementById("cotizar");
    if (!target) return;
    document.querySelectorAll('a[href="#cotizar"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        history.replaceState(null, "", "#cotizar");
        let tries = 0;
        const align = () => {
          const offset = target.getBoundingClientRect().top - parseFloat(getComputedStyle(target).scrollMarginTop || 0);
          if (Math.abs(offset) > 8 && tries++ < 4) {
            target.scrollIntoView({ behavior: tries === 1 ? "smooth" : "instant" });
            window.setTimeout(align, tries === 1 ? 900 : 300);
          }
        };
        target.scrollIntoView({ behavior: "smooth" });
        window.setTimeout(align, 900);
      });
    });
  }

  // --- Sección de cotización inline (después de "Cómo trabajamos") ---
  function initQuoteSection() {
    bindQuoteForm("inlineQuote");
  }

  // --- Revelado de imágenes en "Por qué elegirnos" ---
  // Desktop: imagen siempre visible y al pasar el mouse se muestra la info sobre fondo oscuro (solo CSS).
  // Móvil: revelado por scroll (se descubre la imagen al cruzar el 60% de la pantalla).
  function initWhyChooseUsScrollReveal() {
    const section = document.getElementById("elegirnos");
    if (!section) return;

    const cards = Array.from(section.querySelectorAll(".feature-card"));
    if (!cards.length) return;

    // Calcular dinámicamente la distancia exacta que recorre el título dejando un margen respecto a la base
    function computeTitleTravel() {
      cards.forEach((card) => {
        const header = card.querySelector(".feature-card-header");
        const title = card.querySelector(".feature-title") || card.querySelector("h3");
        if (title) {
          const cardStyle = window.getComputedStyle(card);
          const padTop = parseFloat(cardStyle.paddingTop) || 30;
          const padBottom = parseFloat(cardStyle.paddingBottom) || 30;
          const headerH = header ? header.offsetHeight : 44;
          const availableH = card.clientHeight - headerH - padTop - padBottom;
          // Margen adicional de separación respecto a la base de la tarjeta (28px en desktop, 18px en móvil)
          const isMobile = window.innerWidth <= 980;
          const extraBottomMargin = isMobile ? 18 : 28;
          const travel = Math.max(30, availableH - title.offsetHeight - extraBottomMargin);
          card.style.setProperty("--title-travel", travel + "px");
        }
      });
    }

    // Permitir clic para alternar manualmente (solo en móvil; en desktop la interacción es hover)
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        if (window.innerWidth <= 980) card.classList.toggle("is-discovered");
      });
    });

    let ticking = false;
    function updateCardsOnScroll() {
      // En desktop el revelado es por hover: se limpia cualquier estado de scroll
      const isMobile = window.innerWidth <= 980;
      if (!isMobile) {
        cards.forEach((card) => card.classList.remove("is-discovered"));
        ticking = false;
        return;
      }
      // Umbral de revelado en móvil: 60% (se revela apenas entra la tarjeta)
      const triggerThreshold = window.innerHeight * 0.60;
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const cardCenterY = rect.top + (rect.height / 2);
        // Si el centro de la tarjeta ya cruzó el umbral de la pantalla hacia arriba
        if (cardCenterY <= triggerThreshold && rect.bottom > 0) {
          card.classList.add("is-discovered");
        } else {
          card.classList.remove("is-discovered");
        }
      });
      ticking = false;
    }

    function onScrollOrResize() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          computeTitleTravel();
          updateCardsOnScroll();
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    // Medición y evaluación inmediata inicial
    computeTitleTravel();
    updateCardsOnScroll();
  }

  // Botones flotantes: al llegar al pie de página se elevan para no tapar la barra inferior ("Diseño por ACM Studio")
  const footerBottom = document.querySelector(".footer-bottom");
  if (footerBottom) {
    const updateFloatLift = () => {
      const space = window.innerHeight - footerBottom.getBoundingClientRect().top; // alto visible de la barra inferior
      const lift = Math.max(0, space + 12 - 22);                                     // 22px = margen base de los flotantes
      document.documentElement.style.setProperty("--float-lift", lift + "px");
    };
    window.addEventListener("scroll", updateFloatLift, { passive: true });
    window.addEventListener("resize", updateFloatLift);
    window.addEventListener("load", updateFloatLift);
    updateFloatLift();
  }

  // Inicializar Por qué elegirnos scroll reveal
  initWhyChooseUsScrollReveal();

  // Inicializar Catálogo E-commerce Maderin si estamos en maderin.html
  initMaderinEcommerce();
  initCdmCatalog();

  initQuoteSection();
  initQuoteAnchors();
});
