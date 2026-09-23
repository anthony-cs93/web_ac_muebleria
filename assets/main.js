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
    toggle.addEventListener("click", () => links.classList.toggle("open"));
    links.querySelectorAll("a").forEach(a => a.addEventListener("click", () => links.classList.remove("open")));
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
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Cocina en L (Capri + Cuarzo negro)."
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
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Closet modular (Toquilla)."
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
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Mueble de TV flotante con Wall panel."
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
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Mueble organizador bajo escalera."
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
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Módulos de oficina."
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
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Mueble bar con vitrinas vidriadas."
      }
    ];

    let currentActiveIndex = 0;
    let modalCurrentIndex = 0;

    // --- 1. Generación y sincronización de dots del carrusel ---
    if (dotsContainer) {
      dotsContainer.innerHTML = "";
      cards.forEach((card, idx) => {
        const dot = document.createElement("button");
        dot.className = `carousel-dot ${idx === 0 ? "active" : ""}`;
        dot.setAttribute("aria-label", `Ir al proyecto ${idx + 1}`);
        dot.setAttribute("data-index", idx);
        dot.addEventListener("click", () => {
          scrollToCard(idx);
        });
        dotsContainer.appendChild(dot);
      });
    }

    const carouselDots = dotsContainer ? Array.from(dotsContainer.querySelectorAll(".carousel-dot")) : [];

    function updateActiveDot(index) {
      currentActiveIndex = Math.max(0, Math.min(index, cards.length - 1));
      carouselDots.forEach((dot, idx) => {
        dot.classList.toggle("active", idx === currentActiveIndex);
      });
    }

    function scrollToCard(index) {
      const targetCard = cards[index];
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
      const cardWidth = cards[0].offsetWidth;
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

    // Crear dots internos del modal
    if (modalNavDotsContainer) {
      modalNavDotsContainer.innerHTML = "";
      projectsData.forEach((_, idx) => {
        const mDot = document.createElement("button");
        mDot.className = `modal-nav-dot ${idx === 0 ? "active" : ""}`;
        mDot.setAttribute("aria-label", `Ver proyecto ${idx + 1}`);
        mDot.addEventListener("click", () => populateModal(idx, idx > modalCurrentIndex ? "next" : "prev"));
        modalNavDotsContainer.appendChild(mDot);
      });
    }

    const modalNavDots = modalNavDotsContainer ? Array.from(modalNavDotsContainer.querySelectorAll(".modal-nav-dot")) : [];

    function populateModal(index, direction = "next") {
      modalCurrentIndex = (index + projectsData.length) % projectsData.length;
      const data = projectsData[modalCurrentIndex];
      if (!data) return;

      // Actualizar datos
      if (modalCategory) modalCategory.textContent = data.category;
      if (modalCounter) modalCounter.textContent = data.counter;
      if (modalProjectTitle) modalProjectTitle.textContent = data.title;
      if (modalProjectSubtitle) modalProjectSubtitle.textContent = data.subtitle;
      if (modalDesc) modalDesc.textContent = data.desc;
      if (modalLocation) modalLocation.textContent = data.location;
      if (modalDimensions) modalDimensions.textContent = data.dimensions;
      if (modalMaterial) modalMaterial.textContent = data.material;
      if (modalFinish) modalFinish.textContent = data.finish;
      if (modalWaBtn) modalWaBtn.href = waLink(data.waText);

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
    cards.forEach((card, idx) => {
      card.addEventListener("click", (e) => {
        if (hasDragged) return; // Evitar abrir si fue un drag
        openModal(idx);
      });

      // Soporte para teclado (Enter / Espacio)
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(idx);
        }
      });
    });

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
  function initMaderinEcommerce() {
    const grid = document.getElementById("maderinProductGrid");
    const modal = document.getElementById("maderinProductModal");
    if (!grid || !modal) return;

    // Catálogo de 8 productos destacados para Maderin
    const maderinProducts = [
      {
        id: "cama-casita",
        category: "camas",
        categoryLabel: "Camas Montessori",
        sku: "MAD-CAM-01",
        name: "Cama Casita Montessori",
        subtitle: "Estructura en techo a dos aguas",
        desc: "Estructura baja inspirada en la metodología Montessori que promueve la libertad de movimiento y autonomía de tu pequeño, con bordes cuidadosamente redondeados y selladores ecológicos no tóxicos.",
        price: 480,
        oldPrice: 550,
        discount: "Ahorra S/ 70",
        badge: "Más Vendido",
        rating: 4.9,
        reviewsCount: 38,
        dimensions: "90 × 190 × 145 cm (1 Plaza)",
        material: "Pino selecto secado al horno",
        ageRange: "2 a 10 años",
        deliveryTime: "5 a 7 días hábiles",
        finish: "Laca selladora al agua no tóxica",
        colors: [
          { name: "Pino Natural", hex: "#D8BC94" },
          { name: "Blanco Nieve", hex: "#FFFFFF" },
          { name: "Gris Nórdico", hex: "#D1D5DB" },
          { name: "Rosa Pastel", hex: "#FBCFE8" }
        ],
        svg: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 34V20l18-12 18 12v14"/><path d="M6 34h36M12 34v6M36 34v6"/><path d="M12 24h24"/></svg>`
      },
      {
        id: "cama-baja",
        category: "camas",
        categoryLabel: "Camas Montessori",
        sku: "MAD-CAM-02",
        name: "Cama Baja con Barandilla",
        subtitle: "Nivel de piso con baranda protectora",
        desc: "Ideal como primera cama para la transición de cuna. Barandilla de seguridad perimetral con entrada frontal despejada y esquinas suavemente biseladas para máxima protección.",
        price: 420,
        oldPrice: 480,
        discount: "Ahorra S/ 60",
        badge: "Primera Cama",
        rating: 4.8,
        reviewsCount: 24,
        dimensions: "90 × 190 × 35 cm (1 Plaza)",
        material: "Madera Pino 100% macizo",
        ageRange: "18 meses a 7 años",
        deliveryTime: "4 a 6 días hábiles",
        finish: "Bordes biselados y sellador mate",
        colors: [
          { name: "Pino Natural", hex: "#D8BC94" },
          { name: "Blanco Nieve", hex: "#FFFFFF" },
          { name: "Gris Cálido", hex: "#E5E7EB" }
        ],
        svg: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 32V18h10v6h16v-6h10v14"/><line x1="6" y1="32" x2="42" y2="32"/><line x1="6" y1="32" x2="6" y2="40"/><line x1="42" y1="32" x2="42" y2="40"/><path d="M12 24v8M20 24v8M28 24v8M36 24v8"/></svg>`
      },
      {
        id: "librero-frontal",
        category: "guardado",
        categoryLabel: "Guardado & Orden",
        sku: "MAD-GUA-01",
        name: "Librero Frontal Montessori",
        subtitle: "3 niveles de cuentos a la vista",
        desc: "Los niños eligen sus lecturas por la portada. Este librero a su altura estimula la autonomía, el hábito lector diario y el orden en su habitación sin riesgo de caídas.",
        price: 140,
        oldPrice: 165,
        discount: "Ahorra S/ 25",
        badge: "Lectura Temprana",
        rating: 5.0,
        reviewsCount: 42,
        dimensions: "75 × 30 × 80 cm",
        material: "MDF 15mm + Pino macizo",
        ageRange: "1 a 8 años",
        deliveryTime: "3 a 5 días hábiles",
        finish: "Esmalte satinado lavable",
        colors: [
          { name: "Pino Natural", hex: "#D8BC94" },
          { name: "Blanco Nieve", hex: "#FFFFFF" },
          { name: "Verde Menta", hex: "#A7F3D0" },
          { name: "Rosa Pastel", hex: "#FBCFE8" }
        ],
        svg: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="10" width="32" height="30" rx="2"/><line x1="8" y1="20" x2="40" y2="20"/><line x1="8" y1="30" x2="40" y2="30"/><line x1="12" y1="18" x2="36" y2="18"/><line x1="12" y1="28" x2="36" y2="28"/></svg>`
      },
      {
        id: "organizador-juguetes",
        category: "guardado",
        categoryLabel: "Guardado & Orden",
        sku: "MAD-GUA-02",
        name: "Organizador de Juguetes 6 Gavetas",
        subtitle: "Módulo bajo con gavetas ligeras",
        desc: "Facilita la clasificación de juguetes, bloques y manualidades. Gavetas ultra-ligeras que los pequeños pueden mover y acomodar de forma 100% independiente.",
        price: 195,
        oldPrice: 230,
        discount: "Ahorra S/ 35",
        badge: "Autonomía",
        rating: 4.9,
        reviewsCount: 31,
        dimensions: "85 × 32 × 65 cm",
        material: "Melamina Pelíkano 18mm",
        ageRange: "2 a 9 años",
        deliveryTime: "4 a 6 días hábiles",
        finish: "Cantos gruesos termo-adheridos",
        colors: [
          { name: "Blanco Nórdico", hex: "#FFFFFF" },
          { name: "Pino Natural", hex: "#D8BC94" },
          { name: "Gris Claro", hex: "#E5E7EB" }
        ],
        svg: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="8" width="32" height="32" rx="2"/><line x1="8" y1="24" x2="40" y2="24"/><line x1="24" y1="8" x2="24" y2="40"/><rect x="12" y="12" width="8" height="8" rx="1"/><rect x="28" y="12" width="8" height="8" rx="1"/><rect x="12" y="28" width="8" height="8" rx="1"/><rect x="28" y="28" width="8" height="8" rx="1"/></svg>`
      },
      {
        id: "torre-aprendizaje",
        category: "accesorios",
        categoryLabel: "Accesorios & Estimulación",
        sku: "MAD-ACC-01",
        name: "Torre de Aprendizaje Regulable",
        subtitle: "3 alturas de piso con barra de seguridad",
        desc: "Permite al niño alcanzar la mesada de cocina o mesa con total estabilidad para cocinar, lavarse las manos y participar activamente en las tareas del hogar.",
        price: 175,
        oldPrice: 210,
        discount: "Ahorra S/ 35",
        badge: "Favorito Padres",
        rating: 4.9,
        reviewsCount: 56,
        dimensions: "42 × 40 × 90 cm",
        material: "Madera pino selecto 20mm",
        ageRange: "18 meses a 5 años",
        deliveryTime: "3 a 5 días hábiles",
        finish: "Base antideslizante y cantos redondeados",
        colors: [
          { name: "Pino Natural", hex: "#D8BC94" },
          { name: "Blanco Nieve", hex: "#FFFFFF" },
          { name: "Gris Nórdico", hex: "#D1D5DB" }
        ],
        svg: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 42L18 8h12l6 34"/><line x1="15" y1="28" x2="33" y2="28"/><line x1="16" y1="20" x2="32" y2="20"/><line x1="18" y1="12" x2="30" y2="12"/><path d="M12 42h24"/></svg>`
      },
      {
        id: "mesa-silla",
        category: "escritorio",
        categoryLabel: "Escritorios & Mesas",
        sku: "MAD-ESC-01",
        name: "Mesa + Silla Ergonómica Infantil",
        subtitle: "Set de estudio y juego boleado",
        desc: "Mesa cuadrada con esquinas boleadas y silla robusta de soporte lumbar ergonómico. Superficie tratada para fácil limpieza ante témperas, plumones y plastilinas.",
        price: 240,
        oldPrice: 280,
        discount: "Ahorra S/ 40",
        badge: "Set Ergonómico",
        rating: 4.8,
        reviewsCount: 19,
        dimensions: "Mesa 60×60×48 cm · Silla 30×30×52 cm",
        material: "Madera pino + Cubierta lavable",
        ageRange: "2 a 7 años",
        deliveryTime: "4 a 6 días hábiles",
        finish: "Laca protectora poliuretano mate",
        colors: [
          { name: "Pino Natural", hex: "#D8BC94" },
          { name: "Blanco + Pino", hex: "#F3F4F6" },
          { name: "Rosa Pastel", hex: "#FBCFE8" },
          { name: "Verde Menta", hex: "#A7F3D0" }
        ],
        svg: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="16" width="24" height="6" rx="1"/><line x1="10" y1="22" x2="10" y2="38"/><line x1="26" y1="22" x2="26" y2="38"/><path d="M34 14v24M34 26h8v12M42 26v-6"/></svg>`
      },
      {
        id: "escritorio-gaveta",
        category: "escritorio",
        categoryLabel: "Escritorios & Mesas",
        sku: "MAD-ESC-02",
        name: "Escritorio Escolar con Gaveta",
        subtitle: "Amplio espacio para tareas y libros",
        desc: "Diseñado para los primeros años de primaria. Cuenta con cajón silencioso con tope de seguridad, canal para lápices y estructura reforzada de pino macizo.",
        price: 260,
        oldPrice: 310,
        discount: "Ahorra S/ 50",
        badge: "Primaria",
        rating: 4.9,
        reviewsCount: 22,
        dimensions: "80 × 50 × 62 cm",
        material: "Pino macizo + MDF laqueado",
        ageRange: "4 a 10 años",
        deliveryTime: "5 a 7 días hábiles",
        finish: "Rieles telescópicos y acabado mate",
        colors: [
          { name: "Pino Natural", hex: "#D8BC94" },
          { name: "Blanco Nieve", hex: "#FFFFFF" },
          { name: "Gris Cálido", hex: "#E5E7EB" }
        ],
        svg: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="16" width="36" height="8" rx="1"/><line x1="10" y1="24" x2="10" y2="40"/><line x1="38" y1="24" x2="38" y2="40"/><line x1="18" y1="20" x2="30" y2="20"/></svg>`
      },
      {
        id: "perchero-tipi",
        category: "accesorios",
        categoryLabel: "Accesorios & Estimulación",
        sku: "MAD-ACC-02",
        name: "Perchero Tipi con Zapatero",
        subtitle: "Colgador bajito con base organizadora",
        desc: "Permite a los pequeños colgar sus casacas, mochilas y ordenar su calzado al volver a casa. Estructura triangular tipo tipi súper estable que no se tambalea.",
        price: 95,
        oldPrice: 115,
        discount: "Ahorra S/ 20",
        badge: "Compacto",
        rating: 4.8,
        reviewsCount: 17,
        dimensions: "40 × 40 × 110 cm",
        material: "Madera pino 100% macizo",
        ageRange: "2 a 9 años",
        deliveryTime: "2 a 4 días hábiles",
        finish: "Lijado fino al tacto y sellador ecológico",
        colors: [
          { name: "Pino Natural", hex: "#D8BC94" },
          { name: "Blanco Nieve", hex: "#FFFFFF" },
          { name: "Bicolor (Pino/Blanco)", hex: "#EADCC9" }
        ],
        svg: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 42L24 6l8 36"/><line x1="19" y1="22" x2="29" y2="22"/><line x1="14" y1="36" x2="34" y2="36"/></svg>`
      }
    ];

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
        modalVisualEl.innerHTML = product.svg || "";
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
      if (modalSku) modalSku.textContent = `SKU: ${product.sku}`;
      if (modalTitle) modalTitle.textContent = product.name;
      if (modalRatingNum) modalRatingNum.textContent = product.rating.toFixed(1);
      if (modalReviewsCount) modalReviewsCount.textContent = `(${product.reviewsCount} opiniones verificadas)`;

      // Precio
      if (modalCurrentPrice) modalCurrentPrice.textContent = `S/ ${product.price}`;
      if (modalOldPrice) modalOldPrice.textContent = `S/ ${product.oldPrice}`;
      if (modalDiscountTag) modalDiscountTag.textContent = product.discount;

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

      // Especificaciones
      if (modalSpecAge) modalSpecAge.textContent = product.ageRange;
      if (modalSpecDimensions) modalSpecDimensions.textContent = product.dimensions;
      if (modalSpecMaterial) modalSpecMaterial.textContent = product.material;
      if (modalSpecDelivery) modalSpecDelivery.textContent = product.deliveryTime;

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
      if (!modalWhatsAppBtn || !product) return;
      const total = product.price * selectedQuantity;
      const qtyText = selectedQuantity > 1 ? ` (${selectedQuantity} unidades)` : "";
      const message = `Hola Maderin, deseo consultar y pedir el producto: "${product.name}"${qtyText} en acabado ${selectedColor} (Precio: S/ ${total}). ¿Tienen disponibilidad y fecha de entrega?`;
      
      modalWhatsAppBtn.href = waLink(message);
      modalWhatsAppBtn.setAttribute("target", "_blank");
      modalWhatsAppBtn.setAttribute("rel", "noopener");
      
      if (modalWhatsAppBtnText) {
        modalWhatsAppBtnText.textContent = `Pedir por WhatsApp (S/ ${total})`;
      } else {
        const iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
        modalWhatsAppBtn.innerHTML = `${iconSvg} Pedir por WhatsApp (S/ ${total})`;
      }
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

    // Delegación de clics en las tarjetas del catálogo
    grid.addEventListener("click", (e) => {
      // Si hizo clic en el botón directo de WhatsApp de la tarjeta, no abrir modal
      const waBtn = e.target.closest(".btn-wa-icon");
      if (waBtn) {
        e.stopPropagation();
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

  // --- Modal de cotización (AC Mueblería) ---
  // Los botones con [data-quote-open] abren un cotizador express que arma el
  // mensaje de WhatsApp con tipo de proyecto, medidas y datos del cliente.
  function initQuoteModal() {
    const modal = document.getElementById("quoteModal");
    if (!modal) return;

    const backdrop = document.getElementById("quoteModalBackdrop");
    const closeBtn = document.getElementById("quoteModalCloseBtn");
    const form = document.getElementById("quoteForm");
    const chipsWrap = document.getElementById("quoteTypeChips");
    const chips = chipsWrap ? Array.from(chipsWrap.querySelectorAll(".quote-chip")) : [];
    const typeSelect = document.getElementById("quoteTypeSelect");
    const typeHint = document.getElementById("quoteTypeHint");
    const widthEl = document.getElementById("quoteWidth");
    const heightEl = document.getElementById("quoteHeight");
    const depthEl = document.getElementById("quoteDepth");
    const nameEl = document.getElementById("quoteName");
    const materialEl = document.getElementById("quoteMaterial");
    const zoneEl = document.getElementById("quoteZone");
    const detailsEl = document.getElementById("quoteDetails");
    const waBtn = document.getElementById("quoteWaBtn");
    const triggers = document.querySelectorAll("[data-quote-open]");

    let selectedType = "";

    function buildMessage() {
      const lines = ["Hola AC Mueblería, quiero cotizar un proyecto:"];
      lines.push(`• Tipo: ${selectedType || "por definir"}`);

      const dims = [widthEl, heightEl, depthEl]
        .map((el) => (el && el.value ? el.value.trim() : ""))
        .filter(Boolean);
      if (dims.length) lines.push(`• Medidas aprox. (cm): ${dims.join(" × ")}`);

      const name = nameEl && nameEl.value.trim();
      if (name) lines.push(`• Nombre: ${name}`);
      const material = materialEl && materialEl.value.trim();
      if (material) lines.push(`• Material/acabado: ${material}`);
      const zone = zoneEl && zoneEl.value.trim();
      if (zone) lines.push(`• Zona: ${zone}`);
      const details = detailsEl && detailsEl.value.trim();
      if (details) lines.push(`• Detalles: ${details}`);

      return lines.join("\n");
    }

    function updateLink() {
      if (waBtn) waBtn.href = waLink(buildMessage());
    }

    function selectType(value) {
      selectedType = value;
      chips.forEach((chip) => {
        const on = chip.getAttribute("data-value") === value;
        chip.classList.toggle("active", on);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });
      if (typeSelect) typeSelect.value = value;
      if (typeHint) typeHint.hidden = true;
      if (chipsWrap) chipsWrap.classList.remove("quote-chips-error");
      updateLink();
    }

    function openModal() {
      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      if (typeHint) typeHint.hidden = true;
      if (chipsWrap) chipsWrap.classList.remove("quote-chips-error");
      updateLink();
      if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

    function resetForm() {
      if (form) form.reset();
      selectedType = "";
      chips.forEach((chip) => {
        chip.classList.remove("active");
        chip.setAttribute("aria-pressed", "false");
      });
      if (typeSelect) typeSelect.value = "";
    }

    // Abrir desde los botones marcados (nav, hero y footer)
    triggers.forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        openModal();
      });
    });

    // Selección única de tipo de proyecto
    chips.forEach((chip) => {
      chip.addEventListener("click", () => selectType(chip.getAttribute("data-value")));
    });

    if (typeSelect) {
      typeSelect.addEventListener("change", () => selectType(typeSelect.value));
    }

    // Mantener el enlace de WhatsApp sincronizado con el formulario
    if (form) {
      form.addEventListener("input", updateLink);
      form.addEventListener("change", updateLink);
    }

    // Cierre: botón X, backdrop y tecla Escape
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (backdrop) backdrop.addEventListener("click", closeModal);
    window.addEventListener("keydown", (event) => {
      if (modal.classList.contains("active") && event.key === "Escape") closeModal();
    });

    // Enviar: exige el tipo de proyecto y luego abre WhatsApp
    if (waBtn) {
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
          closeModal();
          resetForm();
        }, 250);
      });
    }
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

  // Inicializar Por qué elegirnos scroll reveal
  initWhyChooseUsScrollReveal();

  // Inicializar Catálogo E-commerce Maderin si estamos en maderin.html
  initMaderinEcommerce();

  // Inicializar el modal de cotización de AC Mueblería (si existe en la página)
  initQuoteModal();
});
