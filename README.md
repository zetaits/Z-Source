# LyraTip Command Center

Dashboard SPA para analizar picks de apuestas deportivas con IA.

## Tech stack
- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui + Radix UI
- Supabase Edge Functions (Deno) para la llamada a Gemini

## Desarrollo local
```sh
npm install
npm run dev
```

### Ejecutar como app de escritorio (Tauri)
- Requisitos: Rust + Cargo + toolchain de Tauri (incluye WebView2 en Windows).
- Instala CLI: `npm install @tauri-apps/cli --save-dev` (ya en package.json).
- Dev desktop: `npm run tauri:dev`. **Nota:** Este comando descargará automáticamente las dependencias binarias necesarias (FlareSolverr, ~700MB) si no están presentes.
- Build .exe: `npm run tauri:build` (también verifica binarios antes de construir).

Variables de entorno esperadas (en Supabase Edge y en el cliente):
- `GEMINI_API_KEY` para la función de análisis (ya hay un fallback en el código, pero usa la variable para producción).
- `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` para el cliente web.

## Despliegue web
Construir y servir con cualquier hosting de static assets + funciones de Supabase (`npm run build` y `supabase functions deploy`). Ajusta las keys en el entorno de producción.
