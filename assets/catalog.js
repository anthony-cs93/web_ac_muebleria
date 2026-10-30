// ============================================================
// Catálogo compartido de Maderin y Corazón de Madera (CDM)
//
// - DEFAULTS: productos originales de la web. Sirven de respaldo si el panel /admin
//   todavía no guardó nada o si la API no responde.
// - load(shop): trae el catálogo publicado desde /api/catalog (lo que se edita en /admin);
//   si falla o no hay nada guardado, usa DEFAULTS. Siempre devuelve productos normalizados
//   en el orden definido en el admin, incluidos los ocultos (quien renderiza filtra `hidden`).
// ============================================================
(function () {
  const DEFAULTS = {
  maderin: [
    {"id":"cama-casita","category":"camas","sku":"MAD-CAM-01","name":"Cama Casita Montessori","subtitle":"Estructura en techo a dos aguas","desc":"Estructura baja inspirada en la metodología Montessori que promueve la libertad de movimiento y autonomía de tu pequeño, con bordes cuidadosamente redondeados y selladores ecológicos no tóxicos.","price":480,"oldPrice":550,"badge":"Más Vendido","rating":4.9,"reviewsCount":38,"dimensions":"90 × 190 × 145 cm (1 Plaza)","material":"Pino selecto secado al horno","ageRange":"2 a 10 años","deliveryTime":"5 a 7 días hábiles","finish":"Laca selladora al agua no tóxica","colors":[{"name":"Pino Natural","hex":"#D8BC94"},{"name":"Blanco Nieve","hex":"#FFFFFF"},{"name":"Gris Nórdico","hex":"#D1D5DB"},{"name":"Rosa Pastel","hex":"#FBCFE8"}],"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><path d=\"M6 34V20l18-12 18 12v14\"/><path d=\"M6 34h36M12 34v6M36 34v6\"/><path d=\"M12 24h24\"/></svg>","hidden":false,"stock":"order","cardDesc":"Estructura baja a ras de suelo con techo a dos aguas. Máxima seguridad y autonomía."},
    {"id":"cama-montessori-con-barandas","photo":"cama-montessori-con-barandas","category":"camas","sku":"MAD-CAM-02","name":"Cama Montessori con Barandas","subtitle":"Cama Montessori con Barandas","desc":"Cama baja a ras de suelo con barandas de listones en los cuatro lados, para que descanse seguro y se mueva con libertad.","price":850,"oldPrice":null,"badge":"Nuevo","stock":"order","rating":null,"reviewsCount":0,"dimensions":"Por confirmar","material":"Por confirmar","ageRange":"Por confirmar","deliveryTime":"15 a 20 días","finish":"Por confirmar","colors":[{"name":"Por definir","hex":"#E5DCCB"}],"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><path d=\"M6 34V20l18-12 18 12v14\"/><path d=\"M6 34h36M12 34v6M36 34v6\"/><path d=\"M12 24h24\"/></svg>","hidden":false,"cardDesc":"Cama baja a ras de suelo con barandas de listones en los cuatro lados, para que descanse seguro y se mueva con libertad."},
    {"id":"librero-frontal","category":"guardado","sku":"MAD-GUA-01","name":"Librero Frontal Montessori","subtitle":"3 niveles de cuentos a la vista","desc":"Los niños eligen sus lecturas por la portada. Este librero a su altura estimula la autonomía, el hábito lector diario y el orden en su habitación sin riesgo de caídas.","price":140,"oldPrice":165,"badge":"Lectura Temprana","rating":5,"reviewsCount":42,"dimensions":"75 × 30 × 80 cm","material":"MDF 15mm + Pino macizo","ageRange":"1 a 8 años","deliveryTime":"3 a 5 días hábiles","finish":"Esmalte satinado lavable","colors":[{"name":"Pino Natural","hex":"#D8BC94"},{"name":"Blanco Nieve","hex":"#FFFFFF"},{"name":"Verde Menta","hex":"#A7F3D0"},{"name":"Rosa Pastel","hex":"#FBCFE8"}],"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><rect x=\"8\" y=\"10\" width=\"32\" height=\"30\" rx=\"2\"/><line x1=\"8\" y1=\"20\" x2=\"40\" y2=\"20\"/><line x1=\"8\" y1=\"30\" x2=\"40\" y2=\"30\"/><line x1=\"12\" y1=\"18\" x2=\"36\" y2=\"18\"/><line x1=\"12\" y1=\"28\" x2=\"36\" y2=\"28\"/></svg>","hidden":false,"stock":"order","cardDesc":"Portadas de cuentos a la vista de los niños para estimular el amor por la lectura."},
    {"id":"organizador-juguetes","photo":"organizador-juguetes","category":"guardado","sku":"MAD-GUA-02","name":"Organizador de Juguetes 6 Gavetas","subtitle":"Módulo bajo con gavetas ligeras","desc":"Facilita la clasificación de juguetes, bloques y manualidades. Gavetas ultra-ligeras que los pequeños pueden mover y acomodar de forma 100% independiente.","price":195,"oldPrice":230,"badge":"Autonomía","rating":4.9,"reviewsCount":31,"dimensions":"85 × 32 × 65 cm","material":"Melamina Pelíkano 18mm","ageRange":"2 a 9 años","deliveryTime":"4 a 6 días hábiles","finish":"Cantos gruesos termo-adheridos","colors":[{"name":"Blanco Nórdico","hex":"#FFFFFF"},{"name":"Pino Natural","hex":"#D8BC94"},{"name":"Gris Claro","hex":"#E5E7EB"}],"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" rx=\"2\"/><line x1=\"8\" y1=\"24\" x2=\"40\" y2=\"24\"/><line x1=\"24\" y1=\"8\" x2=\"24\" y2=\"40\"/><rect x=\"12\" y=\"12\" width=\"8\" height=\"8\" rx=\"1\"/><rect x=\"28\" y=\"12\" width=\"8\" height=\"8\" rx=\"1\"/><rect x=\"12\" y=\"28\" width=\"8\" height=\"8\" rx=\"1\"/><rect x=\"28\" y=\"28\" width=\"8\" height=\"8\" rx=\"1\"/></svg>","hidden":false,"stock":"order","cardDesc":"Cubos y gavetas ligeras para que guarden sus bloques y juguetes por sí mismos."},
    {"id":"torre-aprendizaje","category":"accesorios","sku":"MAD-ACC-01","name":"Torre de Aprendizaje Regulable","subtitle":"3 alturas de piso con barra de seguridad","desc":"Permite al niño alcanzar la mesada de cocina o mesa con total estabilidad para cocinar, lavarse las manos y participar activamente en las tareas del hogar.","price":175,"oldPrice":210,"badge":"Favorito Padres","rating":4.9,"reviewsCount":56,"dimensions":"42 × 40 × 90 cm","material":"Madera pino selecto 20mm","ageRange":"18 meses a 5 años","deliveryTime":"3 a 5 días hábiles","finish":"Base antideslizante y cantos redondeados","colors":[{"name":"Pino Natural","hex":"#D8BC94"},{"name":"Blanco Nieve","hex":"#FFFFFF"},{"name":"Gris Nórdico","hex":"#D1D5DB"}],"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><path d=\"M12 42L18 8h12l6 34\"/><line x1=\"15\" y1=\"28\" x2=\"33\" y2=\"28\"/><line x1=\"16\" y1=\"20\" x2=\"32\" y2=\"20\"/><line x1=\"18\" y1=\"12\" x2=\"30\" y2=\"12\"/><path d=\"M12 42h24\"/></svg>","hidden":false,"stock":"order","cardDesc":"3 niveles de altura para cocinar, lavarse y participar en familia de forma segura."},
    {"id":"mesa-silla","photo":"mesa-silla","category":"escritorio","sku":"MAD-ESC-01","name":"Mesa + Silla Ergonómica Infantil","subtitle":"Set de estudio y juego boleado","desc":"Mesa cuadrada con esquinas boleadas y silla robusta de soporte lumbar ergonómico. Superficie tratada para fácil limpieza ante témperas, plumones y plastilinas.","price":240,"oldPrice":280,"badge":"Set Ergonómico","rating":4.8,"reviewsCount":19,"dimensions":"Mesa 60×60×48 cm · Silla 30×30×52 cm","material":"Madera pino + Cubierta lavable","ageRange":"2 a 7 años","deliveryTime":"4 a 6 días hábiles","finish":"Laca protectora poliuretano mate","colors":[{"name":"Pino Natural","hex":"#D8BC94"},{"name":"Blanco + Pino","hex":"#F3F4F6"},{"name":"Rosa Pastel","hex":"#FBCFE8"},{"name":"Verde Menta","hex":"#A7F3D0"}],"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><rect x=\"6\" y=\"16\" width=\"24\" height=\"6\" rx=\"1\"/><line x1=\"10\" y1=\"22\" x2=\"10\" y2=\"38\"/><line x1=\"26\" y1=\"22\" x2=\"26\" y2=\"38\"/><path d=\"M34 14v24M34 26h8v12M42 26v-6\"/></svg>","hidden":false,"stock":"order","cardDesc":"Set completo para juego, arte y estudio. Esquinas suaves y fácil limpieza."},
    {"id":"escritorio-gaveta","category":"escritorio","sku":"MAD-ESC-02","name":"Escritorio Escolar con Gaveta","subtitle":"Amplio espacio para tareas y libros","desc":"Diseñado para los primeros años de primaria. Cuenta con cajón silencioso con tope de seguridad, canal para lápices y estructura reforzada de pino macizo.","price":260,"oldPrice":310,"badge":"Primaria","rating":4.9,"reviewsCount":22,"dimensions":"80 × 50 × 62 cm","material":"Pino macizo + MDF laqueado","ageRange":"4 a 10 años","deliveryTime":"5 a 7 días hábiles","finish":"Rieles telescópicos y acabado mate","colors":[{"name":"Pino Natural","hex":"#D8BC94"},{"name":"Blanco Nieve","hex":"#FFFFFF"},{"name":"Gris Cálido","hex":"#E5E7EB"}],"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><rect x=\"6\" y=\"16\" width=\"36\" height=\"8\" rx=\"1\"/><line x1=\"10\" y1=\"24\" x2=\"10\" y2=\"40\"/><line x1=\"38\" y1=\"24\" x2=\"38\" y2=\"40\"/><line x1=\"18\" y1=\"20\" x2=\"30\" y2=\"20\"/></svg>","hidden":false,"stock":"order","cardDesc":"Superficie amplia con cajón de rieles silenciosos para libros y útiles escolares."},
    {"id":"perchero-tipi","photo":"perchero-tipi","category":"accesorios","sku":"MAD-ACC-02","name":"Perchero Tipi con Zapatero","subtitle":"Colgador bajito con base organizadora","desc":"Permite a los pequeños colgar sus casacas, mochilas y ordenar su calzado al volver a casa. Estructura triangular tipo tipi súper estable que no se tambalea.","price":95,"oldPrice":115,"badge":"Compacto","rating":4.8,"reviewsCount":17,"dimensions":"40 × 40 × 110 cm","material":"Madera pino 100% macizo","ageRange":"2 a 9 años","deliveryTime":"2 a 4 días hábiles","finish":"Lijado fino al tacto y sellador ecológico","colors":[{"name":"Pino Natural","hex":"#D8BC94"},{"name":"Blanco Nieve","hex":"#FFFFFF"},{"name":"Bicolor (Pino/Blanco)","hex":"#EADCC9"}],"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><path d=\"M16 42L24 6l8 36\"/><line x1=\"19\" y1=\"22\" x2=\"29\" y2=\"22\"/><line x1=\"14\" y1=\"36\" x2=\"34\" y2=\"36\"/></svg>","hidden":false,"stock":"order","cardDesc":"Colgador bajito para mochilas y casacas con base organizadora de calzado."},
    {"id":"closet-montessori","photo":"closet-montessori","category":"guardado","sku":null,"name":"Closet Montessori","subtitle":"Ropa y calzado a su altura","desc":"Closet bajo con barra a la altura de tu peque, repisas laterales y espacio para calzado, para que elija y guarde su ropa solo.","price":null,"oldPrice":null,"badge":"Nuevo","rating":null,"reviewsCount":0,"dimensions":"Por confirmar","material":"Por confirmar","ageRange":"Por confirmar","deliveryTime":null,"finish":"Por confirmar","colors":[{"name":"Por definir","hex":"#E5DCCB"}],"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" rx=\"2\"/><line x1=\"8\" y1=\"24\" x2=\"40\" y2=\"24\"/></svg>","hidden":false,"stock":"order","cardDesc":"Closet bajo con barra a la altura de tu peque, repisas laterales y espacio para calzado."},
    {"id":"comoda-cambiador","photo":"comoda-cambiador","category":"guardado","sku":null,"name":"Cómoda Cambiador","subtitle":"Cambiador superior con cajones","desc":"Cómoda con cambiador superior, puerta y tres cajones amplios. Un mueble que acompaña desde bebé.","price":null,"oldPrice":null,"badge":"Nuevo","rating":null,"reviewsCount":0,"dimensions":"Por confirmar","material":"Por confirmar","ageRange":"Por confirmar","deliveryTime":null,"finish":"Por confirmar","colors":[{"name":"Por definir","hex":"#E5DCCB"}],"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" rx=\"2\"/><line x1=\"8\" y1=\"24\" x2=\"40\" y2=\"24\"/></svg>","hidden":false,"stock":"order","cardDesc":"Cómoda con cambiador superior, puerta y tres cajones amplios."},
    {"id":"porta-libros","photo":"porta-libros","category":"guardado","sku":null,"name":"Porta Libros de Pared","subtitle":"Cuentos a la vista","desc":"Porta libros de pared de frente bajo para que vea y alcance sus cuentos por la portada.","price":null,"oldPrice":null,"badge":"Nuevo","rating":null,"reviewsCount":0,"dimensions":"Por confirmar","material":"Por confirmar","ageRange":"Por confirmar","deliveryTime":null,"finish":"Por confirmar","colors":[{"name":"Por definir","hex":"#E5DCCB"}],"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" rx=\"2\"/><line x1=\"8\" y1=\"24\" x2=\"40\" y2=\"24\"/></svg>","hidden":false,"stock":"order","cardDesc":"Frente bajo para que vea y alcance sus cuentos por la portada."},
    {"id":"repisa-libros","photo":"repisa-libros","category":"guardado","sku":null,"name":"Repisas para Libros","subtitle":"Repisas de pared para cuentos","desc":"Repisas de madera para exhibir los cuentos de frente, a la altura de los niños.","price":null,"oldPrice":null,"badge":"Nuevo","rating":null,"reviewsCount":0,"dimensions":"Por confirmar","material":"Por confirmar","ageRange":"Por confirmar","deliveryTime":null,"finish":"Por confirmar","colors":[{"name":"Por definir","hex":"#E5DCCB"}],"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" rx=\"2\"/><line x1=\"8\" y1=\"24\" x2=\"40\" y2=\"24\"/></svg>","hidden":false,"stock":"order","cardDesc":"Repisas de madera para exhibir los cuentos de frente."}
  ],
  cdm: [
    {"id":"cuadro-personalizado","category":"decoracion","name":"Cuadro personalizado","desc":"Nombre, fecha o frase grabada en madera, con marco a elección.","specs":["30 × 40 cm","MDF"],"price":65,"unit":"unidad","badge":"Personalizado","stock":"order","deliveryTime":null,"hidden":false,"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\"><rect x=\"12\" y=\"8\" width=\"24\" height=\"32\" rx=\"1\"/><rect x=\"16\" y=\"12\" width=\"16\" height=\"20\" rx=\"1\" opacity=\".7\"/></svg>"},
    {"id":"organizador-de-escritorio","category":"organizadores","name":"Organizador de escritorio","desc":"Compartimentos para lapiceros, notas y celular, con grabado a pedido.","specs":["22 × 12 × 10 cm","Melamina"],"price":55,"unit":"unidad","badge":"Personalizado","stock":"order","deliveryTime":null,"hidden":false,"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\"><rect x=\"8\" y=\"16\" width=\"32\" height=\"20\" rx=\"1\"/><line x1=\"8\" y1=\"24\" x2=\"40\" y2=\"24\"/><line x1=\"20\" y1=\"16\" x2=\"20\" y2=\"36\"/><line x1=\"30\" y1=\"16\" x2=\"30\" y2=\"36\"/></svg>"},
    {"id":"caja-de-recuerdos","category":"recuerdos","name":"Caja de recuerdos","desc":"Caja de madera con tapa grabada, ideal para guardar cartas y fotos.","specs":["20 × 15 × 10 cm","Pino"],"price":70,"unit":"unidad","badge":"Personalizado","stock":"order","deliveryTime":null,"hidden":false,"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\"><rect x=\"10\" y=\"14\" width=\"28\" height=\"22\" rx=\"1\"/><path d=\"M10 14l14 12 14-12\"/></svg>"},
    {"id":"portaretrato-de-madera","category":"decoracion","name":"Portaretrato de madera","desc":"Marco tallado con espacio para dedicatoria en la base.","specs":["15 × 20 cm","Pino"],"price":40,"unit":"unidad","badge":"Personalizado","stock":"order","deliveryTime":null,"hidden":false,"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\"><rect x=\"14\" y=\"10\" width=\"20\" height=\"28\" rx=\"10\"/><circle cx=\"24\" cy=\"24\" r=\"1.6\"/></svg>"},
    {"id":"rompecabezas-personalizado","category":"recuerdos","name":"Rompecabezas personalizado","desc":"Puzzle de madera con nombre o figura grabada a láser.","specs":["20 × 20 cm","MDF"],"price":35,"unit":"unidad","badge":"Personalizado","stock":"order","deliveryTime":null,"hidden":false,"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\"><rect x=\"9\" y=\"9\" width=\"12\" height=\"12\"/><rect x=\"27\" y=\"9\" width=\"12\" height=\"12\"/><rect x=\"9\" y=\"27\" width=\"12\" height=\"12\"/><rect x=\"27\" y=\"27\" width=\"12\" height=\"12\"/></svg>"},
    {"id":"set-de-mesa","category":"organizadores","name":"Set de mesa","desc":"Posavasos y base de melamina con diseño grabado, en set de 4.","specs":["10 × 10 cm c/u","Melamina"],"price":48,"unit":"set","badge":"Personalizado","stock":"order","deliveryTime":null,"hidden":false,"svg":"<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\"><rect x=\"8\" y=\"12\" width=\"32\" height=\"24\" rx=\"1\"/><line x1=\"8\" y1=\"20\" x2=\"40\" y2=\"20\"/><line x1=\"24\" y1=\"20\" x2=\"24\" y2=\"36\"/></svg>"}
  ]
  };

  const SHOPS = {
    maderin: {
      label: "Maderin",
      categories: [
        { id: "camas", label: "Camas Montessori" },
        { id: "guardado", label: "Guardado & Orden" },
        { id: "escritorio", label: "Escritorios & Mesas" },
        { id: "accesorios", label: "Accesorios & Estimulación" }
      ],
      photoDir: "public/maderin/productos/"
    },
    cdm: {
      label: "Corazón de Madera",
      categories: [
        { id: "decoracion", label: "Decoración" },
        { id: "organizadores", label: "Organizadores" },
        { id: "recuerdos", label: "Recuerdos" }
      ],
      photoDir: ""
    }
  };

  // Etiquetas sugeridas en el admin (también se puede escribir una propia)
  const BADGES = {
    maderin: ["Más Vendido", "Nuevo", "Favorito Padres", "Oferta", "Últimas unidades", "Edición limitada"],
    cdm: ["Más Vendido", "Nuevo", "Personalizado", "Regalo ideal", "Oferta", "Últimas unidades", "Edición limitada"]
  };
  // Etiquetas que se pintan con el estilo naranja de "promo"
  const PROMO_BADGES = ["más vendido", "oferta", "últimas unidades", "edición limitada"];

  // Iconos de respaldo cuando un producto nuevo aún no tiene foto
  const ICONS = {
    camas: '<path d="M6 34V20l18-12 18 12v14"/><path d="M6 34h36M12 34v6M36 34v6"/><path d="M12 24h24"/>',
    guardado: '<rect x="8" y="8" width="32" height="32" rx="2"/><line x1="8" y1="24" x2="40" y2="24"/>',
    escritorio: '<rect x="6" y="14" width="36" height="5" rx="1"/><path d="M10 19v19M38 19v19"/>',
    accesorios: '<path d="M16 42L24 6l8 36"/><line x1="19" y1="22" x2="29" y2="22"/><line x1="14" y1="36" x2="34" y2="36"/>',
    decoracion: '<rect x="12" y="8" width="24" height="32" rx="1"/><rect x="16" y="12" width="16" height="20" rx="1" opacity=".7"/>',
    organizadores: '<rect x="8" y="16" width="32" height="20" rx="1"/><line x1="8" y1="24" x2="40" y2="24"/><line x1="20" y1="16" x2="20" y2="36"/>',
    recuerdos: '<rect x="10" y="14" width="28" height="22" rx="1"/><path d="M10 14l14 12 14-12"/>'
  };
  const iconSvg = (cat) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5">${ICONS[cat] || ICONS.guardado}</svg>`;

  const str = (v, fallback = "") => (typeof v === "string" ? v : fallback);
  const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));

  // Colores = texturas de la biblioteca compartida (tex = id) con un color liso de respaldo (hex)
  const normColor = (c) => {
    const out = { name: String(c.name), hex: /^#[0-9a-f]{3,8}$/i.test(c.hex) ? c.hex : "#E5DCCB" };
    if (typeof c.tex === "string" && c.tex) out.tex = c.tex;
    return out;
  };
  let textures = [];
  const setTextures = (list) => { textures = Array.isArray(list) ? list.filter((t) => t && t.id && t.img) : []; };
  const getTextures = () => textures;
  const textureOf = (c) => (c && c.tex ? textures.find((t) => t.id === c.tex) || null : null);
  // Valor CSS `background` del círculo de un color: textura si existe, si no el color liso
  const swatchBg = (c) => {
    const t = textureOf(c);
    return t ? `url("${t.thumb || t.img}") center/cover no-repeat, ${c.hex}` : c.hex;
  };

  function normalize(list, shop) {
    const cfg = SHOPS[shop];
    const seen = new Set();
    return (Array.isArray(list) ? list : []).filter((p) => p && typeof p === "object" && p.id && !seen.has(p.id) && seen.add(p.id)).map((raw) => {
      const p = Object.assign({}, raw);
      const cat = cfg.categories.find((c) => c.id === p.category) || cfg.categories[0];
      p.category = cat.id;
      p.categoryLabel = cat.label;
      p.name = str(p.name, "Producto");
      p.desc = str(p.desc);
      p.price = num(p.price);
      p.oldPrice = num(p.oldPrice);
      if (p.oldPrice !== null && (p.price === null || p.oldPrice <= p.price)) p.oldPrice = null;
      p.discount = p.oldPrice !== null ? `Ahorra S/ ${p.oldPrice - p.price}` : null;
      p.badge = str(p.badge).trim() || null;
      p.stock = ["order", "ready", "out"].includes(p.stock) ? p.stock : "order";
      p.deliveryTime = str(p.deliveryTime).trim() || null;
      p.hidden = !!p.hidden;
      p.rating = num(p.rating);
      p.reviewsCount = num(p.reviewsCount) || 0;
      p.svg = p.svg || iconSvg(p.category);
      if (shop === "maderin") {
        p.cardDesc = str(p.cardDesc) || p.desc;
        p.subtitle = str(p.subtitle) || p.name;
        p.sku = str(p.sku).trim() || null;
        for (const k of ["dimensions", "material", "ageRange", "finish"]) p[k] = str(p[k]).trim() || "Por confirmar";
        const colors = Array.isArray(p.colors) ? p.colors.filter((c) => c && c.name) : [];
        p.colors = colors.length ? colors.map(normColor) : [{ name: "Por definir", hex: "#E5DCCB" }];
      } else {
        p.specs = (Array.isArray(p.specs) ? p.specs : []).map((s) => str(s).trim()).filter(Boolean);
        p.unit = str(p.unit).trim() || "unidad";
        p.custom = p.custom && typeof p.custom === "object"
          ? { label: str(p.custom.label).trim() || "Personalización", hint: str(p.custom.hint).trim(), max: Math.min(200, Math.max(5, Math.round(Number(p.custom.max)) || 60)), required: !!p.custom.required }
          : null;
        p.colors = (Array.isArray(p.colors) ? p.colors : []).filter((c) => c && c.name).map(normColor);
      }
      return p;
    });
  }

  // Foto del producto: subida desde el admin (img480/img900) o archivo heredado en public/
  function hasPhoto(p) {
    return !!(p.img480 || p.img900 || p.photo);
  }
  function photoUrl(p, width, shop) {
    const w = width >= 900 ? 900 : 480;
    if (p.img480 || p.img900) return (w === 900 ? p.img900 || p.img480 : p.img480 || p.img900);
    if (p.photo) return `${SHOPS[shop || "maderin"].photoDir}${p.photo}-${w}.webp`;
    return null;
  }

  // Disponibilidad: ready = listo para entrega | order = sobre pedido | out = agotado
  function stockInfo(p) {
    const state = p.stock || "order";
    const labels = {
      ready: "Listo para entrega",
      order: p.deliveryTime ? `Sobre pedido · ${p.deliveryTime}` : "Disponibilidad por confirmar",
      out: "Agotado por ahora"
    };
    return { state, label: labels[state] || labels.order };
  }

  const isPromo = (badge) => PROMO_BADGES.includes(String(badge || "").trim().toLowerCase());

  function defaultsFor(shop) {
    return normalize(JSON.parse(JSON.stringify(DEFAULTS[shop])), shop);
  }

  let remotePromise = null;
  function fetchRemote() {
    if (!remotePromise) {
      remotePromise = new Promise((resolve) => {
        const ctrl = typeof AbortController === "function" ? new AbortController() : null;
        const timer = setTimeout(() => { if (ctrl) ctrl.abort(); resolve(null); }, 3500);
        fetch("/api/catalog", { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: "application/json" } })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => { clearTimeout(timer); resolve(data && typeof data === "object" ? data : null); })
          .catch(() => { clearTimeout(timer); resolve(null); });
      });
    }
    return remotePromise;
  }

  async function load(shop) {
    const remote = await fetchRemote();
    if (remote) setTextures(remote.textures);
    if (remote && Array.isArray(remote[shop])) return normalize(remote[shop], shop);
    return defaultsFor(shop);
  }

  window.ACCatalog = { DEFAULTS, SHOPS, BADGES, ICONS, load, defaultsFor, normalize, iconSvg, hasPhoto, photoUrl, stockInfo, isPromo, setTextures, getTextures, textureOf, swatchBg };
})();
