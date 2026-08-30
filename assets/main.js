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
  const chips = document.querySelectorAll(".filter-chip");
  const cards = document.querySelectorAll("[data-category]");
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
        desc: "Módulos altos y bajos en melamina Capri RH resistente a la humedad, tiradores gola ocultos y cubierta de Cuarzo negro pulido.",
        location: "Independencia",
        dimensions: "450 × 60 cm",
        material: "Melamina Capri RH 18mm",
        finish: "Tiradores ocultos + Cuarzo",
        img: "public/ac_muebleria/trabajos/cocina-01.png",
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Cocina en L (Capri + Cuarzo negro)."
      },
      {
        index: 1,
        category: "Closets & Vestidores",
        counter: "02 / 06",
        title: "Closet modular",
        subtitle: "Melamina Toquilla + Jaladores de aluminio",
        desc: "Closet integral con iluminación LED interna, sabanera superior, cajonera con correderas telescópicas y doble zona de percheros.",
        location: "Los Olivos",
        dimensions: "150 × 240 × 55 cm",
        material: "Melamina Toquilla 18mm",
        finish: "Jaladores aluminio + LED",
        img: "public/ac_muebleria/trabajos/vestidor-01.png",
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Closet modular (Toquilla)."
      },
      {
        index: 2,
        category: "Muebles de TV",
        counter: "03 / 06",
        title: "Mueble de TV flotante",
        subtitle: "Melamina blanca + Wall panel + SPC",
        desc: "Centro de entretenimiento flotante con repisas abiertas, compartimentos cerrados para consolas y pasacables completamente ocultos.",
        location: "SJL",
        dimensions: "240 × 40 × 45 cm",
        material: "Melamina Blanca + Wall Panel",
        finish: "Panel SPC + Luz LED cálida",
        img: "public/ac_muebleria/trabajos/mueble-tv-01.png",
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Mueble de TV flotante con Wall panel."
      },
      {
        index: 3,
        category: "Organizadores",
        counter: "04 / 06",
        title: "Mueble organizador",
        subtitle: "Melamina blanca + jaladores negros",
        desc: "Mueble a medida para almacenaje debajo de escalera y recibidor elegante con distribución inteligente de gavetas y repisas.",
        location: "Comas",
        dimensions: "140 × 180 × 100 cm",
        material: "Melamina Blanca 18mm",
        finish: "Jaladores negros mate",
        img: "public/ac_muebleria/trabajos/organizador-01.png",
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Mueble organizador bajo escalera."
      },
      {
        index: 4,
        category: "Oficina en Casa",
        counter: "05 / 06",
        title: "Oficina en casa",
        subtitle: "Melamina Espresso + Plomo",
        desc: "Estación de trabajo ergonómica con escritorio en L, archivador móvil, cajonera y repisas superiores con acabados de alta resistencia.",
        location: "Carabayllo",
        dimensions: "180 × 240 cm",
        material: "Melamina Espresso + Plomo RH",
        finish: "Correderas telescópicas pesadas",
        img: "public/ac_muebleria/trabajos/escritorio-01.png",
        waText: "Hola AC Mueblería, me interesa cotizar un proyecto similar a Oficina en casa (Escritorio en L)."
      },
      {
        index: 5,
        category: "Bares & Cocinas",
        counter: "06 / 06",
        title: "Mueble bar",
        subtitle: "Melamina Espresso y Gris + Cuarzo",
        desc: "Mueble bar residencial con iluminación LED perimetral, vitrinas con puertas vidriadas y bisagras con sistema de cierre suave.",
        location: "La Molina",
        dimensions: "170 × 240 × 50 cm",
        material: "Melamina Espresso + Gris",
        finish: "Puertas de vidrio + Cierre suave",
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

    // Navegación con flechas Prev / Next del carrusel
    function getCardScrollStep() {
      const cardWidth = cards[0].offsetWidth;
      const gap = parseInt(window.getComputedStyle(track).gap, 10) || 16;
      return cardWidth + gap;
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        const step = getCardScrollStep();
        viewport.scrollBy({ left: -step, behavior: "smooth" });
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const step = getCardScrollStep();
        viewport.scrollBy({ left: step, behavior: "smooth" });
      });
    }

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
            end: "+=1400",
            pin: true,
            scrub: 0.4,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          }
        });

        // 1. Línea horizontal de progreso: avanza de 0% a 100%
        if (hProgress) {
          masterTl.to(hProgress, {
            width: "100%",
            ease: "none",
            duration: 1.0,
          }, 0);
        }

        // 2. Activación secuencial sincronizada con la llegada de la línea a cada punto
        // Paso 1 (01): activo desde el inicio (t=0)
        if (steps[0]) {
          const dot = steps[0].querySelector(".process-dot");
          const content = steps[0].querySelector(".process-content");
          masterTl.to(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", duration: 0.05 }, 0);
          masterTl.to(content, { opacity: 1, y: 0, duration: 0.05 }, 0);
        }

        // Paso 2 (02): alcanzado al 25% de la línea
        if (steps[1]) {
          const dot = steps[1].querySelector(".process-dot");
          const content = steps[1].querySelector(".process-content");
          masterTl.to(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", duration: 0.08 }, 0.25);
          masterTl.to(content, { opacity: 1, y: 0, duration: 0.12 }, 0.25);
        }

        // Paso 3 (03): alcanzado al 50% de la línea
        if (steps[2]) {
          const dot = steps[2].querySelector(".process-dot");
          const content = steps[2].querySelector(".process-content");
          masterTl.to(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", duration: 0.08 }, 0.50);
          masterTl.to(content, { opacity: 1, y: 0, duration: 0.12 }, 0.50);
        }

        // Paso 4 (04): alcanzado al 75% de la línea
        if (steps[3]) {
          const dot = steps[3].querySelector(".process-dot");
          const content = steps[3].querySelector(".process-content");
          masterTl.to(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", duration: 0.08 }, 0.75);
          masterTl.to(content, { opacity: 1, y: 0, duration: 0.12 }, 0.75);
        }

        // Paso 5 (05): alcanzado al 98% de la línea
        if (steps[4]) {
          const dot = steps[4].querySelector(".process-dot");
          const content = steps[4].querySelector(".process-content");
          masterTl.to(dot, { borderColor: "#af8f1a", color: "#af8f1a", backgroundColor: "#151515", duration: 0.08 }, 0.98);
          masterTl.to(content, { opacity: 1, y: 0, duration: 0.12 }, 0.98);
        }

        // Breve pausa para visualizar el proceso completo antes de soltar el pin
        masterTl.to({}, { duration: 0.25 });
      },

      // Mobile y Tablet (<= 980px): scroll vertical fluido con animación card-por-card en #elegirnos y seguimiento en #proceso
      "(max-width: 980px)": function() {
        // --- 1. Animación de baraja de tarjetas apiladas en #elegirnos (cards contiguas visibles en profundidad) ---
        const elegirnosSection = document.getElementById("elegirnos");
        const featureCards = elegirnosSection ? elegirnosSection.querySelectorAll(".feature-card") : [];

        if (elegirnosSection && featureCards.length === 4) {
          // Posicionamiento y profundidad inicial de la baraja:
          // Card 0 en primer plano, Card 1 y 2 visibles parcialmente detrás con escala y desplazamiento vertical
          featureCards.forEach((card, i) => {
            const img = card.querySelector(".feature-img");
            const h3 = card.querySelector("h3");
            const p = card.querySelector("p");

            if (i === 0) {
              gsap.set(card, { autoAlpha: 1, y: 0, scale: 1, zIndex: 10, borderColor: "rgba(255,255,255,0.12)" });
            } else if (i === 1) {
              gsap.set(card, { autoAlpha: 0.75, y: 18, scale: 0.94, zIndex: 8, borderColor: "rgba(255,255,255,0.06)" });
            } else if (i === 2) {
              gsap.set(card, { autoAlpha: 0.45, y: 34, scale: 0.88, zIndex: 6, borderColor: "rgba(255,255,255,0.04)" });
            } else {
              gsap.set(card, { autoAlpha: 0, y: 48, scale: 0.82, zIndex: 4, borderColor: "rgba(255,255,255,0.02)" });
            }
            if (img) gsap.set(img, { opacity: 0 });
            if (h3) gsap.set(h3, { y: 0 });
            if (p) gsap.set(p, { opacity: 1 });
          });

          const cardsTl = gsap.timeline({
            scrollTrigger: {
              trigger: elegirnosSection,
              start: "top top",
              end: "+=2400",
              pin: true,
              scrub: 0.4,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            }
          });

          // ===== PASO 1: CARD 0 (01 Diseño a tu medida) =====
          const img0 = featureCards[0].querySelector(".feature-img");
          const h3_0 = featureCards[0].querySelector("h3");
          const p0 = featureCards[0].querySelector("p");
          cardsTl.to({}, { duration: 0.35 });
          if (img0) cardsTl.to(img0, { opacity: 0.85, duration: 1.0 }, "card0_photo");
          if (h3_0) cardsTl.to(h3_0, { y: 65, duration: 1.0 }, "card0_photo");
          if (p0) cardsTl.to(p0, { opacity: 0, duration: 1.0 }, "card0_photo");
          cardsTl.to(featureCards[0], { borderColor: "#af8f1a", duration: 1.0 }, "card0_photo");
          cardsTl.to({}, { duration: 0.4 });

          // ===== TRANSICIÓN 0 -> 1: Card 0 sube y se retira; Card 1 toma el frente; Card 2 y 3 avanzan en la baraja =====
          cardsTl.to(featureCards[0], { y: -50, scale: 0.98, autoAlpha: 0, zIndex: 12, duration: 0.85 }, "card1_enter");
          cardsTl.to(featureCards[1], { y: 0, scale: 1, autoAlpha: 1, zIndex: 10, borderColor: "rgba(255,255,255,0.12)", duration: 0.85 }, "card1_enter");
          cardsTl.to(featureCards[2], { y: 18, scale: 0.94, autoAlpha: 0.75, zIndex: 8, borderColor: "rgba(255,255,255,0.06)", duration: 0.85 }, "card1_enter");
          cardsTl.to(featureCards[3], { y: 34, scale: 0.88, autoAlpha: 0.45, zIndex: 6, borderColor: "rgba(255,255,255,0.04)", duration: 0.85 }, "card1_enter");
          cardsTl.to({}, { duration: 0.4 });

          // ===== PASO 2: CARD 1 (02 Materiales de calidad) =====
          const img1 = featureCards[1].querySelector(".feature-img");
          const h3_1 = featureCards[1].querySelector("h3");
          const p1 = featureCards[1].querySelector("p");
          if (img1) cardsTl.to(img1, { opacity: 0.85, duration: 1.0 }, "card1_photo");
          if (h3_1) cardsTl.to(h3_1, { y: 65, duration: 1.0 }, "card1_photo");
          if (p1) cardsTl.to(p1, { opacity: 0, duration: 1.0 }, "card1_photo");
          cardsTl.to(featureCards[1], { borderColor: "#af8f1a", duration: 1.0 }, "card1_photo");
          cardsTl.to({}, { duration: 0.4 });

          // ===== TRANSICIÓN 1 -> 2: Card 1 se retira; Card 2 toma el frente; Card 3 avanza a la posición contigua =====
          cardsTl.to(featureCards[1], { y: -50, scale: 0.98, autoAlpha: 0, zIndex: 12, duration: 0.85 }, "card2_enter");
          cardsTl.to(featureCards[2], { y: 0, scale: 1, autoAlpha: 1, zIndex: 10, borderColor: "rgba(255,255,255,0.12)", duration: 0.85 }, "card2_enter");
          cardsTl.to(featureCards[3], { y: 18, scale: 0.94, autoAlpha: 0.75, zIndex: 8, borderColor: "rgba(255,255,255,0.06)", duration: 0.85 }, "card2_enter");
          cardsTl.to({}, { duration: 0.4 });

          // ===== PASO 3: CARD 2 (03 Fabricación propia) =====
          const img2 = featureCards[2].querySelector(".feature-img");
          const h3_2 = featureCards[2].querySelector("h3");
          const p2 = featureCards[2].querySelector("p");
          if (img2) cardsTl.to(img2, { opacity: 0.85, duration: 1.0 }, "card2_photo");
          if (h3_2) cardsTl.to(h3_2, { y: 65, duration: 1.0 }, "card2_photo");
          if (p2) cardsTl.to(p2, { opacity: 0, duration: 1.0 }, "card2_photo");
          cardsTl.to(featureCards[2], { borderColor: "#af8f1a", duration: 1.0 }, "card2_photo");
          cardsTl.to({}, { duration: 0.4 });

          // ===== TRANSICIÓN 2 -> 3: Card 2 se retira; Card 3 toma el frente =====
          cardsTl.to(featureCards[2], { y: -50, scale: 0.98, autoAlpha: 0, zIndex: 12, duration: 0.85 }, "card3_enter");
          cardsTl.to(featureCards[3], { y: 0, scale: 1, autoAlpha: 1, zIndex: 10, borderColor: "rgba(255,255,255,0.12)", duration: 0.85 }, "card3_enter");
          cardsTl.to({}, { duration: 0.4 });

          // ===== PASO 4: CARD 3 (04 Instalación incluida) =====
          const img3 = featureCards[3].querySelector(".feature-img");
          const h3_3 = featureCards[3].querySelector("h3");
          const p3 = featureCards[3].querySelector("p");
          if (img3) cardsTl.to(img3, { opacity: 0.85, duration: 1.0 }, "card3_photo");
          if (h3_3) cardsTl.to(h3_3, { y: 65, duration: 1.0 }, "card3_photo");
          if (p3) cardsTl.to(p3, { opacity: 0, duration: 1.0 }, "card3_photo");
          cardsTl.to(featureCards[3], { borderColor: "#af8f1a", duration: 1.0 }, "card3_photo");
          cardsTl.to({}, { duration: 0.6 }); // Pausa final para apreciar Card 4 antes de continuar a Trabajos
        }

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
});
