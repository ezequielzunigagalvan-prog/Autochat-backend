export const businessTemplates = {
  barberia: {
    automationType: "appointment",
    services: [
      { name: "Corte", durationMinutes: 30, price: 150 },
      { name: "Barba", durationMinutes: 20, price: 100 },
      { name: "Corte + Barba", durationMinutes: 45, price: 220 }
    ],
    faqs: [
      { question: "horario", answer: "Lunes a sábado de 10:00 a 20:00" },
      { question: "ubicacion", answer: "Estamos ubicados en la zona centro." }
    ]
  },

  estetica: {
    automationType: "appointment",
    services: [
      { name: "Manicure", durationMinutes: 45, price: 250 },
      { name: "Facial", durationMinutes: 60, price: 450 },
      { name: "Valoración", durationMinutes: 30, price: 0 }
    ],
    faqs: [
      { question: "horario", answer: "Lunes a sábado de 10:00 a 20:00" },
      { question: "cita", answer: "Puedes solicitar una cita por el chat indicando servicio, día y hora." }
    ]
  },

  clinica_dental: {
    automationType: "appointment",
    services: [
      { name: "Limpieza dental", durationMinutes: 45, price: 600 },
      { name: "Consulta", durationMinutes: 30, price: 500 },
      { name: "Valoración", durationMinutes: 30, price: 0 }
    ],
    faqs: [
      { question: "horario", answer: "Lunes a viernes de 9:00 a 18:00" },
      { question: "urgencia", answer: "Sí atendemos urgencias con previa cita." }
    ]
  },

  salud: {
    automationType: "lead",
    services: [
      { name: "Valoración", durationMinutes: 45, price: 0 },
      { name: "Consulta", durationMinutes: 45, price: 0 },
      { name: "Caso prioritario", durationMinutes: 45, price: 0 }
    ],
    faqs: [
      { question: "diagnostico", answer: "El asistente no diagnostica. Captura datos para que el equipo dé seguimiento." },
      { question: "urgencia", answer: "Si es urgente, el caso se marca para atención humana prioritaria." }
    ]
  },

  industrial: {
    automationType: "quote",
    services: [
      {
        name: "Filtración de aceite",
        description: "Servicio para remover partículas, humedad y contaminantes del aceite en equipos industriales. La cotización depende del tipo de aceite, volumen, condición del fluido y ubicación.",
        connectorQuestion: "¿Quieres que prepare una solicitud de cotización para filtración de aceite?",
        connectorCta: "Cotizar filtración",
        durationMinutes: 60,
        price: 0,
        contactFields: ["name", "phone", "company", "city", "equipment", "details", "urgency"]
      },
      {
        name: "Análisis de aceite",
        description: "Revisión del estado del lubricante para identificar contaminación, desgaste o condiciones que puedan afectar el equipo.",
        connectorQuestion: "¿Quieres solicitar seguimiento para un análisis de aceite?",
        connectorCta: "Solicitar análisis",
        durationMinutes: 30,
        price: 0,
        contactFields: ["name", "phone", "company", "equipment", "details"]
      },
      {
        name: "Asesoría en lubricación",
        description: "Orientación técnica para seleccionar lubricantes, mejorar rutinas de mantenimiento y reducir fallas asociadas a lubricación.",
        connectorQuestion: "¿Quieres que el equipo revise tu caso de lubricación?",
        connectorCta: "Pedir asesoría",
        durationMinutes: 60,
        price: 0,
        contactFields: ["name", "phone", "company", "position", "city", "details"]
      }
    ],
    faqs: [
      { question: "servicios", answer: "Filtración, análisis y soluciones de lubricación industrial." },
      { question: "cotizacion", answer: "Las cotizaciones se realizan según el tipo de equipo y condiciones." }
    ]
  },

  servicios: {
    automationType: "quote",
    services: [
      { name: "Cotización", durationMinutes: 30, price: 0 },
      { name: "Visita técnica", durationMinutes: 60, price: 0 },
      { name: "Diagnóstico del proyecto", durationMinutes: 45, price: 0 }
    ],
    faqs: [
      { question: "cotizacion", answer: "Para cotizar necesitamos servicio requerido, ubicación, alcance y urgencia." },
      { question: "seguimiento", answer: "El equipo revisa la solicitud y da seguimiento con los datos capturados." }
    ]
  },

  proyectos: {
    automationType: "lead",
    services: [
      { name: "Diagnóstico", durationMinutes: 45, price: 0 },
      { name: "Propuesta", durationMinutes: 60, price: 0 },
      { name: "Seguimiento", durationMinutes: 30, price: 0 }
    ],
    faqs: [
      { question: "datos", answer: "El asistente captura objetivo, necesidad, presupuesto aproximado y urgencia." },
      { question: "propuesta", answer: "La propuesta depende del alcance y se revisa con el equipo." }
    ]
  },

  inmobiliaria: {
    automationType: "hybrid",
    services: [
      { name: "Comprar propiedad", durationMinutes: 45, price: 0 },
      { name: "Rentar propiedad", durationMinutes: 45, price: 0 },
      { name: "Agendar visita", durationMinutes: 45, price: 0 }
    ],
    faqs: [
      { question: "comprar", answer: "Para ayudarte necesitamos zona, presupuesto, tipo de propiedad y forma de pago." },
      { question: "visita", answer: "Podemos registrar tu horario preferido para que el equipo confirme la visita." }
    ]
  },

  educacion: {
    automationType: "lead",
    services: [
      { name: "Información de cursos", durationMinutes: 30, price: 0 },
      { name: "Inscripción", durationMinutes: 30, price: 0 },
      { name: "Asesoría académica", durationMinutes: 45, price: 0 }
    ],
    faqs: [
      { question: "cursos", answer: "El asistente puede orientar sobre cursos, modalidad, horarios e inscripción." },
      { question: "inscripcion", answer: "Para seguimiento se captura nombre, contacto, curso de interés y horario preferido." }
    ]
  }
};
