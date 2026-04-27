# AutoChat Backend

Backend inicial para una plataforma aislada de automatizacion conversacional para barberias, esteticas y clinicas dentales.

## MVP incluido

1. Configuracion de negocios y nicho.
2. Servicios por negocio.
3. Motor conversacional con fallback local y respuestas con OpenAI cuando `OPENAI_API_KEY` esta configurada.
4. Registro persistente de clientes, conversaciones y citas con Prisma + SQLite.
5. Webhook base para WhatsApp.

## Configurar OpenAI

Pega tu secret key en `.env`:

```env
OPENAI_API_KEY=sk-tu_key_aqui
OPENAI_MODEL=gpt-5-mini
```

La key solo va en el backend. Nunca la pongas en el frontend.

Despues reinicia el backend.

## Configurar Twilio WhatsApp

Para pruebas con Sandbox, en el panel del negocio configura:

```text
WhatsApp Twilio = whatsapp:+14155238886
```

En Twilio Sandbox, configura el webhook de mensajes entrantes con tu URL publica:

```text
https://TU-NGROK.ngrok-free.app/webhooks/twilio/whatsapp
```

Twilio enviara `From`, `To` y `Body`. AutoChat respondera con TwiML usando el motor conversacional actual.

## Comandos

```bash
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

API local: http://localhost:4000
