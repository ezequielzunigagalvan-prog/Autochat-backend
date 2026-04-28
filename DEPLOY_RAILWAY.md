# Deploy AutoChat en Railway + Vercel

## Backend en Railway

1. Crear proyecto en Railway.
2. Agregar un servicio PostgreSQL.
3. Conectar el repo/carpeta `autochat-backend`.
4. Variables necesarias:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
FRONTEND_ORIGIN=https://TU-PANEL.vercel.app
PUBLIC_APP_URL=https://TU-BACKEND.up.railway.app
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
LEAD_WEBHOOK_URL=
```

Las variables de WhatsApp pueden quedarse vacias mientras el producto sea web-first.

5. Start command:

```bash
npm start
```

El script `start` ejecuta:

```bash
prisma migrate deploy && node src/server.js
```

6. Despues del primer deploy, correr seed una sola vez:

```bash
npm run db:seed
```

No corras seed en cada deploy porque reinicia datos demo/leads.

## Frontend en Vercel

Variables:

```env
VITE_API_URL=https://TU-BACKEND.up.railway.app
VITE_PUBLIC_APP_URL=https://TU-BACKEND.up.railway.app
```

Build command:

```bash
npm run build
```

Output:

```bash
dist
```

## Pruebas despues de deploy

- Abrir `https://TU-BACKEND.up.railway.app/public/landing.html`
- Abrir `https://TU-BACKEND.up.railway.app/public/proyectos.html`
- Abrir demo barberia y dental.
- Capturar un lead desde cada demo.
- Entrar al panel en Vercel.
- Confirmar que cada lead cae en su negocio correcto.
- Copiar el script del widget desde el panel y pegarlo en una pagina de prueba.
