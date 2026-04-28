import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/modules/auth/password.js";

const prisma = new PrismaClient();

const email = (process.env.DEMO_ADMIN_EMAIL || "admin@autochat.test").toLowerCase();
const password = process.env.DEMO_ADMIN_PASSWORD || "123456";
const name = process.env.DEMO_ADMIN_NAME || "Demo Admin";
const businessId = process.env.DEMO_BUSINESS_ID || "demo_proyectos";

async function ensureBusiness() {
  const existing = await prisma.business.findFirst({
    include: { services: true, staff: true, faqs: true }
  });
  if (existing) return existing;

  return prisma.business.create({
    data: {
      id: businessId,
      name: "AutoChat Demo",
      niche: "estetica",
      phone: "+52 555 222 2222",
      address: "Demo online",
      hours: "Lunes a viernes de 9:00 a 18:00",
      tone: "consultivo, claro y profesional",
      services: {
        create: [
          { name: "Diagnóstico de automatización", durationMinutes: 30, price: 0, bufferMinutes: 10 },
          { name: "Implementación inicial", durationMinutes: 60, price: 2500, bufferMinutes: 15 }
        ]
      },
      faqs: {
        create: [
          {
            question: "proyecto",
            answer: "Podemos crear un asistente web adaptado a tu proceso: leads, cotizaciones, citas, preguntas frecuentes o soporte inicial."
          },
          {
            question: "precio",
            answer: "Los proyectos iniciales empiezan desde $2,500 MXN y dependen del flujo, contenido y personalización."
          }
        ]
      }
    },
    include: { services: true, staff: true, faqs: true }
  });
}

async function ensureStaff(business) {
  if (business.staff?.length) return;
  const staff = await prisma.staff.create({
    data: { businessId: business.id, name: "Consultor AutoChat" }
  });
  if (business.services?.length) {
    await prisma.staffService.createMany({
      data: business.services.map((service) => ({ staffId: staff.id, serviceId: service.id })),
      skipDuplicates: true
    });
  }
}

async function main() {
  const business = await ensureBusiness();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash: hashPassword(password)
    },
    create: {
      name,
      email,
      passwordHash: hashPassword(password)
    }
  });

  await prisma.businessMember.upsert({
    where: {
      businessId_userId: {
        businessId: business.id,
        userId: user.id
      }
    },
    update: { role: "owner" },
    create: {
      businessId: business.id,
      userId: user.id,
      role: "owner"
    }
  });

  await ensureStaff(business);

  console.log(`Usuario listo: ${email}`);
  console.log(`Contraseña: ${password}`);
  console.log(`Negocio vinculado: ${business.name}`);
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
