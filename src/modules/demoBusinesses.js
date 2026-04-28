import { prisma } from "../prisma.js";

const DEMO_BUSINESSES = {
  demo_barberia: {
    name: "Barbería Demo",
    niche: "barberia",
    phone: "+52 555 111 1111",
    address: "Sucursal Centro",
    hours: "Lunes a sábado de 10:00 a 20:00",
    services: [
      { name: "Corte clásico", durationMinutes: 45, price: 180, bufferMinutes: 10 },
      { name: "Corte + barba", durationMinutes: 70, price: 280, bufferMinutes: 10 },
      { name: "Arreglo de barba", durationMinutes: 30, price: 120, bufferMinutes: 10 }
    ],
    faqs: [
      ["¿Necesito cita?", "Puedes solicitar tu cita por el chat y el equipo confirma disponibilidad."],
      ["¿Dónde están ubicados?", "La demo usa Sucursal Centro como ubicación de ejemplo."],
      ["¿Qué horarios manejan?", "Lunes a sábado de 10:00 a 20:00."]
    ]
  },
  demo_dental: {
    name: "Clínica Dental Demo",
    niche: "clinica_dental",
    phone: "+52 555 222 2222",
    address: "Consultorio Centro",
    hours: "Lunes a viernes de 9:00 a 18:00 y sábado de 9:00 a 14:00",
    services: [
      { name: "Valoración dental", durationMinutes: 40, price: 350, bufferMinutes: 10 },
      { name: "Limpieza dental", durationMinutes: 60, price: 700, bufferMinutes: 10 },
      { name: "Urgencia dental", durationMinutes: 45, price: 500, bufferMinutes: 10 }
    ],
    faqs: [
      ["¿El bot da diagnósticos?", "No. Solo brinda información general y captura la solicitud para seguimiento."],
      ["¿Atienden urgencias?", "El asistente puede marcar casos urgentes para atención humana."],
      ["¿Qué datos pide?", "Nombre, teléfono, motivo de consulta y horario preferido."]
    ]
  },
  demo_proyectos: {
    name: "AutoChat Diagnóstico",
    niche: "proyectos",
    phone: "+52 555 333 3333",
    address: "Atención remota",
    hours: "Lunes a viernes de 9:00 a 18:00",
    services: [
      { name: "Diagnóstico de automatización", durationMinutes: 30, price: 0, bufferMinutes: 10 },
      { name: "Implementación de widget web", durationMinutes: 60, price: 2500, bufferMinutes: 10 },
      { name: "Proyecto personalizado", durationMinutes: 60, price: 6000, bufferMinutes: 10 }
    ],
    faqs: [
      ["¿Necesito WhatsApp API?", "No para empezar. El asistente puede funcionar desde una landing o página web."],
      ["¿Qué datos captura?", "Nombre, teléfono, correo, tipo de negocio y necesidad del proyecto."],
      ["¿Se adapta a mi negocio?", "Sí. El flujo se diseña según servicios, horarios, preguntas frecuentes y proceso comercial."]
    ]
  }
};

export function isDemoBusinessId(businessId) {
  return Boolean(DEMO_BUSINESSES[businessId]);
}

export async function ensureDemoBusiness(businessId, include) {
  const demo = DEMO_BUSINESSES[businessId];
  if (!demo) return null;

  const business = await prisma.business.upsert({
    where: { id: businessId },
    update: {
      name: demo.name,
      niche: demo.niche,
      phone: demo.phone,
      address: demo.address,
      hours: demo.hours
    },
    create: {
      id: businessId,
      name: demo.name,
      niche: demo.niche,
      phone: demo.phone,
      address: demo.address,
      hours: demo.hours
    }
  });

  const [serviceCount, faqCount] = await Promise.all([
    prisma.service.count({ where: { businessId } }),
    prisma.faq.count({ where: { businessId } })
  ]);

  if (serviceCount === 0) {
    await prisma.service.createMany({
      data: demo.services.map((service) => ({ ...service, businessId }))
    });
  }

  if (faqCount === 0) {
    await prisma.faq.createMany({
      data: demo.faqs.map(([question, answer]) => ({ businessId, question, answer }))
    });
  }

  if (!include) return business;
  return prisma.business.findUnique({ where: { id: businessId }, include });
}
