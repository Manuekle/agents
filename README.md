<div align="center">

<img src="assets/logo-mark.png" width="110" alt="agents logo" />

# agents

**Construye agentes de IA. Lanza tus skills al mundo.**

[![Live](https://img.shields.io/badge/live-agents--dev.vercel.app-ef5c47?style=flat-square&logo=vercel&logoColor=white)](https://agents-dev.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-17150f?style=flat-square)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-17150f?style=flat-square)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-17150f?style=flat-square)](https://react.dev)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-17150f?style=flat-square)](https://tailwindcss.com)
[![MCP](https://img.shields.io/badge/serve-via%20MCP-ef5c47?style=flat-square)](mcp/README.md)

</div>

<img src="docs/screenshots/hero.png" alt="agents — home" width="100%" />

---

## Qué hace

| 🪄 **Genera** | 🧭 **Compone** | 📦 **Exporta** | 🔌 **Sirve** |
|---|---|---|---|
| Responde 4 preguntas y la IA redacta la persona, busca skills reales en [skills.sh](https://skills.sh) y las elige. | Lienzo visual: un orquestador, subagentes y componentes (skills, commands, MCP, hooks) cableados a mano. | `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `GEMINI.md` o `mcp.json` — el formato que tu tool lee. | El agente completo, servido sobre MCP con `@manudev.jsx/agents`. |

## El flujo, en pantalla

### 01 · Onboarding — la IA escribe el borrador

Responde unas preguntas: un modelo redacta nombre, rol y system prompt, busca en el registro real de skills.sh y devuelve candidatos que existen. Tú apruebas, editas y guardas.

<img src="docs/screenshots/onboarding.png" alt="Onboarding — borrador asistido por IA" width="100%" />

### 02 · Composer — el lienzo

Arrastra el puerto ▾ de un agente para cablearlo con otro. Lo que cada especialista lleva consigo se ve, se mueve y se duplica como un grafo, no como una lista.

<img src="docs/screenshots/build.png" alt="Composer — grafo orquestador y subagentes" width="100%" />

### 03 · Lienzo a pantalla completa

Expande el grafo al modo fullscreen: pan con espacio, zoom con ⌘scroll, tidy para re-ordenar el árbol.

<img src="docs/screenshots/canvas.png" alt="Lienzo a pantalla completa" width="100%" />

### 04 · Demo — el flujo completo, sin cuenta

Brief → draft → skills → delegación → export, con datos reales. No es un trial: el mismo `lib/graph.ts` y `lib/export.ts` que corre el composer.

<img src="docs/screenshots/demo.png" alt="Demo — el flujo completo" width="100%" />

### 05 · Skills — dos registros abiertos

[skills.sh](https://skills.sh) se busca en vivo; aitmpl navega skills, subagentes, slash commands, MCP servers, hooks y settings por categoría. Copia un install sin cuenta.

<img src="docs/screenshots/skills.png" alt="Registro de skills" width="100%" />

### 06 · Puente MCP

El agente exportado como un paquete npm que expone la persona, el system prompt y las skills a cualquier cliente MCP.

<img src="docs/screenshots/mcp.png" alt="Puente MCP" width="100%" />

### 07 · Planes

Gratis para componer, Pro para guardar y borradores, Max para servir sobre MCP. Trae tu propia API key: Claude, ChatGPT, Kimi, DeepSeek, Gemini, Groq u Ollama local.

<img src="docs/screenshots/pricing.png" alt="Planes" width="100%" />

## Empieza

```bash
npm install
npm run dev
```

Abre **http://localhost:3000**. Sin Supabase configurado nada está bloqueado: los agentes viven en `localStorage` y puedes probar el flujo entero en `/demo`.

## Stack

**Next.js 16** · **React 19** · **TypeScript** · **Tailwind v4** · **Supabase** · **motion** · **d3** · **MCP** — todo pixel, todo custom.

Detalles para devs: [`mcp/README.md`](mcp/README.md) · [`.env.example`](.env.example) · [skills.sh](https://skills.sh) · [npx skills](https://www.npmjs.com/package/skills)

## License

MIT — ver [`LICENSE`](LICENSE).
