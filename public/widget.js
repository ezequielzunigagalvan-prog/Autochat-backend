(async function () {
  const script = document.currentScript;
  const businessId = script?.dataset.businessId || "";
  const configuredApiUrl = script?.dataset.apiUrl || "";
  const apiUrl =
    configuredApiUrl && !(configuredApiUrl.includes("localhost") && !window.location.hostname.includes("localhost"))
      ? configuredApiUrl.replace(/\/$/, "")
      : window.location.origin;

  const widgetDefaults = {
    demo_barberia: {
      name: "Cliente Barbería",
      phone: "+525551111111",
      email: "cliente@demo.com",
      prompt: "Quiero un corte clásico mañana por la tarde",
      title: "AutoChat Barbería",
      intro: "Prueba cómo el asistente responde servicios, horarios y agenda.",
      hello: "Hola. Soy el asistente de la barbería demo. Puedo ayudarte con servicios, precios, horarios y solicitudes de cita."
    },
    demo_dental: {
      name: "Paciente Demo",
      phone: "+525552222222",
      email: "paciente@demo.com",
      prompt: "Quiero una valoración dental esta semana",
      title: "AutoChat Dental",
      intro: "Prueba cómo el asistente orienta pacientes y captura solicitudes.",
      hello: "Hola. Soy el asistente de la clínica dental demo. Puedo orientarte con tratamientos, horarios y solicitudes de cita."
    },
    demo_proyectos: {
      name: "Alejandro",
      phone: "+525553333333",
      email: "contacto@negocio.com",
      prompt: "Tengo una estética, atiendo lunes a sábado, hago uñas y faciales, quiero capturar nombre, WhatsApp, servicio y horario.",
      title: "Diagnóstico AutoChat",
      intro: "Deja tus datos y cuéntame tu proyecto para generar un ejemplo.",
      hello: "Hola. Para preparar tu diagnóstico, cuéntame qué negocio tienes, tus servicios, horarios, qué datos necesitas pedir y qué quieres automatizar."
    }
  };

  const defaults = { ...(widgetDefaults[businessId] || widgetDefaults.demo_proyectos) };
  if (businessId && !widgetDefaults[businessId]) {
    try {
      const response = await fetch(`${apiUrl}/api/public/businesses/${businessId}/widget`);
      if (response.ok) {
        const config = await response.json();
        defaults.title = config.title || defaults.title;
        defaults.intro = config.intro || defaults.intro;
        defaults.hello = config.hello || defaults.hello;
        defaults.prompt = config.prompt || defaults.prompt;
        defaults.name = "";
        defaults.phone = "";
        defaults.email = "";
      }
    } catch {
      // Keep local defaults if the public config cannot be loaded.
    }
  }

  let from = "";

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function quickRepliesFor(text) {
    const normalized = String(text || "").toLowerCase();
    if (normalized.includes("¿en qué puedo ayudarte") || normalized.includes("en que puedo ayudarte")) {
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
    if (normalized.includes("cotización") || normalized.includes("cotizacion")) {
      return [["Ver servicios", "servicios"], ["Hablar con alguien", "atención"]];
    }
    return [];
  }

  const root = document.createElement("div");
  root.id = "autochat-widget-root";
  root.innerHTML = `
    <style>
      #autochat-widget-root{position:fixed;right:18px;bottom:18px;z-index:99999;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1d2421}
      #autochat-widget-root *{box-sizing:border-box}
      #ac-toggle{min-width:76px;height:58px;border:0;border-radius:999px;background:#1f5c50;color:#fff;font-weight:900;box-shadow:0 16px 34px rgba(15,35,29,.26);cursor:pointer;padding:0 18px}
      #ac-panel{display:none;width:380px;max-width:calc(100vw - 28px);height:590px;max-height:calc(100vh - 34px);background:#f7f8f6;border:1px solid #d9e1db;border-radius:22px;box-shadow:0 22px 60px rgba(17,29,24,.24);overflow:hidden}
      .ac-header{min-height:86px;background:#1f5c50;color:#fff;padding:16px;display:grid;grid-template-columns:42px 1fr 34px;gap:12px;align-items:center}
      .ac-avatar{width:42px;height:42px;border-radius:999px;background:#eef7f0;color:#1f5c50;display:grid;place-items:center;font-weight:900;border:1px solid rgba(255,255,255,.42)}
      .ac-title{display:grid;gap:2px;min-width:0}
      .ac-title strong{font-size:18px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ac-title span{font-size:13px;opacity:.86;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #ac-close{width:34px;height:34px;border:0;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;font-size:18px;cursor:pointer}
      #ac-lead{height:504px;padding:18px;display:grid;align-content:center;gap:10px}
      #ac-lead strong{font-size:20px;color:#17211d}
      #ac-lead span{color:#64706a;font-size:14px;line-height:1.45}
      #ac-lead input,#ac-input{min-height:44px;border:1px solid #cad4ce;border-radius:14px;background:#fff;padding:0 13px;font:inherit;color:#17211d}
      #ac-lead button,#ac-form button{min-height:44px;border:0;border-radius:14px;background:#c66d42;color:#fff;font-weight:900;cursor:pointer}
      #ac-lead-error{color:#a23b27;min-height:16px}
      #ac-chat{display:none;height:504px;grid-template-rows:1fr auto}
      #ac-messages{height:424px;overflow:auto;padding:18px 14px;display:grid;gap:10px;align-content:start;background:linear-gradient(#fff,#f7f8f6)}
      .ac-bubble{display:grid;gap:5px;max-width:90%}
      .ac-bubble span{font-size:12px;color:#708078}
      .ac-bubble div{padding:11px 13px;border-radius:18px;white-space:pre-line;line-height:1.38;box-shadow:0 1px 0 rgba(0,0,0,.03)}
      .ac-bubble.bot{justify-self:start}.ac-bubble.bot div{background:#fff;border:1px solid #e3e8e4;border-top-left-radius:7px}
      .ac-bubble.me{justify-self:end}.ac-bubble.me div{background:#e6f3eb;color:#143d30;border-top-right-radius:7px}
      .ac-options{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}
      .ac-options button{border:1px solid #cbd5cf;background:#fff;color:#3f4b45;border-radius:999px;min-height:36px;padding:0 12px;cursor:pointer}
      .ac-options button:hover{border-color:#1f5c50;color:#1f5c50}
      #ac-form{display:grid;grid-template-columns:1fr 48px;gap:8px;padding:12px;border-top:1px solid #e0e6e1;background:#fff}
      #ac-form button{border-radius:999px}
      @media(max-width:520px){#autochat-widget-root{right:10px;bottom:10px}#ac-panel{width:calc(100vw - 20px);height:calc(100vh - 20px);max-height:none;border-radius:18px}#ac-lead,#ac-chat{height:calc(100vh - 106px)}#ac-messages{height:calc(100vh - 186px)}}
    </style>
    <button id="ac-toggle" type="button">Chat</button>
    <section id="ac-panel" aria-label="Chat de atención">
      <header class="ac-header">
        <div class="ac-avatar">AI</div>
        <div class="ac-title">
          <strong>${escapeHtml(defaults.title)}</strong>
          <span>${escapeHtml(defaults.intro)}</span>
        </div>
        <button id="ac-close" type="button" aria-label="Cerrar chat">×</button>
      </header>
      <form id="ac-lead">
        <strong>Antes de iniciar</strong>
        <span>${escapeHtml(defaults.intro)}</span>
        <input id="ac-name" value="${escapeHtml(defaults.name)}" placeholder="Nombre" required />
        <input id="ac-phone" value="${escapeHtml(defaults.phone)}" placeholder="Teléfono / WhatsApp" required />
        <input id="ac-email" value="${escapeHtml(defaults.email)}" placeholder="Correo opcional" type="email" />
        <button type="submit">Iniciar chat</button>
        <small id="ac-lead-error"></small>
      </form>
      <div id="ac-chat">
        <div id="ac-messages"></div>
        <form id="ac-form">
          <input id="ac-input" value="${escapeHtml(defaults.prompt)}" placeholder="Escribe tu mensaje..." />
          <button type="submit">Ir</button>
        </form>
      </div>
    </section>
  `;
  document.body.appendChild(root);

  const toggle = root.querySelector("#ac-toggle");
  const panel = root.querySelector("#ac-panel");
  const close = root.querySelector("#ac-close");
  const leadForm = root.querySelector("#ac-lead");
  const leadError = root.querySelector("#ac-lead-error");
  const chat = root.querySelector("#ac-chat");
  const messages = root.querySelector("#ac-messages");
  const form = root.querySelector("#ac-form");
  const input = root.querySelector("#ac-input");

  function openPanel() {
    panel.style.display = "block";
    toggle.style.display = "none";
  }

  function closePanel() {
    panel.style.display = "none";
    toggle.style.display = "block";
    resetWidget();
  }

  function resetWidget() {
    from = "";
    messages.innerHTML = "";
    leadError.textContent = "";
    leadForm.style.display = "grid";
    chat.style.display = "none";
    root.querySelector("#ac-name").value = defaults.name;
    root.querySelector("#ac-phone").value = defaults.phone;
    root.querySelector("#ac-email").value = defaults.email;
    input.value = defaults.prompt;
  }

  function sendQuickReply(value) {
    input.value = value;
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
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

    messages.scrollTop = messages.scrollHeight;
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

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    leadError.textContent = "";
    const name = root.querySelector("#ac-name").value.trim();
    const phone = root.querySelector("#ac-phone").value.trim();
    const email = root.querySelector("#ac-email").value.trim();

    try {
      const response = await fetch(`${apiUrl}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name,
          phone,
          email,
          source: "widget_web",
          notes: "Lead capturado desde widget web"
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo iniciar el chat.");

      from = body.from;
      leadForm.style.display = "none";
      chat.style.display = "grid";
      addMessage(defaults.hello, "bot");
      addMessage("¿En qué puedo ayudarte hoy?", "bot");
    } catch (error) {
      leadError.textContent = error.message || "No se pudo iniciar el chat.";
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !from) return;
    input.value = "";
    addMessage(text, "me");

    try {
      const response = await fetch(`${apiUrl}/api/conversations/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, from, text })
      });
      const body = await response.json();
      addMessage(body.outboundText || "No pude responder en este momento.", "bot");
    } catch {
      addMessage("No pude conectar con el asistente. Intenta de nuevo en un momento.", "bot");
    }
  });
})();
