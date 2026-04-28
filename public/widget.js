(function () {
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
      title: "Prueba esta demo",
      intro: "Los campos vienen llenos para que puedas probar rápido.",
      hello: "Hola. Soy el asistente de la barbería demo. Puedo ayudarte con servicios, precios, horarios y solicitudes de cita."
    },
    demo_dental: {
      name: "Paciente Demo",
      phone: "+525552222222",
      email: "paciente@demo.com",
      prompt: "Quiero una valoración dental esta semana",
      title: "Prueba esta demo",
      intro: "Los campos vienen llenos para que puedas probar rápido.",
      hello: "Hola. Soy el asistente de la clínica dental demo. Puedo orientarte con tratamientos, horarios y solicitudes de cita."
    },
    demo_proyectos: {
      name: "Alejandro",
      phone: "+525553333333",
      email: "contacto@negocio.com",
      prompt: "Tengo una estética, atiendo lunes a sábado, hago uñas y faciales, quiero capturar nombre, WhatsApp, servicio y horario.",
      title: "Recibe un diagnóstico de tu negocio",
      intro: "Deja tus datos y cuéntame tu proyecto para generar un ejemplo.",
      hello: "Hola. Para preparar tu diagnóstico, cuéntame qué negocio tienes, tus servicios, horarios, qué datos necesitas pedir y qué quieres automatizar."
    }
  };
  const defaults = widgetDefaults[businessId] || widgetDefaults.demo_proyectos;
  let from = "";

  const root = document.createElement("div");
  root.id = "autochat-widget-root";
  root.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:99999;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  root.innerHTML = `
    <button id="ac-toggle" style="width:78px;height:58px;border-radius:999px;border:0;background:#294139;color:#fff;font-weight:800;box-shadow:0 10px 24px rgba(0,0,0,.18);cursor:pointer">Chat</button>
    <section id="ac-panel" style="display:none;width:340px;max-width:calc(100vw - 36px);height:480px;background:#fff;border:1px solid #dfe5dc;border-radius:8px;box-shadow:0 18px 45px rgba(0,0,0,.18);overflow:hidden">
      <header style="background:#294139;color:#fff;padding:12px 14px;font-weight:800;display:flex;align-items:center;justify-content:space-between">
        <span>Asistente</span>
        <button id="ac-close" type="button" style="border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer">x</button>
      </header>
      <form id="ac-lead" style="height:424px;padding:14px;display:grid;align-content:center;gap:10px">
        <strong style="font-size:18px;color:#18211f">${defaults.title}</strong>
        <span style="color:#65736c;font-size:14px">${defaults.intro}</span>
        <input id="ac-name" value="${defaults.name}" placeholder="Nombre" required style="min-height:42px;border:1px solid #ccd5ce;border-radius:8px;padding:0 10px" />
        <input id="ac-phone" value="${defaults.phone}" placeholder="Teléfono / WhatsApp" required style="min-height:42px;border:1px solid #ccd5ce;border-radius:8px;padding:0 10px" />
        <input id="ac-email" value="${defaults.email}" placeholder="Correo opcional" type="email" style="min-height:42px;border:1px solid #ccd5ce;border-radius:8px;padding:0 10px" />
        <button style="min-height:44px;border:0;border-radius:8px;background:#c66d42;color:#fff;font-weight:800;cursor:pointer">Iniciar chat</button>
        <small id="ac-lead-error" style="color:#a23b27;min-height:16px"></small>
      </form>
      <div id="ac-chat" style="display:none">
        <div id="ac-messages" style="height:356px;overflow:auto;padding:12px;display:grid;gap:8px"></div>
        <form id="ac-form" style="display:grid;grid-template-columns:1fr 48px;gap:8px;padding:10px;border-top:1px solid #e2e6df">
          <input id="ac-input" value="${defaults.prompt}" placeholder="Escribe..." style="min-height:40px;border:1px solid #ccd5ce;border-radius:8px;padding:0 10px" />
          <button style="border:0;border-radius:8px;background:#c66d42;color:#fff;cursor:pointer">Ir</button>
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
  }

  function addMessage(text, who) {
    const bubble = document.createElement("div");
    bubble.textContent = text;
    bubble.style.cssText = `padding:9px 10px;border-radius:8px;white-space:pre-line;max-width:88%;line-height:1.35;${who === "me" ? "justify-self:end;background:#eaf6ed" : "justify-self:start;background:#f3f4f2"}`;
    messages.appendChild(bubble);
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
      chat.style.display = "block";
      addMessage(defaults.hello, "bot");
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
