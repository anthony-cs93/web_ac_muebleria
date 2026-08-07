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
      cards.forEach(card => {
        const show = cat === "todos" || card.getAttribute("data-category") === cat;
        card.style.display = show ? "" : "none";
      });
    });
  });

  // --- Reveal suave al hacer scroll ---
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add("in-view"));
  }

  // --- Sombra de nav al hacer scroll ---
  const nav = document.querySelector(".nav");
  if (nav){
    window.addEventListener("scroll", () => {
      nav.style.boxShadow = window.scrollY > 8 ? "0 8px 24px -18px rgba(0,0,0,.6)" : "none";
    });
  }

  // --- Lógica del timeline "Cómo trabajamos" (GSAP ScrollTrigger) ---
  // GSAP solo se carga en index.html; en las sub-marcas se omite este bloque
  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);

  const timeline = document.querySelector(".process-timeline-container");
  const steps = document.querySelectorAll(".process-step");
  const isDesktop = () => window.innerWidth > 980;

  if (timeline && steps.length) {
    const hProgress = document.getElementById("processHProgress");
    const vProgress = document.getElementById("processProgress");

    function createAnimations() {
      ScrollTrigger.getAll().forEach(t => t.kill());

      // Barra de progreso (scrub)
      if (isDesktop() && hProgress) {
        gsap.to(hProgress, {
          width: "100%",
          ease: "none",
          scrollTrigger: {
            trigger: timeline,
            start: "top 70%",
            end: "bottom 30%",
            scrub: 0.3,
          }
        });
      } else if (vProgress) {
        gsap.to(vProgress, {
          height: "100%",
          ease: "none",
          scrollTrigger: {
            trigger: timeline,
            start: "top 70%",
            end: "bottom 30%",
            scrub: 0.3,
          }
        });
      }

      // Cada paso se anima individualmente al entrar al viewport
      steps.forEach((step) => {
        const dot = step.querySelector(".process-dot");
        const content = step.querySelector(".process-content");

        gsap.fromTo(content,
          { opacity: 0.35, y: 8 },
          {
            opacity: 1, y: 0, duration: 0.5,
            scrollTrigger: {
              trigger: step,
              start: "top 75%",
              toggleActions: "play none none reverse",
            }
          }
        );

        gsap.fromTo(dot,
          { borderColor: "rgba(255,255,255,0.08)", color: "rgba(242,236,223,0.6)" },
          {
            borderColor: "#af8f1a", color: "#af8f1a", duration: 0.4,
            scrollTrigger: {
              trigger: step,
              start: "top 75%",
              toggleActions: "play none none reverse",
            }
          }
        );
      });
    }

    createAnimations();
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        ScrollTrigger.refresh();
        createAnimations();
      }, 250);
    });
  }
  }
});
