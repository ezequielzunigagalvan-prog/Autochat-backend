import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/modules/auth/password.js";

const prisma = new PrismaClient();
const BARBERIA_DEMO_ID = "demo_barberia";
const DENTAL_DEMO_ID = "demo_dental";
const PROYECTOS_DEMO_ID = "demo_proyectos";

async function main() {
  await prisma.appointment.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.availabilityBlock.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.staffService.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.faq.deleteMany();
  await prisma.service.deleteMany();
  await prisma.session.deleteMany();
  await prisma.businessMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();

  const owner = await prisma.user.create({
    data: {
      name: "Demo Admin",
      email: "admin@autochat.test",
      passwordHash: hashPassword("123456")
    }
  });

  const barberia = await prisma.business.create({
    data: {
      id: BARBERIA_DEMO_ID,
      name: "Barbería Demo",
      niche: "barberia",
      phone: "+52 555 000 0000",
      address: "Sucursal Centro",
      hours: "Lunes a sábado de 10:00 a 20:00",
      tone: "amable, directo y profesional",
      faqs: {
        create: [
          { question: "horario", answer: "Abrimos de lunes a sábado de 10:00 a 20:00." },
          { question: "ubicación", answer: "Estamos en Sucursal Centro. Te puedo compartir indicaciones si lo necesitas." },
          { question: "precio", answer: "El corte inicia en $180. El precio depende del servicio." }
        ]
      },
      services: {
        create: [
          { name: "Corte de cabello", durationMinutes: 45, price: 180, bufferMinutes: 10 },
          { name: "Barba", durationMinutes: 30, price: 120, bufferMinutes: 10 },
          { name: "Color / tinte", durationMinutes: 120, price: 650, bufferMinutes: 15 }
        ]
      }
    },
    include: { services: true }
  });
  await prisma.businessMember.create({
    data: { businessId: barberia.id, userId: owner.id, role: "owner" }
  });
  await prisma.messageTemplate.createMany({
    data: [
      {
        businessId: barberia.id,
        key: "appointment_confirmed",
        name: "Confirmación de cita",
        body: "Tu cita en {{business}} quedó confirmada para {{date}}. Servicio: {{service}}."
      },
      {
        businessId: barberia.id,
        key: "reminder_24h",
        name: "Recordatorio 24 horas",
        body: "Recordatorio: mañana tienes cita en {{business}} a las {{time}} para {{service}}."
      },
      {
        businessId: barberia.id,
        key: "human_handoff",
        name: "Paso a humano",
        body: "Gracias por escribir. Una persona del equipo te atenderá pronto."
      }
    ]
  });

  const barberStaff = await Promise.all([
    prisma.staff.create({ data: { businessId: barberia.id, name: "Alex" } }),
    prisma.staff.create({ data: { businessId: barberia.id, name: "Mau" } }),
    prisma.staff.create({ data: { businessId: barberia.id, name: "Sofia Colorista" } })
  ]);
  const [corte, barba, color] = barberia.services;
  await prisma.staffService.createMany({
    data: [
      { staffId: barberStaff[0].id, serviceId: corte.id },
      { staffId: barberStaff[0].id, serviceId: barba.id },
      { staffId: barberStaff[1].id, serviceId: corte.id },
      { staffId: barberStaff[1].id, serviceId: barba.id },
      { staffId: barberStaff[2].id, serviceId: color.id }
    ]
  });

  const dental = await prisma.business.create({
    data: {
      id: DENTAL_DEMO_ID,
      name: "Clínica Dental Demo",
      niche: "clinica_dental",
      phone: "+52 555 111 1111",
      address: "Av. Salud 123",
      hours: "Lunes a viernes de 9:00 a 18:00",
      tone: "claro, confiable y cuidadoso",
      faqs: {
        create: [
          { question: "limpieza", answer: "La limpieza dental dura aproximadamente 45 minutos." },
          { question: "urgencia", answer: "Si tienes dolor fuerte, te podemos canalizar como urgencia y confirmar disponibilidad." },
          { question: "ubicación", answer: "Estamos en Av. Salud 123." }
        ]
      },
      services: {
        create: [
          { name: "Limpieza dental", durationMinutes: 45, price: 600, bufferMinutes: 15 },
          { name: "Valoración", durationMinutes: 30, price: 350, bufferMinutes: 10 },
          { name: "Blanqueamiento", durationMinutes: 90, price: 1800, bufferMinutes: 15 }
        ]
      }
    },
    include: { services: true }
  });
  await prisma.businessMember.create({
    data: { businessId: dental.id, userId: owner.id, role: "owner" }
  });
  await prisma.messageTemplate.createMany({
    data: [
      {
        businessId: dental.id,
        key: "appointment_confirmed",
        name: "Confirmación de cita",
        body: "Tu cita en {{business}} quedó confirmada para {{date}}. Servicio: {{service}}."
      },
      {
        businessId: dental.id,
        key: "reminder_24h",
        name: "Recordatorio 24 horas",
        body: "Recordatorio: mañana tienes cita en {{business}} a las {{time}} para {{service}}."
      },
      {
        businessId: dental.id,
        key: "human_handoff",
        name: "Paso a humano",
        body: "Gracias por escribir. Una persona del equipo te atenderá pronto."
      }
    ]
  });

  const dentalStaff = await Promise.all([
    prisma.staff.create({ data: { businessId: dental.id, name: "Dra. Martinez" } }),
    prisma.staff.create({ data: { businessId: dental.id, name: "Dr. Ruiz" } })
  ]);
  await prisma.staffService.createMany({
    data: dental.services.flatMap((service) => [
      { staffId: dentalStaff[0].id, serviceId: service.id },
      { staffId: dentalStaff[1].id, serviceId: service.id }
    ])
  });

  const proyectos = await prisma.business.create({
    data: {
      id: PROYECTOS_DEMO_ID,
      name: "AutoChat Proyectos Demo",
      niche: "estetica",
      phone: "+52 555 222 2222",
      address: "Demo online",
      hours: "Lunes a viernes de 9:00 a 18:00",
      tone: "consultivo, claro y orientado a proyectos",
      faqs: {
        create: [
          { question: "proyecto", answer: "Podemos crear un asistente web adaptado a tu proceso: leads, cotizaciones, citas, preguntas frecuentes o soporte inicial." },
          { question: "precio", answer: "Los proyectos iniciales empiezan desde $2,500 MXN y dependen del flujo, contenido y personalización." },
          { question: "whatsapp", answer: "No necesitas WhatsApp API para iniciar. El asistente funciona desde tu página web y WhatsApp oficial puede agregarse después como fase premium." }
        ]
      },
      services: {
        create: [
          { name: "Diagnóstico de automatización", durationMinutes: 30, price: 0, bufferMinutes: 10 },
          { name: "Implementación inicial", durationMinutes: 60, price: 2500, bufferMinutes: 15 },
          { name: "Proyecto avanzado", durationMinutes: 90, price: 6000, bufferMinutes: 15 }
        ]
      }
    },
    include: { services: true }
  });
  await prisma.businessMember.create({
    data: { businessId: proyectos.id, userId: owner.id, role: "owner" }
  });
  await prisma.messageTemplate.createMany({
    data: [
      {
        businessId: proyectos.id,
        key: "appointment_confirmed",
        name: "Confirmación de solicitud",
        body: "Tu solicitud en {{business}} quedó registrada para {{date}}. Tema: {{service}}."
      },
      {
        businessId: proyectos.id,
        key: "reminder_24h",
        name: "Recordatorio 24 horas",
        body: "Recordatorio: mañana tienes una solicitud programada en {{business}} a las {{time}}."
      },
      {
        businessId: proyectos.id,
        key: "human_handoff",
        name: "Paso a humano",
        body: "Gracias por escribir. Una persona del equipo revisará tu proyecto pronto."
      }
    ]
  });

  const projectStaff = await prisma.staff.create({ data: { businessId: proyectos.id, name: "Consultor AutoChat" } });
  await prisma.staffService.createMany({
    data: proyectos.services.map((service) => ({ staffId: projectStaff.id, serviceId: service.id }))
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
