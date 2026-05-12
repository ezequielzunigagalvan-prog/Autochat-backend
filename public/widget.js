(async function () {
  const script = document.currentScript;
  const LUBRIPLAN_BUSINESS_ID = "cmoyi5hsk0005nd4f32980jsq";
  let businessId = script?.dataset.businessId || "";
  const configuredApiUrl = script?.dataset.apiUrl || "";
  const scriptOrigin = script?.src ? new URL(script.src, window.location.href).origin : window.location.origin;
  const hostName = window.location.hostname.toLowerCase();
  if (hostName.includes("lubriplan")) {
    businessId = LUBRIPLAN_BUSINESS_ID;
  }
  const apiUrl =
    configuredApiUrl && !(configuredApiUrl.includes("localhost") && !window.location.hostname.includes("localhost"))
      ? configuredApiUrl.replace(/\/$/, "")
      : scriptOrigin;

  const widgetDefaults = {
    demo_barberia: {
      prompt: "Quiero un corte clásico mañana por la tarde",
      title: "AutoChat Barbería",
      intro: "Prueba cómo el asistente responde servicios, horarios y agenda.",
      hello: "Hola. Soy el asistente de la barbería demo. ¿En qué puedo ayudarte hoy?"
    },
    demo_dental: {
      prompt: "Quiero una valoración dental esta semana",
      title: "AutoChat Dental",
      intro: "Orientación inicial y captura de pacientes.",
      hello: "Hola. Soy el asistente de la clínica dental demo. ¿En qué puedo ayudarte hoy?"
    },
    demo_proyectos: {
      prompt: "Tengo una estética, atiendo lunes a sábado, hago uñas y faciales, quiero capturar nombre, WhatsApp, servicio y horario.",
      title: "Diagnóstico AutoChat",
      intro: "Cuéntame tu proyecto y genero un ejemplo.",
      hello: "Hola. Para preparar tu diagnóstico, cuéntame qué negocio tienes, tus servicios, horarios, qué datos necesitas pedir y qué quieres automatizar."
    },
    [LUBRIPLAN_BUSINESS_ID]: {
      prompt: "",
      title: "Asistente LubriPlan",
      intro: "Conoce LubriPlan y solicita una implementación para tu planta.",
      hello: "Hola. Soy el asistente de LubriPlan. Puedo explicarte qué es, cómo funciona y cómo implementarlo en tu planta.\n\nTambién tenemos una promoción: implementación gratis y 3 meses de LubriPlan gratis.",
      quickReplies: [
        { label: "¿Qué es LubriPlan?", value: "Qué es LubriPlan" },
        { label: "Cómo funciona", value: "Cómo funciona LubriPlan" },
        { label: "Promoción", value: "Promoción de implementación gratis y 3 meses gratis" },
        { label: "Implementarlo en mi planta", value: "Quiero implementar LubriPlan en mi planta" }
      ],
      services: [
        {
          name: "Información de LubriPlan",
          description: "LubriPlan es una plataforma para ordenar, controlar y dar seguimiento a la lubricación industrial: equipos, puntos, rutas, frecuencias, ejecuciones, evidencias y alertas.",
          contactFields: ["name", "phone", "email", "company", "position", "city", "details"]
        },
        {
          name: "Implementación en planta",
          description: "La implementación se adapta a la operación de cada planta: alta de equipos, puntos de lubricación, rutinas, responsables, frecuencias y seguimiento desde el panel.",
          contactFields: ["name", "phone", "email", "company", "position", "city", "equipment", "details", "urgency"]
        },
        {
          name: "Promoción LubriPlan",
          description: "Promoción disponible: implementación gratis y 3 meses de LubriPlan gratis para iniciar el control de lubricación sin costo inicial de arranque.",
          contactFields: ["name", "phone", "email", "company", "position", "city", "details"]
        }
      ]
    }
  };

  const genericDefaults = {
    prompt: "",
    title: "Asistente AutoChat",
    intro: "Cargando configuración del asistente.",
    hello: businessId
      ? "Estoy cargando la configuración de este asistente. Si sigues viendo este mensaje, revisa que el script tenga el ID correcto del negocio."
      : "Este widget no tiene un negocio configurado. Copia el script desde el panel del cliente correcto."
  };
  const defaults = { ...genericDefaults, ...(widgetDefaults[businessId] || {}) };
  let loadedBusinessConfig = Boolean(widgetDefaults[businessId]);
  defaults.services = defaults.services || [];
  defaults.style = defaults.style || "premium";
  defaults.primaryColor = defaults.primaryColor || "#1f5c50";
  defaults.secondaryColor = defaults.secondaryColor || "#2f7a68";
  defaults.accentColor = defaults.accentColor || "#c66d42";
  defaults.backgroundColor = defaults.backgroundColor || "#f7f8f6";
  defaults.launcherText = defaults.launcherText || "Chat";
  defaults.avatarText = defaults.avatarText || "AI";
  defaults.position = defaults.position || "right";
  defaults.radius = defaults.radius || 24;
  defaults.quickReplies = defaults.quickReplies || [];
  defaults.contactTitle = defaults.contactTitle || "Datos de contacto";
  defaults.contactIntro = defaults.contactIntro || "Para que el equipo pueda darte seguimiento, déjame tus datos.";
  if (businessId && !businessId.startsWith("demo_")) {
    try {
      const response = await fetch(`${apiUrl}/api/public/businesses/${businessId}/widget`);
      if (response.ok) {
        const config = await response.json();
        loadedBusinessConfig = true;
        defaults.title = config.title || defaults.title;
        defaults.intro = config.intro || defaults.intro;
        defaults.hello = config.hello || defaults.hello;
        defaults.prompt = config.prompt || defaults.prompt;
        defaults.services = Array.isArray(config.services) ? config.services : [];
        defaults.style = config.style || defaults.style;
        defaults.primaryColor = config.primaryColor || defaults.primaryColor;
        defaults.secondaryColor = config.secondaryColor || defaults.secondaryColor;
        defaults.accentColor = config.accentColor || defaults.accentColor;
        defaults.backgroundColor = config.backgroundColor || defaults.backgroundColor;
        defaults.launcherText = config.launcherText || defaults.launcherText;
        defaults.avatarText = config.avatarText || defaults.avatarText;
        defaults.position = config.position || defaults.position;
        defaults.radius = Number(config.radius || defaults.radius);
        defaults.quickReplies = Array.isArray(config.quickReplies) ? config.quickReplies : defaults.quickReplies;
        defaults.contactTitle = config.contactTitle || defaults.contactTitle;
        defaults.contactIntro = config.contactIntro || defaults.contactIntro;
      }
    } catch {
      // Keep local defaults if the public config cannot be loaded.
    }
  }

  function createConversationId() {
    return `web-${businessId || "default"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  let from = createConversationId();
  let contactCaptured = false;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeText(value = "") {
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function parseContactFields(value) {
    if (Array.isArray(value)) return value.length ? value : ["name", "phone"];
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.length ? parsed : ["name", "phone"];
      } catch {
        return ["name", "phone"];
      }
    }
    return ["name", "phone"];
  }

  let selectedServiceName = "";
  let selectedContactFields = [];
  let lubriPlanLocalStep = "";
  let lubriPlanLocalData = {};

  function updateSelectedService(text = "") {
    const explicit = String(text).match(/Servicio:\s*([^\n]+)/i) || String(text).match(/Has seleccionado:\s*([^\n]+)/i);
    if (explicit?.[1]) {
      selectedServiceName = explicit[1].trim();
      return;
    }
    const normalized = normalizeText(text);
    const match = defaults.services.find((service) => normalized.includes(normalizeText(service.name)));
    if (match) selectedServiceName = match.name;
  }

  function updateContactConfig(conversation = {}) {
    if (Array.isArray(conversation.contactFields) && conversation.contactFields.length) {
      selectedContactFields = conversation.contactFields;
    }
    if (conversation.serviceName) {
      selectedServiceName = conversation.serviceName;
    }
  }

  function contactFieldsForSelectedService() {
    if (selectedContactFields.length) return selectedContactFields;
    if (!selectedServiceName) return ["name", "phone", "email"];
    const service = defaults.services.find((item) => normalizeText(item.name) === normalizeText(selectedServiceName));
    const fields = parseContactFields(service?.contactFields);
    const quoteMode = /cotiza|cotización|cotizacion|filtr|industrial|proyecto|renta|curso/i.test(`${defaults.prompt} ${defaults.hello}`);
    return quoteMode && fields.length <= 2
      ? ["name", "phone", "email", "company", "city", "equipment", "urgency"]
      : fields;
  }

  const fieldMeta = {
    name: { id: "ac-name", placeholder: "Nombre", type: "text" },
    phone: { id: "ac-phone", placeholder: "Teléfono / WhatsApp", type: "tel" },
    email: { id: "ac-email", placeholder: "Correo", type: "email" },
    company: { id: "ac-company", placeholder: "Empresa (opcional)", type: "text", required: false },
    position: { id: "ac-position", placeholder: "Puesto / cargo", type: "text" },
    address: { id: "ac-address", placeholder: "Dirección / ubicación", type: "text" },
    city: { id: "ac-city", placeholder: "Ciudad / zona", type: "text" },
    equipment: { id: "ac-equipment", placeholder: "Equipo / sistema", type: "text" },
    details: { id: "ac-details", placeholder: "Detalles adicionales", type: "text" },
    urgency: { id: "ac-urgency", placeholder: "Urgencia", type: "text" },
    preferredTime: { id: "ac-preferred-time", placeholder: "Horario preferido", type: "text" }
  };

  function quickRepliesFor(text) {
    if (businessId === "demo_proyectos") return [];
    const normalized = String(text || "").toLowerCase();
    if (normalized.includes("¿en qué puedo ayudarte") || normalized.includes("en que puedo ayudarte")) {
      if (defaults.quickReplies.length) {
        return defaults.quickReplies.map((item) => [item.label, item.value]);
      }
      if (!loadedBusinessConfig) return [];
      const quoteMode = /cotiza|cotización|cotizacion|filtr|industrial|proyecto|renta|curso/i.test(`${defaults.prompt} ${defaults.hello}`);
      return [
        ["Ver servicios", "servicios"],
        [quoteMode ? "Solicitar cotización" : "Agendar cita", quoteMode ? "cotización" : "agendar cita"],
        ["Atención", "atención"]
      ];
    }
    if (normalized.includes("qué tan urgente") || normalized.includes("que tan urgente")) {
      return [["Urgente", "Urgente"], ["Esta semana", "Esta semana"], ["Programado", "Programado"]];
    }
    if (normalized.includes("servicios disponibles") || normalized.includes("estos son nuestros servicios")) {
      const matches = [...String(text).matchAll(/^\s*(\d+)\.\s+(.+)$/gm)].slice(0, 5);
      if (matches.length) return matches.map((match) => [match[2].replace(/\s*\(.+\)$/, "").slice(0, 38), match[1]]);
    }
    return [];
  }

  function initialGreeting() {
    return /en qu[eé] puedo ayudarte/i.test(defaults.hello)
      ? defaults.hello
      : `${defaults.hello}\n\n¿En qué puedo ayudarte hoy?`;
  }

  function shouldAskContact(conversation) {
    if (contactCaptured) return false;
    const status = conversation?.status || "";
    const intent = conversation?.outboundText || "";
    return (
      ["needs_human", "appointment_confirmed", "appointment_rescheduled", "appointment_cancelled"].includes(status) ||
      intent.includes("dejé registrada tu solicitud") ||
      intent.includes("revisará la información") ||
      intent.includes("pasar con una persona")
    );
  }

  const root = document.createElement("div");
  root.id = "autochat-widget-root";
  root.innerHTML = `
    <style>
      #autochat-widget-root{--ac-primary:${escapeHtml(defaults.primaryColor)};--ac-secondary:${escapeHtml(defaults.secondaryColor)};--ac-accent:${escapeHtml(defaults.accentColor)};--ac-bg:${escapeHtml(defaults.backgroundColor)};--ac-radius:${Number(defaults.radius) || 24}px;position:fixed;${defaults.position === "left" ? "left:18px;right:auto;" : "right:18px;left:auto;"}bottom:18px;z-index:99999;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1d2421}
      #autochat-widget-root *{box-sizing:border-box}
      @keyframes ac-pop{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes ac-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
      @keyframes ac-pulse{0%{box-shadow:0 0 0 0 rgba(31,92,80,.28),0 18px 38px rgba(15,35,29,.28)}70%{box-shadow:0 0 0 13px rgba(31,92,80,0),0 18px 38px rgba(15,35,29,.28)}100%{box-shadow:0 0 0 0 rgba(31,92,80,0),0 18px 38px rgba(15,35,29,.28)}}
      @keyframes ac-message{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes ac-shimmer{from{transform:translateX(-120%)}to{transform:translateX(120%)}}
      @keyframes ac-dot{0%,80%,100%{opacity:.35;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}
      #ac-toggle{min-width:82px;height:60px;border:0;border-radius:999px;background:linear-gradient(135deg,var(--ac-primary),var(--ac-secondary));color:#fff;font-weight:900;box-shadow:0 18px 38px rgba(15,35,29,.28);cursor:pointer;padding:0 20px;animation:ac-float 4s ease-in-out infinite,ac-pulse 3s ease-out infinite;transition:transform .18s ease,filter .18s ease}
      #ac-toggle:hover{transform:translateY(-2px) scale(1.03);filter:saturate(1.08)}
      #ac-panel{display:none;width:390px;max-width:calc(100vw - 28px);height:600px;max-height:calc(100vh - 34px);background:var(--ac-bg);border:1px solid rgba(217,225,219,.92);border-radius:var(--ac-radius);box-shadow:0 28px 80px rgba(17,29,24,.28);overflow:hidden;transform-origin:${defaults.position === "left" ? "0 100%" : "100% 100%"};backdrop-filter:blur(10px)}
      #ac-panel.ac-open{animation:ac-pop .28s cubic-bezier(.2,.8,.2,1)}
      .ac-header{min-height:92px;background:linear-gradient(135deg,var(--ac-primary),var(--ac-secondary));color:#fff;padding:17px;display:grid;grid-template-columns:46px 1fr 36px;gap:13px;align-items:center;position:relative;overflow:hidden}
      .ac-header:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 15%,rgba(255,255,255,.16) 42%,transparent 66%);animation:ac-shimmer 5.2s ease-in-out infinite;pointer-events:none}
      .ac-avatar{width:46px;height:46px;border-radius:999px;background:#eef7f0;color:var(--ac-primary);display:grid;place-items:center;font-weight:900;border:1px solid rgba(255,255,255,.52);box-shadow:0 10px 24px rgba(0,0,0,.12);position:relative;z-index:1;overflow:hidden}
      .ac-avatar img{width:100%;height:100%;object-fit:cover}
      .ac-title{display:grid;gap:2px;min-width:0}.ac-title strong{font-size:18px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ac-title span{font-size:13px;opacity:.86;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ac-title,#ac-close{position:relative;z-index:1}
      #ac-close{width:36px;height:36px;border:0;border-radius:999px;background:rgba(255,255,255,.16);color:#fff;font-size:18px;cursor:pointer;transition:background .18s ease,transform .18s ease}
      #ac-close:hover{background:rgba(255,255,255,.26);transform:rotate(8deg)}
      #ac-chat{height:504px;display:grid;grid-template-rows:minmax(0,1fr) auto}
      #ac-messages{min-height:0;overflow:auto;padding:18px 14px;display:grid;gap:10px;align-content:start;background:linear-gradient(#fff,#f7f8f6)}
      .ac-bubble{display:grid;gap:5px;max-width:90%;animation:ac-message .24s ease both}.ac-bubble span{font-size:12px;color:#708078}.ac-bubble div{padding:12px 14px;border-radius:18px;white-space:pre-line;line-height:1.4;box-shadow:0 8px 22px rgba(17,29,24,.07)}
      .ac-bubble.bot{justify-self:start}.ac-bubble.bot div{background:#fff;border:1px solid #e3e8e4;border-top-left-radius:7px}.ac-bubble.me{justify-self:end}.ac-bubble.me div{background:linear-gradient(135deg,#e6f3eb,#d8eadf);color:#143d30;border-top-right-radius:7px}
      .ac-typing div{display:flex;gap:5px;align-items:center;min-width:56px}.ac-typing i{width:7px;height:7px;border-radius:999px;background:#7b8b83;display:block;animation:ac-dot 1.1s infinite}.ac-typing i:nth-child(2){animation-delay:.14s}.ac-typing i:nth-child(3){animation-delay:.28s}
      .ac-options{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px;animation:ac-message .28s ease both}.ac-options button{border:1px solid #cbd5cf;background:rgba(255,255,255,.92);color:#3f4b45;border-radius:999px;min-height:36px;padding:0 12px;cursor:pointer;transition:transform .16s ease,border-color .16s ease,color .16s ease,box-shadow .16s ease}.ac-options button:hover{border-color:var(--ac-primary);color:var(--ac-primary);transform:translateY(-1px);box-shadow:0 8px 18px rgba(31,92,80,.12)}
      #ac-form,.ac-contact-form{display:grid;grid-template-columns:1fr 48px;gap:8px;padding:12px;border-top:1px solid #e0e6e1;background:#fff}
      #ac-input,.ac-contact-form input{min-height:44px;border:1px solid #cad4ce;border-radius:14px;background:#fff;padding:0 13px;font:inherit;color:#17211d;transition:border-color .16s ease,box-shadow .16s ease}
      #ac-input:focus,.ac-contact-form input:focus{outline:none;border-color:var(--ac-secondary);box-shadow:0 0 0 4px rgba(47,122,104,.12)}
      #ac-form button,.ac-contact-form button{min-height:44px;border:0;border-radius:999px;background:linear-gradient(135deg,var(--ac-accent),var(--ac-accent));color:#fff;font-weight:900;cursor:pointer;transition:transform .16s ease,filter .16s ease}
      #ac-form button:hover,.ac-contact-form button:hover{transform:translateY(-1px);filter:saturate(1.08)}
      .ac-contact-form{grid-template-columns:1fr;align-content:start;max-height:250px;overflow:auto}.ac-contact-form strong{color:#17211d}.ac-contact-form span{color:#65736c;font-size:14px;line-height:1.35}.ac-contact-form small{color:#a23b27;min-height:16px}
      @media(max-width:520px){#autochat-widget-root{right:10px;left:10px;bottom:10px}#ac-panel{width:calc(100vw - 20px);height:calc(100vh - 20px);max-height:none;border-radius:18px}#ac-chat{height:calc(100vh - 106px)}#ac-messages{min-height:0}.ac-contact-form{max-height:280px}}
    </style>
    <button id="ac-toggle" type="button">${escapeHtml(defaults.launcherText)}</button>
    <section id="ac-panel" aria-label="Chat de atención">
      <header class="ac-header">
        <div class="ac-avatar"><img src="${apiUrl}/public/autochat-logo.png" alt="" /></div>
        <div class="ac-title"><strong>${escapeHtml(defaults.title)}</strong><span>${escapeHtml(defaults.intro)}</span></div>
        <button id="ac-close" type="button" aria-label="Cerrar chat">×</button>
      </header>
      <div id="ac-chat">
        <div id="ac-messages"></div>
        <form id="ac-form">
          <input id="ac-input" value="" placeholder="Escribe tu mensaje..." autocomplete="off" />
          <button type="submit">Ir</button>
        </form>
      </div>
    </section>
  `;
  document.body.appendChild(root);

  const toggle = root.querySelector("#ac-toggle");
  const panel = root.querySelector("#ac-panel");
  const close = root.querySelector("#ac-close");
  const chat = root.querySelector("#ac-chat");
  const messages = root.querySelector("#ac-messages");
  const form = root.querySelector("#ac-form");
  const input = root.querySelector("#ac-input");

  function scrollMessagesToBottom() {
    requestAnimationFrame(() => {
      messages.scrollTo({
        top: messages.scrollHeight,
        behavior: "smooth"
      });
    });
  }

  function addMessage(text, who) {
    const wrap = document.createElement("article");
    wrap.className = `ac-bubble ${who === "me" ? "me" : "bot"}`;
    wrap.innerHTML = `<span>${who === "me" ? "Tú" : escapeHtml(defaults.title)}</span><div></div>`;
    wrap.querySelector("div").textContent = text;
    messages.appendChild(wrap);

    if (who !== "me") {
      const replies = quickRepliesFor(text);
      if (replies.length) {
        const options = document.createElement("div");
        options.className = "ac-options";
        replies.forEach(([label, value]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = label;
          button.addEventListener("click", () => sendQuickReply(value));
          options.appendChild(button);
        });
        messages.appendChild(options);
      }
    }

    scrollMessagesToBottom();
  }

  function showTyping() {
    const wrap = document.createElement("article");
    wrap.className = "ac-bubble bot ac-typing";
    wrap.dataset.typing = "true";
    wrap.innerHTML = `<span>${escapeHtml(defaults.title)}</span><div><i></i><i></i><i></i></div>`;
    messages.appendChild(wrap);
    scrollMessagesToBottom();
    return () => wrap.remove();
  }

  function addContactForm() {
    if (root.querySelector("#ac-contact-form")) return;
    addMessage("Para que el equipo pueda darte seguimiento, déjame tus datos de contacto.", "bot");
    form.style.display = "none";
    chat.classList.add("contact-open");
    const contactForm = document.createElement("form");
    contactForm.id = "ac-contact-form";
    contactForm.className = "ac-contact-form";
    const fields = contactFieldsForSelectedService();
    contactForm.innerHTML = `
      <strong>${escapeHtml(defaults.contactTitle)}</strong>
      <span>${escapeHtml(defaults.contactIntro)}</span>
      ${fields.map((field) => {
        const meta = fieldMeta[field] || { id: `ac-${field}`, placeholder: field, type: "text" };
        return `<input id="${meta.id}" data-field="${field}" placeholder="${escapeHtml(meta.placeholder)}" type="${meta.type}" ${meta.required === false ? "" : "required"} />`;
      }).join("")}
      <button type="submit">Enviar datos</button>
      <small id="ac-lead-error"></small>
    `;
    chat.appendChild(contactForm);

    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorEl = contactForm.querySelector("#ac-lead-error");
      errorEl.textContent = "";
      const leadData = {};
      contactForm.querySelectorAll("[data-field]").forEach((field) => {
        leadData[field.dataset.field] = field.value.trim();
      });
      const name = leadData.name || "";
      const phone = leadData.phone || "";
      const email = leadData.email || "";
      const company = leadData.company || "";
      const position = leadData.position || "";
      const address = leadData.address || "";
      const city = leadData.city || "";
      const equipment = leadData.equipment || "";
      const details = leadData.details || "";
      const urgency = leadData.urgency || "";
      const preferredTime = leadData.preferredTime || "";
      try {
        const response = await fetch(`${apiUrl}/api/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            name,
            phone,
            email,
            company,
            position,
            address,
            city,
            equipment,
            details,
            urgency,
            preferredTime,
            previousFrom: from,
            source: "widget_web",
            notes: "Lead capturado al final del chat"
          })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "No se pudieron guardar los datos.");
        from = body.from;
        contactCaptured = true;
        contactForm.remove();
        chat.classList.remove("contact-open");
        form.style.display = "grid";
        addMessage("Gracias. Ya guardé tus datos y el equipo podrá dar seguimiento a tu solicitud.", "bot");
      } catch (error) {
        errorEl.textContent = error.message || "No se pudieron guardar los datos.";
      }
    });
  }

  function openPanel() {
    panel.style.display = "block";
    toggle.style.display = "none";
    if (!messages.children.length) addMessage(initialGreeting(), "bot");
  }

  function closePanel() {
    panel.style.display = "none";
    toggle.style.display = "block";
    messages.innerHTML = "";
    input.value = "";
    selectedServiceName = "";
    selectedContactFields = [];
    lubriPlanLocalStep = "";
    lubriPlanLocalData = {};
    contactCaptured = false;
    from = createConversationId();
    root.querySelector("#ac-contact-form")?.remove();
    chat.classList.remove("contact-open");
    form.style.display = "grid";
  }

  function sendQuickReply(value) {
    input.value = value;
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  }

  function localLubriPlanReply(text) {
    if (businessId !== LUBRIPLAN_BUSINESS_ID) return "";
    const normalized = normalizeText(text);
    if (lubriPlanLocalStep === "current_system") {
      lubriPlanLocalData.currentSystem = text.trim();
      lubriPlanLocalStep = "equipment_count";
      return "Gracias. ¿Cuántos equipos manejan aproximadamente en la planta? Puede ser un estimado.";
    }
    if (lubriPlanLocalStep === "equipment_count") {
      lubriPlanLocalData.equipmentCount = text.trim();
      lubriPlanLocalStep = "confirm";
      return [
        "Perfecto, con eso ya se entiende mejor el punto de partida:",
        "",
        `Sistema actual: ${lubriPlanLocalData.currentSystem || "No especificado"}`,
        `Equipos aproximados: ${lubriPlanLocalData.equipmentCount || "No especificado"}`,
        "",
        "LubriPlan te ayudaría a centralizar rutas, puntos de lubricación, responsables, evidencias y alertas para que el seguimiento no dependa de hojas sueltas o memoria operativa.",
        "",
        "La implementación suele ser relativamente rápida porque se puede iniciar con la carga de equipos, puntos críticos, frecuencias y responsables, sin cambiar toda la operación de golpe.",
        "",
        "¿Te gustaría implementar LubriPlan en tu planta?"
      ].join("\n");
    }
    if (lubriPlanLocalStep === "confirm" && (normalized.includes("si") || normalized.includes("sí") || normalized.includes("claro") || normalized.includes("ok"))) {
      selectedServiceName = "Implementación en planta";
      selectedContactFields = ["name", "phone", "email", "company"];
      lubriPlanLocalStep = "";
      return "Perfecto. Déjame tus datos para que el equipo pueda contactarte y revisar la implementación de LubriPlan en tu planta.";
    }
    if (normalized.includes("que es") || normalized.includes("qué es") || normalized.includes("informacion")) {
      return "LubriPlan es una plataforma para gestionar la lubricación industrial. Ayuda a ordenar equipos, puntos de lubricación, rutas, frecuencias, responsables, evidencias y alertas para que mantenimiento tenga una operación más visible y controlada.";
    }
    if (normalized.includes("como funciona") || normalized.includes("cómo funciona")) {
      return "Funciona registrando equipos, puntos de lubricación y rutinas. El equipo técnico ejecuta actividades, sube evidencias y el panel permite revisar avances, pendientes, alertas e historial de cada punto.";
    }
    if (normalized.includes("promocion") || normalized.includes("promoción") || normalized.includes("gratis")) {
      lubriPlanLocalStep = "promo";
      return "La promoción actual incluye implementación gratis y 3 meses de LubriPlan gratis. Sirve para arrancar el control de lubricación de tu planta sin costo inicial de implementación.\n\n¿Quieres que revisemos la implementación para tu planta?";
    }
    if (normalized.includes("implementar") || normalized.includes("planta") || normalized.includes("demo") || (lubriPlanLocalStep === "promo" && (normalized.includes("si") || normalized.includes("sí")))) {
      selectedServiceName = "Implementación en planta";
      selectedContactFields = ["name", "phone", "email", "company"];
      lubriPlanLocalStep = "current_system";
      return "Perfecto. Para revisar la implementación de LubriPlan en tu planta, primero dime: ¿con qué sistema llevan actualmente la lubricación? Por ejemplo: Excel, papel, pizarrón, otro software o no tienen un control formal.";
    }
    return "Puedo ayudarte a conocer LubriPlan, explicar cómo funciona, revisar la promoción o solicitar una implementación para tu planta.";
  }

  toggle.addEventListener("click", openPanel);
  close.addEventListener("click", closePanel);
  window.AutoChatWidget = { open: openPanel, close: closePanel };
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.("[data-open-chat], .js-open-chat, a[href='#chat']");
    if (!trigger) return;
    event.preventDefault();
    openPanel();
  });
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#chat") openPanel();
  });
  window.setTimeout(() => {
    if (window.location.hash === "#chat") openPanel();
  }, 0);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !from) return;
    input.value = "";
    addMessage(text, "me");

    try {
      const hideTyping = showTyping();
      const response = await fetch(`${apiUrl}/api/conversations/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, from, text })
      });
      const body = await response.json();
      hideTyping();
      addMessage(body.outboundText || "No pude responder en este momento.", "bot");
      updateContactConfig(body);
      updateSelectedService(body.outboundText || "");
      if (shouldAskContact(body)) addContactForm();
    } catch {
      root.querySelector("[data-typing='true']")?.remove();
      const fallbackReply = localLubriPlanReply(text);
      addMessage(fallbackReply || "No pude conectar con el asistente. Intenta de nuevo en un momento.", "bot");
      if (fallbackReply && /déjame tus datos|deja tus datos|contactarte/i.test(fallbackReply)) addContactForm();
    }
  });
})();
