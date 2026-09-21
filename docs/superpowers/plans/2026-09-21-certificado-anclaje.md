# Certificado de Puntos de Anclaje — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working generator for Alto Test's "Certificado de Puntos de
Anclaje" (batch/project-level, not per-anchor), a public verification page
reachable by QR, and fix the underlying Worker-vendoring risk that would let
an unrelated future deploy silently regress the new endpoint.

**Architecture:** Four pieces, built in dependency order: (1) extract the
shared Cloudflare Worker (`altotest-documentos`) out of its per-project
vendored copies into one source-of-truth project, adding a public read-only
`/verify` route; (2) a new Vite+React+TS app (`digital_certificate/`, this
repo) — same editor/autosave/History pattern as `informe_levantamiento` — for
creating and printing the certificate; (3) a new public route in the existing
marketing site (`site/`) that resolves a folio via the Worker's public
endpoint and shows validity; (4) doc updates to the 3 sibling projects that
lose their local `worker/` copy.

**Tech Stack:** Vite 8 + React 19 + TypeScript + Tailwind v4
(`@tailwindcss/vite`, tokens in `@theme`), Cloudflare Workers + Workers KV,
`qrcode` (QR matrix generation) for a real scannable QR. No new test
framework — this codebase's established verification pattern (see all 4
sibling `CLAUDE.md` "Verificación" sections) is `tsc --noEmit` + `oxlint` +
`npm run build` + ad-hoc Playwright headless screenshots/PDF export, not a
committed unit-test suite. Tasks below follow that convention instead of a
generic red/green unit test cycle.

**Spec:**
`digital_certificate/docs/superpowers/specs/2026-09-21-certificado-anclaje-design.md`
— read it before starting; this plan argues from it and doesn't repeat the
"why" for decisions already justified there.

## Global Constraints

- Stack: Vite 8 + React 19 + TypeScript + Tailwind v4, same major versions
  already pinned in `informes/informe_levantamiento/package.json`.
- Folio format: `CPA-aaaammdd-hhmmss` (this app's own prefix, same
  convention as `IL-`/`PT-`/`COT-`).
- Worker route `kind` for this app: `certificado` (path segment, e.g.
  `/reports/certificado/:code`).
- One certificate = one lote/proyecto (aggregated counts), never a
  per-anchor breakdown table.
- "Normas aplicables" is an editable list per certificate — never a
  hardcoded set of standards in code.
- Internal editor uses the **same shared 4-digit access key** as the other
  3 documents (`AccessGate`, same UX). The public verification page and the
  Worker's `/verify` route **never** require a key.
- Reuse the **canonical** `Wordmark`/`Logomark` from
  `site/src/components/ui/` — not `informe_levantamiento`'s plate+bolt
  variant, which is a deliberate one-off documented in that project's own
  `CLAUDE.md`.
- The Worker (`altotest-documentos/`, new standalone project) never
  interprets the internal shape of `doc` — this is a pre-existing,
  deliberate invariant (see its own `src/index.ts` comments); the
  `/verify` route returns the envelope as-is, validity is computed by the
  caller (`site/`), not the Worker.
- Print target is real A4 (210mm × 297mm) — the approved mockup used a
  900×1273px canvas sized for on-screen artifact preview, which is exactly
  A4's aspect ratio (0.7071) but not its physical size.
- Code in English, comments in Spanish, document content (what a client
  reads) in Spanish — same convention as every sibling project.

---

## Phase 0 — Extract the shared Worker

### Task 1: Scaffold `altotest-documentos/` as the single Worker project

**Files:**
- Create: `altotest-documentos/package.json`
- Create: `altotest-documentos/wrangler.jsonc`
- Create: `altotest-documentos/tsconfig.json`
- Create: `altotest-documentos/src/index.ts`
- Create: `altotest-documentos/.dev.vars.example`
- Create: `altotest-documentos/.gitignore`

**Interfaces:**
- Produces: `altotest-documentos` is the only place `src/index.ts` (the
  Worker's fetch handler) lives from here on. Every frontend project talks
  to it only over HTTP via `VITE_REPORTS_ENDPOINT` — no other task imports
  its source.

- [ ] **Step 1: Create the project directory as a sibling of `digital_certificate/`**

```bash
mkdir -p /home/meraki/altotest/altotest-documentos/src
cd /home/meraki/altotest/altotest-documentos
git init
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "altotest-documentos",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260901.0",
    "typescript": "~6.0.2",
    "wrangler": "^4.35.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `wrangler.jsonc`, reusing the already-deployed KV namespace**

The `account_id` and `kv_namespaces` values below are the real, already
existing ones (copied from
`informes/informe_levantamiento/worker/wrangler.jsonc` — this is the *same*
KV store the 3 sibling apps already write to, not a new one).

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "altotest-documentos",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-01",
  "account_id": "127be0022568b3839ed7da1973fc8104",
  "kv_namespaces": [
    {
      "binding": "REPORTS",
      "id": "f23fac81596e445688d0abf53a09be67",
      "preview_id": "312776f575894e6a99a35914113030ab"
    }
  ]
}
```

- [ ] **Step 5: Copy the existing fetch handler verbatim (no behavior change yet)**

Copy `informes/informe_levantamiento/worker/src/index.ts` byte-for-byte to
`altotest-documentos/src/index.ts`:

```bash
cp /home/meraki/altotest/informes/informe_levantamiento/worker/src/index.ts \
   /home/meraki/altotest/altotest-documentos/src/index.ts
```

- [ ] **Step 6: `.dev.vars.example` and `.gitignore`**

```
# altotest-documentos/.dev.vars.example
ACCESS_KEY=0000
```

```
# altotest-documentos/.gitignore
node_modules
.wrangler
.dev.vars
```

- [ ] **Step 7: Install and type-check**

```bash
cd /home/meraki/altotest/altotest-documentos
npm install
npm run typecheck
```

Expected: no errors — this is an unmodified copy of already-working code.

- [ ] **Step 8: Local smoke test against `wrangler dev` (parity check)**

```bash
cp .dev.vars.example .dev.vars   # edit ACCESS_KEY to any value, e.g. 1234
npm run dev &   # starts on localhost:8787 with simulated local KV
sleep 2
curl -s -X PUT http://localhost:8787/reports/smoketest/ABC \
  -H "Authorization: Bearer 1234" -H "Content-Type: application/json" \
  -d '{"code":"ABC","client":"Test","date":"21-09-2026","doc":{"hello":"world"}}'
curl -s http://localhost:8787/reports/smoketest/ABC -H "Authorization: Bearer 1234"
curl -s http://localhost:8787/reports/smoketest -H "Authorization: Bearer 1234"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8787/reports/smoketest/ABC   # no auth header → expect 401
kill %1
```

Expected: PUT returns `{"ok":true,...}`, the two authenticated GETs return
the envelope/listing, the unauthenticated GET returns `401`.

- [ ] **Step 9: Commit**

```bash
cd /home/meraki/altotest/altotest-documentos
git add -A
git commit -m "Scaffold altotest-documentos as the single Worker project

Copies the existing fetch handler verbatim from informe_levantamiento's
vendored worker/ — no behavior change. This becomes the one place the
shared Worker source lives from now on."
```

---

### Task 2: Add the public `/verify/:kind/:code` route

**Files:**
- Modify: `altotest-documentos/src/index.ts`

**Interfaces:**
- Produces: `GET /verify/:kind/:code` (no `Authorization` required) →
  `200` with the same JSON shape as `GET /reports/:kind/:code`
  (`{code, kind, client, date, updatedAt, doc}`), or `404
  {ok:false,error:"not_found"}`. Any other method on this path → `405`.

- [ ] **Step 1: Restructure `fetch()` so URL parsing happens before the auth gate**

Replace the top of the exported `fetch` handler (from `async fetch(request,
env)` down to the `const code = ...` line) with:

```ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders()

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers })
    }

    const url = new URL(request.url)
    const parts = url.pathname.split("/").filter(Boolean)

    // GET /verify/:kind/:code — lectura pública, SIN Authorization. Es la ruta
    // que abre el QR impreso en un certificado y la página /verifica de site/:
    // cualquiera que reciba el documento en papel tiene que poder confirmarlo
    // sin la clave de equipo. El Worker sigue sin interpretar `doc` (ver
    // "Contrato universal" arriba) — decidir vigente/vencido es trabajo de
    // quien lee la respuesta, no de esta ruta.
    if (parts[0] === "verify") {
      if (request.method !== "GET") {
        return json({ ok: false, error: "method_not_allowed" }, 405, headers)
      }
      if (!parts[1] || !parts[2]) {
        return json({ ok: false, error: "not_found" }, 404, headers)
      }
      const vKind = decodeURIComponent(parts[1])
      const vCode = decodeURIComponent(parts[2])
      const raw = await env.REPORTS.get(storageKey(vKind, vCode))
      if (!raw) return json({ ok: false, error: "not_found" }, 404, headers)
      return new Response(raw, { status: 200, headers: { ...headers, "Content-Type": "application/json" } })
    }

    if (!isAuthorized(request, env)) {
      return json({ ok: false, error: "unauthorized" }, 401, headers)
    }

    if (parts[0] !== "reports" || !parts[1]) {
      return json({ ok: false, error: "not_found" }, 404, headers)
    }

    const kind = decodeURIComponent(parts[1])
    const code = parts[2] ? decodeURIComponent(parts[2]) : null
```

Everything below that (the existing `if (!code) {...}`, `GET`, `PUT`,
`DELETE` branches) stays exactly as-is — only the `url`/`parts` declarations
moved earlier and the new `/verify` branch was inserted between the OPTIONS
check and the auth check.

- [ ] **Step 2: Type-check**

```bash
cd /home/meraki/altotest/altotest-documentos
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Verify with `wrangler dev` — both the new route and unchanged old routes**

```bash
npm run dev &
sleep 2
# seed one document the authenticated way
curl -s -X PUT http://localhost:8787/reports/certificado/CPA-TEST \
  -H "Authorization: Bearer 1234" -H "Content-Type: application/json" \
  -d '{"code":"CPA-TEST","client":"Cliente Ejemplo","date":"21-09-2026","doc":{"expirationDate":"21-09-2027"}}'

# public route, no Authorization header at all
curl -s http://localhost:8787/verify/certificado/CPA-TEST
# expect 200 with the full envelope

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8787/verify/certificado/DOES-NOT-EXIST
# expect 404

curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:8787/verify/certificado/CPA-TEST
# expect 405 (verify is read-only)

# confirm the authenticated routes still behave exactly as before
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8787/reports/certificado/CPA-TEST
# expect 401, no Authorization header
kill %1
```

Expected: all five checks match the comment above them.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add public GET /verify/:kind/:code route

Read-only, no auth — the QR on a printed certificate and the public
/verifica page on site/ need to resolve a folio without the team's
shared access key. Returns the same envelope shape as the authenticated
GET; validity is computed by the caller, not this Worker."
```

---

### Task 3: Deploy the extracted Worker and remove the 3 vendored copies

**Files:**
- Delete: `informes/informe_levantamiento/worker/`
- Delete: `venta/propuesta_tecnica_react/worker/`
- Delete: `venta/propuesta_economica_react/worker/`
- Modify: `informes/informe_levantamiento/CLAUDE.md`
- Modify: `venta/propuesta_tecnica_react/CLAUDE.md`
- Modify: `venta/propuesta_economica_react/CLAUDE.md`

- [ ] **Step 1: Deploy the real Worker (requires Cloudflare login for the Alto Test account)**

```bash
cd /home/meraki/altotest/altotest-documentos
wrangler login   # if not already logged into the Alto Test account (Contacto@altotest.cl)
wrangler secret put ACCESS_KEY   # paste the SAME 4-digit key already in use — ask Matías, it's not readable back from Cloudflare
npm run deploy
```

Expected: deploys to the same subdomain the 3 apps already point at
(`altotest-documentos.altotest.workers.dev`) — the Worker's `name` in
`wrangler.jsonc` is unchanged, so no frontend `.env` needs to change.

- [ ] **Step 2: Confirm the live deploy against the real (non-local) URL**

```bash
curl -s https://altotest-documentos.altotest.workers.dev/verify/informe/DOES-NOT-EXIST
```

Expected: `404 {"ok":false,"error":"not_found"}` — proves the new deploy is
live and the new route works against production KV.

- [ ] **Step 3: Confirm an existing sibling app still works end-to-end against the redeployed Worker**

```bash
cd /home/meraki/altotest/informes/informe_levantamiento
npm run dev &
sleep 2
```

Open the app in a Playwright headless check (or ask Matías to click through
manually): log in with the access key, confirm the History menu still lists
existing informes, open one, confirm autosave still works. This is the real
regression check — the whole point of Task 3 is that nothing about the
sibling apps' behavior changes.

```bash
kill %1
```

- [ ] **Step 4: Delete the vendored `worker/` directories**

```bash
rm -rf /home/meraki/altotest/informes/informe_levantamiento/worker
rm -rf /home/meraki/altotest/venta/propuesta_tecnica_react/worker
rm -rf /home/meraki/altotest/venta/propuesta_economica_react/worker
```

- [ ] **Step 5: Update `informes/informe_levantamiento/CLAUDE.md`**

In the "Arquitectura" section, remove the `worker/` subtree block (the one
starting `worker/                    proyecto npm INDEPENDIENTE...`) and
replace it with:

```
El Worker compartido (`altotest-documentos`) ya NO vive vendoreado en este
repo — es su propio proyecto en `../../altotest-documentos/` (repo separado,
`npm run deploy` desde ahí). Este proyecto sólo le habla por HTTP vía
`VITE_REPORTS_ENDPOINT` (`lib/api.ts`), igual que antes.
```

In "Arquitectura de datos", replace the paragraph starting "**El Worker es
compartido con `propuesta_tecnica` y `propuesta_economica`**..." with:

```
**El Worker es compartido con `propuesta_tecnica`, `propuesta_economica` y
`digital_certificate`** — vive en `altotest-documentos/`, su propio
proyecto/repo (extraído de acá el 2026-09-21, ver su propio historial de
commits para el porqué: las 3 copias vendoreadas podían pisarse entre sí en
un deploy). Ningún proyecto hermano tiene ya una carpeta `worker/` local.
```

In "Despliegue real", replace the "Cómo se desplegó de verdad" paragraph's
reference to deploying from this repo with a pointer to the new repo's own
CLAUDE.md/README for deploy instructions, and keep the KV namespace IDs
(still accurate, unchanged).

- [ ] **Step 6: Repeat the same doc update pattern for the other two siblings**

Read `venta/propuesta_tecnica_react/CLAUDE.md` and
`venta/propuesta_economica_react/CLAUDE.md`, find their equivalent
"Arquitectura"/"Arquitectura de datos"/"Despliegue" sections describing the
vendored `worker/`, and apply the same edit: remove the `worker/` subtree
description, point to `altotest-documentos/` as the single source of truth.

- [ ] **Step 7: Confirm nothing broke (each of the 3 siblings, independently)**

```bash
cd /home/meraki/altotest/informes/informe_levantamiento && npx tsc -b && npm run build
cd /home/meraki/altotest/venta/propuesta_tecnica_react && npx tsc -b && npm run build
cd /home/meraki/altotest/venta/propuesta_economica_react && npx tsc -b && npm run build
```

Expected: all three build clean — none of them ever imported anything from
their own `worker/` directory (it was a separate npm project, not part of
the frontend's dependency graph), so removing it cannot break the frontend
build.

- [ ] **Step 8: Commit each sibling repo separately**

```bash
cd /home/meraki/altotest/informes/informe_levantamiento
git add -A
git commit -m "Remove vendored worker/, point to shared altotest-documentos repo

The Worker now lives in its own project (../../altotest-documentos/) as
the single source of truth, so a future deploy from this copy can't
silently regress an endpoint added elsewhere. Behavior is unchanged —
this app only ever talked to the Worker over HTTP."

cd /home/meraki/altotest/venta/propuesta_tecnica_react
git add -A && git commit -m "Remove vendored worker/, point to shared altotest-documentos repo"

cd /home/meraki/altotest/venta/propuesta_economica_react
git add -A && git commit -m "Remove vendored worker/, point to shared altotest-documentos repo"
```

---

## Phase 1 — Certificate app: data layer

### Task 4: Scaffold the Vite+React+TS+Tailwind project

**Files:**
- Create: `digital_certificate/package.json`
- Create: `digital_certificate/vite.config.ts`
- Create: `digital_certificate/tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Create: `digital_certificate/index.html`
- Create: `digital_certificate/.env.example`, `.env`
- Create: `digital_certificate/.oxlintrc.json`
- Create: `digital_certificate/public/favicon.svg` (copied)
- Create: `digital_certificate/src/main.tsx`
- Create: `digital_certificate/src/vite-env.d.ts`

- [ ] **Step 1: `package.json`**

```json
{
  "name": "digital_certificate",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  },
  "dependencies": {
    "qrcode": "^1.5.4",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@types/node": "^24.13.3",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.4",
    "oxlint": "^1.75.0",
    "tailwindcss": "^4.3.3",
    "typescript": "~6.0.2",
    "vite": "^8.2.0"
  }
}
```

- [ ] **Step 2: `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5220 },
})
```

(Port `5220` — the next free fixed port after `5210` used by
`informe_levantamiento`, so running several of these apps side by side in dev
never collides.)

- [ ] **Step 3: `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`**

Copy the three files verbatim from `informes/informe_levantamiento/` (they
have no informe-specific content, pure Vite/React boilerplate):

```bash
cp /home/meraki/altotest/informes/informe_levantamiento/tsconfig.json \
   /home/meraki/altotest/informes/informe_levantamiento/tsconfig.app.json \
   /home/meraki/altotest/informes/informe_levantamiento/tsconfig.node.json \
   /home/meraki/altotest/digital_certificate/
cp /home/meraki/altotest/informes/informe_levantamiento/.oxlintrc.json \
   /home/meraki/altotest/digital_certificate/
```

- [ ] **Step 4: `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Certificado de Anclaje — Alto Test</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: `.env.example` / `.env` and favicon**

```
# digital_certificate/.env.example
VITE_REPORTS_ENDPOINT=http://localhost:8787
```

```bash
cp /home/meraki/altotest/digital_certificate/.env.example /home/meraki/altotest/digital_certificate/.env
cp /home/meraki/altotest/site/public/favicon.svg /home/meraki/altotest/digital_certificate/public/favicon.svg
```

Append to `digital_certificate/.gitignore` (already has `node_modules`,
`dist`, `.env`, `*.pdf` from the earlier spec commit): nothing more needed,
those four lines already cover a Vite project.

- [ ] **Step 6: `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 7: `src/main.tsx`** (placeholder root render, replaced fully in Task 9)

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 8: Minimal `src/App.tsx` and `src/index.css` just to prove the scaffold boots**

```tsx
// src/App.tsx — replaced with the real gate in Task 9
export default function App() {
  return <div>Certificado de Anclaje — en construcción</div>
}
```

```css
/* src/index.css — replaced with full tokens in Task 9 */
@import "tailwindcss";
```

- [ ] **Step 9: Install and boot**

```bash
cd /home/meraki/altotest/digital_certificate
npm install
npm run dev &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5220
kill %1
```

Expected: `200`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold digital_certificate as Vite+React+TS+Tailwind v4

Same stack/pattern as informe_levantamiento and the two propuesta_react
projects. Port 5220 (next free fixed dev port after 5210)."
```

---

### Task 5: Data model, folio and date helpers

**Files:**
- Create: `digital_certificate/src/types.ts`
- Create: `digital_certificate/src/lib/code.ts`
- Create: `digital_certificate/src/lib/date.ts`

**Interfaces:**
- Produces: `CertificateState` (the shape every later task reads/writes),
  `generateCode(): string`, `isValidCode(code: string): boolean`,
  `todayDate(): string`, `formatDateInput(value: string): string`,
  `isValidDate(value: string): boolean`, `addOneYear(from: string): string`.

- [ ] **Step 1: `src/types.ts`**

```ts
// Un solo objeto, autoguardado completo en cada cambio — mismo criterio que
// ReportState en informe_levantamiento (sin entidades separadas). "Lote" en
// vez de "por anclaje": ver spec, sección 1 — un certificado cubre N
// anclajes de un mismo recinto con resumen agregado, no una fila por
// anclaje.
export interface CertificateState {
  code: string
  clientName: string
  clientRut: string
  clientAsset: string // recinto/edificio/proyecto
  address: string
  certificationDate: string // dd-mm-aaaa
  expirationDate: string // dd-mm-aaaa
  deviceType: string
  substrate: string
  materiality: string
  verificationTest: string
  testLoad: string
  installedCount: number
  certifiedCount: number
  standards: string[] // chips "normas aplicables", editable
  description: string
}
```

- [ ] **Step 2: `src/lib/code.ts`**

```ts
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

const CODE_PATTERN = /^CPA-\d{8}-\d{6}$/

// Certificado de Punto(s) de Anclaje — mismo criterio de folio que el resto
// de la familia (IL-/PT-/COT-aaaammdd-hhmmss).
export function generateCode(): string {
  const d = new Date()
  const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
  const time = `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  return `CPA-${date}-${time}`
}

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code)
}
```

- [ ] **Step 3: `src/lib/date.ts`**

```ts
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// Formato con GUIONES (dd-mm-aaaa), no barras — así quedó aprobado en el
// mockup del certificado (distinto del dd/mm/aaaa que usa informe_levantamiento;
// es una convención propia de este documento, no un error de copiar/pegar).
export function todayDate(): string {
  const d = new Date()
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`
}

export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean)
  return parts.join('-')
}

function parseDateParts(value: string): { day: number; month: number; year: number } | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
  if (!m) return null
  return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) }
}

export function isValidDate(value: string): boolean {
  const parts = parseDateParts(value)
  if (!parts) return false
  const d = new Date(parts.year, parts.month - 1, parts.day)
  return d.getFullYear() === parts.year && d.getMonth() === parts.month - 1 && d.getDate() === parts.day
}

// Vigencia por defecto del certificado: 1 año calendario desde la fecha de
// certificación (ver spec, "Vigencia"). Devuelve '' si `from` no es una
// fecha válida, en vez de fabricar una fecha basura.
export function addOneYear(from: string): string {
  const parts = parseDateParts(from)
  if (!parts) return ''
  const d = new Date(parts.year + 1, parts.month - 1, parts.day)
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`
}

// Usado tanto por CertificateEditor (mostrar "vigente"/"vencido" en la
// barra) como, más adelante, por site/'s Verify.tsx (duplicado a propósito,
// mismo criterio que la validación del formulario de contacto de site/ —
// ver ese CLAUDE.md, "Validación duplicada a propósito").
export function isStillValid(expirationDate: string): boolean {
  const parts = parseDateParts(expirationDate)
  if (!parts) return false
  const target = new Date(parts.year, parts.month - 1, parts.day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.getTime() <= target.getTime()
}
```

- [ ] **Step 4: Verify with a throwaway node script (no committed test suite — ad hoc, matches the codebase's own convention)**

```bash
cd /home/meraki/altotest/digital_certificate
npx tsx -e "
import { generateCode, isValidCode } from './src/lib/code'
import { addOneYear, isValidDate, isStillValid } from './src/lib/date'
console.assert(isValidCode(generateCode()), 'generateCode should produce a valid code')
console.assert(!isValidCode('IL-20260921-101532'), 'wrong prefix must not validate')
console.assert(addOneYear('21-09-2026') === '21-09-2027', 'addOneYear basic case')
console.assert(addOneYear('29-02-2028') === '28-02-2029', 'addOneYear leap-day rollover: ' + addOneYear('29-02-2028'))
console.assert(isValidDate('21-09-2026'), 'valid date should pass')
console.assert(!isValidDate('31-04-2026'), 'April has 30 days')
console.assert(isStillValid('21-09-2099'), 'far future date is still valid')
console.assert(!isStillValid('01-01-2000'), 'past date is not valid')
console.log('OK')
"
```

Expected: `OK` printed, no assertion failures. (`npx tsx` runs TS directly
without a build step — install it ad hoc if missing: `npm install -D tsx`,
matching how the sibling projects install Playwright ad hoc for
verification rather than keeping it as a permanent dependency; remove it
after this check if you don't want it lingering in `devDependencies`.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add CertificateState type and folio/date helpers"
```

---

### Task 6: Template and normalization

**Files:**
- Create: `digital_certificate/src/lib/template.ts`

**Interfaces:**
- Consumes: `CertificateState` (Task 5).
- Produces: `initialTemplate(): CertificateState`,
  `normalizeCertificate(partial: Partial<CertificateState>): CertificateState`.

- [ ] **Step 1: Write `src/lib/template.ts`**

```ts
import type { CertificateState } from '../types'

// Certificado en blanco con datos de ejemplo ya escritos — se abre lleno,
// no vacío (ver Certificate.tsx: los valores puntuales se marcan como
// ilustrativos con un asterisco, igual que el mockup aprobado). Los campos
// reales (tipo de dispositivo, ensayo, normas) son datos de dominio de
// verdad, no inventados — ver spec, sección 1.
export function initialTemplate(): CertificateState {
  return {
    code: '',
    clientName: 'CBRE',
    clientRut: '76.754.016-7',
    clientAsset: 'Edificio Costanera Norte — Torre B',
    address: 'Apoquindo 5427, Las Condes, Región Metropolitana',
    certificationDate: '',
    expirationDate: '',
    deviceType: 'Tipo A — anclaje estructural fijo',
    substrate: 'Hormigón armado',
    materiality: 'Acero inoxidable A4',
    verificationTest: 'Pull-Out — tracción estática',
    testLoad: '12,5 kN (valor representativo del lote) *',
    installedCount: 46,
    certifiedCount: 46,
    standards: ['EN 795:2012 – Tipo A', 'BS 8610:2017', 'ACI 355.2 + ETA / documentación fabricante'],
    description: 'Certificado de lote, trazable al levantamiento técnico N° IL-20260615-093000, Alto Test.',
  }
}

// Fusiona un documento leído del Worker sobre la plantilla en blanco — si se
// agrega un campo nuevo a CertificateState más adelante, un certificado
// viejo guardado sin ese campo no rompe la UI (mismo patrón que
// normalizeReport en informe_levantamiento/src/lib/template.ts).
export function normalizeCertificate(partial: Partial<CertificateState>): CertificateState {
  return { ...initialTemplate(), ...partial }
}
```

- [ ] **Step 2: Type-check**

```bash
cd /home/meraki/altotest/digital_certificate && npx tsc -b
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add initialTemplate/normalizeCertificate with real example data"
```

---

### Task 7: Worker client (`lib/api.ts`)

**Files:**
- Create: `digital_certificate/src/lib/api.ts`

**Interfaces:**
- Consumes: `CertificateState` (Task 5), `normalizeCertificate` (Task 6).
- Produces: `getStoredAccessKey`, `setStoredAccessKey`, `clearStoredAccessKey`,
  `ApiError`, `SyncState`, `CertificateSummary`, `verifyAccessKey(key)`,
  `listCertificates()`, `fetchCertificate(code)`, `saveCertificate(cert)`,
  `deleteCertificate(code)`.

- [ ] **Step 1: Write `src/lib/api.ts`**

```ts
import type { CertificateState } from '../types'
import { normalizeCertificate } from './template'

const BASE_URL = import.meta.env.VITE_REPORTS_ENDPOINT
const ACCESS_KEY_STORAGE = 'altotest_certificado_access_key'

// Worker compartido con informe_levantamiento/propuesta_tecnica/propuesta_economica
// (ver altotest-documentos/src/index.ts) — "certificado" es el tipo de documento
// de esta app, parte de la ruta (/reports/certificado/:code).
const KIND = 'certificado'

export type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error'

export function getStoredAccessKey(): string {
  return localStorage.getItem(ACCESS_KEY_STORAGE) ?? ''
}
export function setStoredAccessKey(key: string) {
  localStorage.setItem(ACCESS_KEY_STORAGE, key)
}
export function clearStoredAccessKey() {
  localStorage.removeItem(ACCESS_KEY_STORAGE)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const key = getStoredAccessKey()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
      Authorization: `Bearer ${key}`,
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, text || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export interface CertificateSummary {
  code: string
  client: string
  date: string
  updatedAt: number
}

interface CertificateEnvelope {
  code: string
  kind: string
  client: string
  date: string
  updatedAt: number
  doc: CertificateState
}

export async function verifyAccessKey(key: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/reports/${KIND}`, { headers: { Authorization: `Bearer ${key}` } })
  return res.ok
}

export function listCertificates(): Promise<CertificateSummary[]> {
  return request<CertificateSummary[]>(`/reports/${KIND}`)
}

export async function fetchCertificate(code: string): Promise<CertificateState> {
  const envelope = await request<CertificateEnvelope>(`/reports/${KIND}/${encodeURIComponent(code)}`)
  return normalizeCertificate(envelope.doc)
}

export function saveCertificate(cert: CertificateState): Promise<{ ok: boolean; updatedAt: number }> {
  const client = [cert.clientName, cert.clientAsset].filter(Boolean).join(' — ')
  return request(`/reports/${KIND}/${encodeURIComponent(cert.code)}`, {
    method: 'PUT',
    body: JSON.stringify({ code: cert.code, client, date: cert.certificationDate, doc: cert }),
  })
}

export function deleteCertificate(code: string): Promise<{ ok: boolean }> {
  return request(`/reports/${KIND}/${encodeURIComponent(code)}`, { method: 'DELETE' })
}
```

- [ ] **Step 2: Point `.env` at the local Worker and verify against it**

```bash
cd /home/meraki/altotest/altotest-documentos && npm run dev &
sleep 2
cd /home/meraki/altotest/digital_certificate
npx tsx -e "
import { verifyAccessKey, saveCertificate, fetchCertificate, listCertificates, setStoredAccessKey } from './src/lib/api'
import { initialTemplate } from './src/lib/template'
process.env.VITE_REPORTS_ENDPOINT // not used directly; import.meta.env needs Vite, so this script instead hits fetch by hand:
"
```

Since `import.meta.env` only resolves under Vite, verify this task through
the running dev server instead of a bare node script: run `npm run dev`
(Task 4's port 5220), open the browser devtools console, and call:

```js
localStorage.setItem('altotest_certificado_access_key', '1234') // same key used in Task 1/2's .dev.vars
const { saveCertificate, fetchCertificate, listCertificates } = await import('/src/lib/api.ts')
const { initialTemplate } = await import('/src/lib/template.ts')
const cert = { ...initialTemplate(), code: 'CPA-TEST', certificationDate: '21-09-2026', expirationDate: '21-09-2027' }
await saveCertificate(cert)
await fetchCertificate('CPA-TEST')
await listCertificates()
```

Expected: `saveCertificate` resolves `{ok:true,...}`, `fetchCertificate`
returns the same doc back, `listCertificates` includes it.

```bash
kill %1   # stop the local worker dev server
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add Worker client (lib/api.ts) for the certificado kind"
```

---

### Task 8: Autosave store

**Files:**
- Create: `digital_certificate/src/lib/store.ts`

**Interfaces:**
- Consumes: `CertificateState`, `initialTemplate`/`normalizeCertificate`
  (Task 6), `generateCode`/`isValidCode` (Task 5), `todayDate`/`addOneYear`
  (Task 5), `fetchCertificate`/`saveCertificate`/`ApiError`/`SyncState`
  (Task 7).
- Produces: `useCertificateStore(onAuthExpired: () => void)` returning
  `{ cert, setCert, reset, undo, canUndo, loadCertificate, syncState,
  booting }`.

- [ ] **Step 1: Write `src/lib/store.ts`**

```ts
import { useEffect, useRef, useState } from 'react'
import type { CertificateState } from '../types'
import { initialTemplate, normalizeCertificate } from './template'
import { generateCode, isValidCode } from './code'
import { todayDate, addOneYear } from './date'
import { fetchCertificate, saveCertificate, ApiError } from './api'
import type { SyncState } from './api'

// Mirror local de resiliencia, no fuente de datos — la nube manda (mismo
// criterio que informe_levantamiento, ver su CLAUDE.md "Nube como fuente
// de verdad").
const MIRROR_KEY = 'altotest_certificado_mirror'
const PREVIOUS_KEY = `${MIRROR_KEY}_previous`
const AUTOSAVE_DEBOUNCE_MS = 3000

function serialize(cert: CertificateState): string {
  return JSON.stringify(cert)
}

function withCodeAndDates(cert: CertificateState): CertificateState {
  const certificationDate = cert.certificationDate || todayDate()
  return {
    ...cert,
    code: cert.code && isValidCode(cert.code) ? cert.code : generateCode(),
    certificationDate,
    expirationDate: cert.expirationDate || addOneYear(certificationDate),
  }
}

function readMirror(): CertificateState | null {
  const saved = localStorage.getItem(MIRROR_KEY)
  if (!saved) return null
  try {
    return normalizeCertificate(JSON.parse(saved) as Partial<CertificateState>)
  } catch {
    return null
  }
}

function writeMirror(cert: CertificateState) {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(cert))
  } catch (e) {
    console.warn('No se pudo escribir la copia local del certificado:', e)
  }
}

export function useCertificateStore(onAuthExpired: () => void) {
  const [cert, setCert] = useState<CertificateState>(() => withCodeAndDates(readMirror() ?? initialTemplate()))
  const [canUndo, setCanUndo] = useState(() => !!localStorage.getItem(PREVIOUS_KEY))
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [booting, setBooting] = useState(() => !!readMirror())
  const firstChangeAfterReset = useRef(false)
  const saveSeq = useRef(0)
  const hadMirrorOnBoot = useRef(!!readMirror())
  const pristineCert = useRef(cert)
  const [initialSerialized] = useState(() => serialize(cert))
  const lastSavedRef = useRef(initialSerialized)
  const onAuthExpiredRef = useRef(onAuthExpired)
  useEffect(() => {
    onAuthExpiredRef.current = onAuthExpired
  })

  useEffect(() => {
    const mirror = readMirror()
    if (!mirror) return
    fetchCertificate(mirror.code)
      .then((fresh) => {
        setCert(fresh)
        writeMirror(fresh)
        lastSavedRef.current = serialize(fresh)
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          onAuthExpiredRef.current()
          return
        }
        if (e instanceof ApiError && e.status === 404) return
        setSyncState('offline')
      })
      .finally(() => setBooting(false))
  }, [])

  useEffect(() => {
    const isUntouched = !hadMirrorOnBoot.current && cert === pristineCert.current
    if (isUntouched) return
    const seq = ++saveSeq.current
    const t = setTimeout(async () => {
      const snapshot = serialize(cert)
      if (snapshot === lastSavedRef.current) return
      writeMirror(cert)
      setSyncState('saving')
      try {
        await saveCertificate(cert)
        if (saveSeq.current === seq) {
          lastSavedRef.current = snapshot
          setSyncState('saved')
        }
      } catch (e) {
        if (saveSeq.current !== seq) return
        if (e instanceof ApiError) {
          if (e.status === 401) {
            onAuthExpiredRef.current()
            return
          }
          setSyncState('error')
        } else {
          setSyncState('offline')
        }
      }
      if (firstChangeAfterReset.current) {
        firstChangeAfterReset.current = false
        localStorage.removeItem(PREVIOUS_KEY)
        setCanUndo(false)
      }
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [cert])

  useEffect(() => {
    const flushIfHidden = () => {
      if (document.visibilityState !== 'hidden') return
      const snapshot = serialize(cert)
      if (snapshot === lastSavedRef.current) return
      const seq = ++saveSeq.current
      writeMirror(cert)
      saveCertificate(cert)
        .then(() => {
          if (saveSeq.current === seq) lastSavedRef.current = snapshot
        })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', flushIfHidden)
    return () => document.removeEventListener('visibilitychange', flushIfHidden)
  }, [cert])

  function reset() {
    localStorage.setItem(PREVIOUS_KEY, JSON.stringify(cert))
    firstChangeAfterReset.current = true
    setCanUndo(true)
    setCert(withCodeAndDates(initialTemplate()))
  }

  function undo() {
    const saved = localStorage.getItem(PREVIOUS_KEY)
    if (!saved) return
    setCert(JSON.parse(saved))
    localStorage.removeItem(PREVIOUS_KEY)
    firstChangeAfterReset.current = false
    setCanUndo(false)
  }

  // Reemplaza el certificado activo por uno que viene del Historial —
  // a diferencia de "Deshacer" (un solo paso), esto permite volver a
  // CUALQUIER certificado guardado en el servidor.
  function loadCertificate(incoming: CertificateState) {
    setCert(incoming)
  }

  return { cert, setCert, reset, undo, canUndo, loadCertificate, syncState, booting }
}
```

This is a direct, deliberate port of
`informe_levantamiento/src/lib/store.ts`'s `useReportStore` — same
debounce/no-op-guard/mirror/visibilitychange-flush mechanism, already
calibrated against the shared Worker's free-tier KV write quota (see that
project's `CLAUDE.md`, "Arquitectura de datos"). Don't re-derive a different
debounce value without a reason.

- [ ] **Step 2: Type-check**

```bash
cd /home/meraki/altotest/digital_certificate && npx tsc -b
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add useCertificateStore: autosave, mirror, undo (ported from informe_levantamiento)"
```

---

## Phase 2 — Editor shell and branding

### Task 9: Access gate, App shell, base tokens

**Files:**
- Create: `digital_certificate/src/components/AccessGate.tsx`
- Create: `digital_certificate/src/components/Wordmark.tsx`
- Modify: `digital_certificate/src/App.tsx`
- Modify: `digital_certificate/src/index.css`

**Interfaces:**
- Consumes: `getStoredAccessKey`/`setStoredAccessKey`/`clearStoredAccessKey`/`verifyAccessKey` (Task 7).
- Produces: `<AccessGate onSubmit={...} />`, `<Wordmark tone textClassName />`
  (extended with an `"ink"` tone — see Step 1), the gated `App` shell that
  `CertificateEditor` (Task 14) mounts into once authorized.

- [ ] **Step 1: Copy the canonical Wordmark and add an `"ink"` tone**

The certificate's header sits on plain paper and needs the mark at full ink
weight (matches the printed heading color), unlike `site/`'s existing
`"steel"`/`"signal"`/`"paper"` tones, none of which render the curve itself
in ink. Copy the file and extend its `Tone` union locally — this file is now
this project's own copy, not synced back to `site/`.

```bash
cp /home/meraki/altotest/site/src/components/ui/Wordmark.tsx \
   /home/meraki/altotest/digital_certificate/src/components/Wordmark.tsx
```

Edit the copied file:

```tsx
type Tone = "signal" | "steel" | "paper" | "ink"

const STROKE: Record<Tone, string> = {
  signal: "#C2491F",
  steel: "#4C6B7A",
  paper: "#F4F5F2",
  ink: "#10151E",
}

const ANCHOR: Record<Tone, string> = {
  signal: "#10151E",
  steel: "#10151E",
  paper: "#F4F5F2",
  ink: "#10151E",
}
```

(rest of the file — the `Wordmark` component itself — unchanged.)

- [ ] **Step 2: `src/components/AccessGate.tsx`**

Adapted from `informe_levantamiento/src/components/AccessGate.tsx`, dropping
the `reicon-react` icon dependency (not installed in this project — plain
text is enough here, this app has far fewer icons overall than the
multi-chapter informe editor):

```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Wordmark } from './Wordmark'

interface Props {
  onSubmit: (key: string) => Promise<boolean>
}

// Portón de acceso: clave compartida del equipo (la MISMA que usan
// informe_levantamiento/propuesta_tecnica/propuesta_economica), no una
// cuenta por persona — ver spec, sección 4.
export function AccessGate({ onSubmit }: Props) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!key.trim() || busy) return
    setBusy(true)
    setError('')
    const ok = await onSubmit(key.trim())
    setBusy(false)
    if (!ok) setError('Clave incorrecta, o no hay conexión con el servidor.')
  }

  return (
    <div className="access-gate">
      <form className="access-gate-card" onSubmit={handleSubmit}>
        <Wordmark tone="signal" textClassName="text-[17px] text-paper" />
        <p className="access-gate-title">Clave de acceso del equipo</p>
        <p className="access-gate-hint">
          Los certificados se guardan en el servidor de Alto Test, no en este navegador. Pídele la clave a quien
          administre el equipo si no la tienes.
        </p>
        <input
          className="access-gate-input"
          type="password"
          autoFocus
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Clave de acceso"
        />
        {error && <p className="access-gate-error">{error}</p>}
        <button type="submit" className="toolbar-btn" disabled={busy}>
          {busy ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: `src/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { getStoredAccessKey, setStoredAccessKey, clearStoredAccessKey, verifyAccessKey } from './lib/api'
import { AccessGate } from './components/AccessGate'
import CertificateEditor from './CertificateEditor'

export default function App() {
  const [authorized, setAuthorized] = useState(() => !!getStoredAccessKey())
  const [checking, setChecking] = useState(() => !!getStoredAccessKey())

  useEffect(() => {
    const key = getStoredAccessKey()
    if (!key) return
    verifyAccessKey(key).then((ok) => {
      if (!ok) {
        clearStoredAccessKey()
        setAuthorized(false)
      }
      setChecking(false)
    })
  }, [])

  function handleAuthExpired() {
    clearStoredAccessKey()
    setAuthorized(false)
  }

  async function handleAccessSubmit(key: string): Promise<boolean> {
    const ok = await verifyAccessKey(key)
    if (ok) {
      setStoredAccessKey(key)
      setAuthorized(true)
    }
    return ok
  }

  if (checking) return <div className="boot-screen">Cargando…</div>
  if (!authorized) return <AccessGate onSubmit={handleAccessSubmit} />

  return <CertificateEditor onAuthExpired={handleAuthExpired} />
}
```

(`CertificateEditor` is created in Task 14 — until then, add a temporary
`src/CertificateEditor.tsx` exporting a stub `export default function
CertificateEditor() { return <div>TODO</div> }` just so this compiles; Task
14 replaces it fully.)

- [ ] **Step 4: `src/index.css` — brand tokens + access-gate styles**

```css
@import "tailwindcss";

:root{
  --paper:#F4F5F2; --stage:#DDDED9; --ink:#10151E; --ink-soft:#1B2430;
  --steel:#4C6B7A; --steel-light:#8FA3AD; --steel-pale:#CBD5D8; --steel-body:#2A313B;
  --signal:#C2491F;
}
*{ box-sizing:border-box; }
body{
  margin:0; background:var(--stage); color:var(--ink);
  font-family:'IBM Plex Sans',sans-serif;
}
.boot-screen{ padding:40px; font-family:'IBM Plex Mono',monospace; color:var(--steel); }

.access-gate{ min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--ink); padding:24px; }
.access-gate-card{
  background:var(--ink-soft); border:1px solid var(--steel-body); border-radius:4px;
  padding:32px; width:320px; display:flex; flex-direction:column; align-items:center; gap:14px;
}
.access-gate-title{ color:var(--paper); font-weight:600; font-size:14px; margin:0; }
.access-gate-hint{ color:var(--steel-light); font-size:12px; text-align:center; line-height:1.5; margin:0; }
.access-gate-input{
  width:100%; background:var(--ink); border:1px solid var(--steel-body); color:var(--paper);
  padding:10px 12px; font-family:'IBM Plex Mono',monospace; font-size:14px; border-radius:2px;
  text-align:center; letter-spacing:.1em;
}
.access-gate-error{ color:var(--signal); font-size:12px; margin:0; }
.toolbar-btn{
  background:var(--signal); color:var(--paper); border:none; padding:10px 20px;
  font-family:'IBM Plex Sans',sans-serif; font-weight:600; font-size:13px; border-radius:2px; cursor:pointer;
}
.toolbar-btn:disabled{ opacity:.6; cursor:default; }
```

- [ ] **Step 5: Verify boot + gate flow**

```bash
cd /home/meraki/altotest/altotest-documentos && npm run dev &
cd /home/meraki/altotest/digital_certificate && npm run dev &
sleep 2
```

Open `http://localhost:5220` — expect the access-gate card on a dark
background. Enter the local dev `.dev.vars` key (`1234` from Task 1) →
expect it to switch to the `CertificateEditor` stub ("TODO").

```bash
kill %1 %2
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add AccessGate, App shell, and brand tokens (ink Wordmark tone)"
```

---

### Task 10: Certificate assets (tower watermark)

**Files:**
- Create: `digital_certificate/src/assets/tower.svg`

- [ ] **Step 1: Copy the already-cleaned tower asset from the approved mockup**

This is the exact file used in the approved Artifact (background rect and
off-brand decorative triangles already stripped, root `width`/`height` fixed
to numeric values matching its `viewBox` — see the design spec for why that
matters for SVG-as-`<img>` intrinsic sizing).

```bash
mkdir -p /home/meraki/altotest/digital_certificate/src/assets
cp "/tmp/claude-1000/-home-meraki-altotest/641deee5-6b36-45c0-99c8-bafb99b9e76f/scratchpad/artifact-out2/assets/tower.svg" \
   /home/meraki/altotest/digital_certificate/src/assets/tower.svg
```

- [ ] **Step 2: Confirm it's the fixed version (numeric width/height, not percentages)**

```bash
head -c 400 /home/meraki/altotest/digital_certificate/src/assets/tower.svg
```

Expected: the opening `<svg>` tag shows `width="1123" height="794"` (numeric),
not `width="100%" height="100%"`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add tower watermark asset (cleaned copy from the approved mockup)"
```

---

### Task 11: The certificate sheet (`Certificate.tsx`)

**Files:**
- Create: `digital_certificate/src/components/Certificate.tsx`
- Create: `digital_certificate/src/certificate.css`

**Interfaces:**
- Consumes: `CertificateState` (Task 5), `Wordmark` (Task 9), tower asset
  (Task 10). `StampSeal` (Task 12) and `Qr` (Task 13) are consumed here too
  but stubbed in this task and wired for real once those tasks land.
- Produces: `<Certificate cert={cert} onChange={(patch) => void} />` — the
  full visual sheet, editable in place.

This task adapts the approved mockup
(`https://claude.ai/artifact/YV1N9ihezHQnLs8hV9iVvy`) into React, with the
content changes the spec requires for the lote/proyecto model: "Ubicación
del punto"/"Placa N°" (single-anchor fields) are replaced by "Cantidad
instalada"/"Cantidad certificada" + `address`; "Normas aplicables" becomes
an editable chip list; the description text no longer says "Certificado
individual".

- [ ] **Step 1: `src/certificate.css` — transcribed from the mockup, plus the print-scale wrapper**

```css
/* Ratio A4: la maqueta se diseñó a 900×1273px (proporción A4 exacta,
   0.7071) para verse cómoda en el visor del Artifact — no es el tamaño
   físico real. En vez de recalcular a mano cada medida del diseño ya
   aprobado a mm, se deja el diseño intacto a 900×1273 "px de diseño" y se
   reescala con transform sólo al imprimir, contra un contenedor del
   tamaño físico real de A4. 210mm a 96dpi = 793.7008px; 793.7008/900 =
   0.881890 — ese es el factor de abajo. */
.cert-print-wrap{ width:900px; margin:0 auto; }

.sheet{
  width:900px; height:1273px; background:var(--ink); padding:14px;
  position:relative; margin:0 auto;
  clip-path: path('M 22,0 L 878,0 A 22,22 0 0 0 900,22 L 900,1251 A 22,22 0 0 0 878,1273 L 22,1273 A 22,22 0 0 0 0,1251 L 0,22 A 22,22 0 0 0 22,0 Z');
}
.sheet-inner{
  width:100%; height:100%; background:var(--paper); position:relative; overflow:hidden;
  display:flex; flex-direction:column; padding:46px 52px 0;
  clip-path: path('M 8,0 L 864,0 A 8,8 0 0 0 872,8 L 872,1237 A 8,8 0 0 0 864,1245 L 8,1245 A 8,8 0 0 0 0,1237 L 0,8 A 8,8 0 0 0 8,0 Z');
}

.wm-relief{
  position:absolute; inset:0; pointer-events:none;
  background-image: repeating-linear-gradient(135deg,
    rgba(16,21,30,0.035) 0px, rgba(16,21,30,0.035) 0.6px,
    transparent 0.6px, transparent 8px);
}
.wm-tower{
  position:absolute; width:900px; right:0; top:674px; opacity:.9;
  filter: grayscale(1) sepia(1) hue-rotate(160deg) saturate(300%) brightness(.82);
  pointer-events:none;
}

header{ display:flex; align-items:flex-start; justify-content:space-between; position:relative; z-index:1; }
.doc-id{ text-align:right; font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--steel); letter-spacing:.05em; line-height:1.6; }
.doc-id b{ color:var(--ink); font-weight:600; }

.title-block{ margin-top:38px; position:relative; z-index:1; }
.eyebrow{
  font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.2em;
  text-transform:uppercase; color:var(--steel); font-weight:600; margin:0 0 6px;
}
.title-block h1{ font-size:64px; font-weight:700; margin:0; letter-spacing:-0.01em; line-height:1; }
.title-block h2{ font-size:23px; font-weight:500; margin:10px 0 0; color:var(--ink-soft); letter-spacing:.01em; }

.rule{ height:1px; background:var(--steel-pale); margin:28px 0 0; position:relative; z-index:1; }

.body-grid{ display:flex; gap:36px; margin-top:30px; flex:1; position:relative; z-index:1; min-height:0; }
.col-data{ flex:1.55; display:flex; flex-direction:column; gap:26px; min-width:0; }
.col-valid{ flex:1; display:flex; flex-direction:column; align-items:center; padding-top:4px; }
.valid-card{
  width:260px; height:426px; box-sizing:border-box;
  display:flex; flex-direction:column; align-items:center; gap:18px;
  background:var(--paper); border:1px solid var(--steel-pale);
  padding:26px 36px 26px;
  clip-path: path('M 16,0 L 244,0 A 16,16 0 0 0 260,16 L 260,410 A 16,16 0 0 0 244,426 L 16,426 A 16,16 0 0 0 0,410 L 0,16 A 16,16 0 0 0 16,0 Z');
}
.valid-title{
  font-family:'IBM Plex Sans',sans-serif; font-weight:700; font-size:14px;
  letter-spacing:.03em; text-transform:uppercase; color:var(--ink);
  padding-bottom:12px; border-bottom:1px solid var(--steel-pale); width:100%; text-align:center; margin:0;
}

dl.facts{ display:grid; grid-template-columns:1fr 1fr; gap:16px 24px; margin:0; }
dl.facts div{ display:flex; flex-direction:column; gap:3px; }
dl.facts dt{
  font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--steel);
}
dl.facts dd{ margin:0; font-size:14px; color:var(--ink); font-weight:500; }
dl.facts dd.muted{ color:var(--ink-soft); font-weight:400; font-size:12.5px; text-align:justify; hyphens:auto; }
dl.facts .span-2{ grid-column:1 / -1; }

table.spec{ width:100%; border-collapse:collapse; table-layout:fixed; }
table.spec caption{
  text-align:left; font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--steel); margin-bottom:8px; font-weight:600;
}
table.spec tr{ border-top:1px solid var(--steel-pale); }
table.spec tr:first-of-type{ border-top:1px solid var(--ink); }
table.spec td{ padding:8px 0; font-size:12.5px; vertical-align:top; }
table.spec td.field{ color:var(--steel-body); width:44%; }
table.spec td.value{ color:var(--ink); font-weight:500; text-align:right; }

.tags{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.tag{
  font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.04em;
  border:1px solid var(--steel-pale); color:var(--steel-body); padding:4px 9px;
  display:inline-flex; align-items:center; gap:6px;
}
.tag-remove{ border:none; background:none; color:var(--steel); cursor:pointer; font-family:inherit; font-size:11px; padding:0; line-height:1; }
.tag-add-input{
  font-family:'IBM Plex Mono',monospace; font-size:10px; border:1px dashed var(--steel-pale);
  padding:4px 9px; background:transparent; color:var(--ink); width:220px;
}

.note{ font-size:10px; color:var(--steel); font-style:italic; text-align:justify; hyphens:auto; margin:0; }
.trace{ font-size:11px; color:var(--ink-soft); border-left:2px solid var(--steel-pale); padding-left:10px; text-align:justify; hyphens:auto; margin:0; }
.stamp-label{ font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:var(--steel); margin:0 0 6px; }

.qr-card{
  width:132px; height:132px; box-sizing:border-box;
  display:flex; align-items:center; justify-content:center;
  background:var(--paper); border:1px solid var(--steel-pale);
  padding:18px;
  clip-path: path('M 7,0 L 125,0 A 7,7 0 0 0 132,7 L 132,125 A 7,7 0 0 0 125,132 L 7,132 A 7,7 0 0 0 0,125 L 0,7 A 7,7 0 0 0 7,0 Z');
}

footer{
  position:relative; z-index:1; margin-top:auto; padding:16px 0 20px;
  border-top:1px solid var(--steel-pale);
  display:flex; align-items:center; justify-content:space-between;
}
footer .fl{ font-family:'IBM Plex Mono',monospace; font-size:9.5px; letter-spacing:.08em; color:var(--steel); }
footer .fr{
  background:var(--ink); color:var(--paper); font-family:'IBM Plex Mono',monospace;
  font-size:9.5px; letter-spacing:.05em; padding:6px 14px 6px 20px;
  clip-path: polygon(14px 0, 100% 0, 100% 100%, 0 100%);
}

/* Campos editables: se ven idénticos al texto estático hasta que el mouse
   pasa por encima o reciben foco (affordance mínima), y pierden todo
   chrome de <input>/<textarea> al imprimir. */
.field-input{
  font: inherit; color: inherit; background: transparent; border: none; padding: 0; margin: 0;
  width: 100%; text-align: inherit;
}
.field-input:hover, .field-input:focus{ background: var(--stage); outline: none; }
table.spec .field-input{ text-align: right; }

@media print{
  @page{ size:A4; margin:0; }
  html, body{ background:none; }
  .cert-print-wrap{
    width:210mm; height:297mm; overflow:hidden;
  }
  .cert-print-wrap .sheet{
    transform: scale(0.881890);
    transform-origin: top left;
  }
  .field-input{ border:none !important; background:transparent !important; }
  .field-input:hover, .field-input:focus{ background: transparent; }
}
```

- [ ] **Step 2: `src/components/Certificate.tsx`**

```tsx
import type { CertificateState } from '../types'
import { Wordmark } from './Wordmark'
import { StampSeal } from './StampSeal'
import { Qr } from './Qr'
import towerSrc from '../assets/tower.svg'
import { useState } from 'react'
import type { CSSProperties } from 'react'

interface Props {
  cert: CertificateState
  onChange: (patch: Partial<CertificateState>) => void
}

function Field({
  value,
  onChange,
  style,
}: {
  value: string
  onChange: (v: string) => void
  style?: CSSProperties
}) {
  return <input className="field-input no-print-chrome" value={value} onChange={(e) => onChange(e.target.value)} style={style} />
}

export function Certificate({ cert, onChange }: Props) {
  const [newStandard, setNewStandard] = useState('')

  function set<K extends keyof CertificateState>(key: K, value: CertificateState[K]) {
    onChange({ [key]: value } as Partial<CertificateState>)
  }

  function addStandard() {
    const v = newStandard.trim()
    if (!v) return
    onChange({ standards: [...cert.standards, v] })
    setNewStandard('')
  }

  function removeStandard(index: number) {
    onChange({ standards: cert.standards.filter((_, i) => i !== index) })
  }

  const verifyUrl = `https://altotest.cl/verifica/${cert.code}`

  return (
    <div className="cert-print-wrap">
      <div className="sheet">
        <div className="sheet-inner">
          <div className="wm-relief" />
          <img className="wm-tower" src={towerSrc} alt="" />

          <header>
            <Wordmark tone="ink" textClassName="text-[16px]" />
            <div className="doc-id">
              CERTIFICADO N° <b>{cert.code}</b>
              <br />
              Emitido <Field value={cert.certificationDate} onChange={(v) => set('certificationDate', v)} style={{ display: 'inline', width: 'auto' }} />
            </div>
          </header>

          <div className="title-block">
            <p className="eyebrow">Certificación de dispositivo — EN 795:2012</p>
            <h1>CERTIFICADO</h1>
            <h2>DE PUNTOS DE ANCLAJE</h2>
          </div>

          <div className="rule" />

          <div className="body-grid">
            <div className="col-data">
              <dl className="facts">
                <div>
                  <dt>Cliente</dt>
                  <dd><Field value={cert.clientName} onChange={(v) => set('clientName', v)} /></dd>
                </div>
                <div>
                  <dt>Recinto / proyecto</dt>
                  <dd><Field value={cert.clientAsset} onChange={(v) => set('clientAsset', v)} /></dd>
                </div>
                <div className="span-2">
                  <dt>Dirección</dt>
                  <dd><Field value={cert.address} onChange={(v) => set('address', v)} /></dd>
                </div>
                <div>
                  <dt>Cantidad instalada</dt>
                  <dd>
                    <input
                      className="field-input"
                      type="number"
                      value={cert.installedCount}
                      onChange={(e) => set('installedCount', Number(e.target.value))}
                    />
                  </dd>
                </div>
                <div>
                  <dt>Cantidad certificada</dt>
                  <dd>
                    <input
                      className="field-input"
                      type="number"
                      value={cert.certifiedCount}
                      onChange={(e) => set('certifiedCount', Number(e.target.value))}
                    />
                  </dd>
                </div>
                <div>
                  <dt>Válido hasta</dt>
                  <dd><Field value={cert.expirationDate} onChange={(v) => set('expirationDate', v)} /></dd>
                </div>
                <div className="span-2">
                  <dt>Vigencia</dt>
                  <dd className="muted">
                    Duración de 1 año calendario desde la fecha de certificación. Sujeto a inspección periódica
                    conforme EN 365:2004.
                  </dd>
                </div>
              </dl>

              <table className="spec">
                <caption>Ficha técnica del lote</caption>
                <tbody>
                  <tr>
                    <td className="field">Tipo de dispositivo (EN 795)</td>
                    <td className="value"><Field value={cert.deviceType} onChange={(v) => set('deviceType', v)} /></td>
                  </tr>
                  <tr>
                    <td className="field">Sustrato de fijación</td>
                    <td className="value"><Field value={cert.substrate} onChange={(v) => set('substrate', v)} /></td>
                  </tr>
                  <tr>
                    <td className="field">Materialidad</td>
                    <td className="value"><Field value={cert.materiality} onChange={(v) => set('materiality', v)} /></td>
                  </tr>
                  <tr>
                    <td className="field">Ensayo de verificación</td>
                    <td className="value"><Field value={cert.verificationTest} onChange={(v) => set('verificationTest', v)} /></td>
                  </tr>
                  <tr>
                    <td className="field">Carga de ensayo aplicada *</td>
                    <td className="value"><Field value={cert.testLoad} onChange={(v) => set('testLoad', v)} /></td>
                  </tr>
                </tbody>
              </table>
              <p className="note">* Ensayo individual por dispositivo, registrado en el respaldo técnico del lote.</p>

              <div>
                <p className="stamp-label">Normas aplicables</p>
                <div className="tags">
                  {cert.standards.map((s, i) => (
                    <span className="tag" key={i}>
                      {s}
                      <button type="button" className="tag-remove no-print" onClick={() => removeStandard(i)} title="Quitar">
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    className="tag-add-input no-print"
                    placeholder="Agregar norma…"
                    value={newStandard}
                    onChange={(e) => setNewStandard(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addStandard()}
                  />
                </div>
              </div>

              <div>
                <p className="stamp-label">Descripción</p>
                <p className="trace">
                  <Field value={cert.description} onChange={(v) => set('description', v)} />
                </p>
              </div>
            </div>

            <div className="col-valid">
              <div className="valid-card">
                <p className="valid-title">Validación</p>
                <StampSeal />
                <div className="qr-card">
                  <Qr value={verifyUrl} />
                </div>
              </div>
            </div>
          </div>

          <footer>
            <span className="fl">ALTO TEST · CERTIFICACIÓN DE PUNTOS DE ANCLAJE</span>
            <span className="fr">{cert.code}</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
```

Add `.no-print{ display:none }` inside a `@media print` block in
`certificate.css` (append):

```css
@media print{ .no-print{ display:none !important; } }
```

- [ ] **Step 3: Import `certificate.css` from `index.css`**

```css
/* append to src/index.css */
@import "./certificate.css";
```

- [ ] **Step 4: Temporary stubs so this compiles ahead of Tasks 12/13**

```tsx
// src/components/StampSeal.tsx — replaced fully in Task 12
export function StampSeal() {
  return <svg width="176" height="176" viewBox="-24 -24 48 48" />
}
```

```tsx
// src/components/Qr.tsx — replaced fully in Task 13
export function Qr({ value }: { value: string }) {
  return <svg width="96" height="96" viewBox="0 0 21 21" data-value={value} />
}
```

- [ ] **Step 5: Wire into `CertificateEditor` stub temporarily to render on screen**

Update the temporary `src/CertificateEditor.tsx` stub from Task 9 to:

```tsx
import { Certificate } from './components/Certificate'
import { initialTemplate } from './lib/template'
import { useState } from 'react'
import type { CertificateState } from './types'

export default function CertificateEditor() {
  const [cert, setCert] = useState<CertificateState>(initialTemplate())
  return <Certificate cert={cert} onChange={(patch) => setCert((c) => ({ ...c, ...patch }))} />
}
```

(Task 14 replaces this with the real editor wired to `useCertificateStore`
+ Toolbar + HistoryMenu.)

- [ ] **Step 6: Type-check and visual verification**

```bash
cd /home/meraki/altotest/digital_certificate && npx tsc -b
npm run dev &
sleep 2
```

Install Playwright ad hoc if not already cached (`~/.cache/ms-playwright/`)
and take a screenshot:

```bash
npm install -D playwright 2>/dev/null
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 1350 } });
  await page.goto('http://localhost:5220');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/cert-check.png', fullPage: true });
  await browser.close();
})();
"
kill %1
```

Open `/tmp/cert-check.png` and confirm against the approved mockup: concave
frame intact on all sides, tower watermark visible bottom-right, wordmark in
ink with plain circle endpoints, title block, both data columns, the
Validación card (title + stamp placeholder + QR placeholder), footer. The
only expected content differences from the mockup are the lote-level fields
("Cliente"/"Recinto"/"Cantidad instalada"/"Cantidad certificada" instead of
"Activo"/"Ubicación del punto"/"Placa N°").

- [ ] **Step 7: Print-path verification (the transform-scale fix)**

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5220');
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: '/tmp/cert-check.pdf', printBackground: true, preferCSSPageSize: true });
  await browser.close();
})();
"
python3 -c "
import pypdf
r = pypdf.PdfReader('/tmp/cert-check.pdf')
print('pages:', len(r.pages))
box = r.pages[0].mediabox
print('page size pt:', box.width, box.height)
print('page size mm:', float(box.width)/72*25.4, float(box.height)/72*25.4)
"
```

Expected: exactly 1 page, size ≈ 210mm × 297mm (A4) — not the 900×1273
"design px" size and not multiple pages.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add Certificate.tsx: mockup ported to React with lote/proyecto fields

Editable fields (native inputs styled to match static text), editable
normas-aplicables chips, print-time transform-scale to real A4 (design
was authored at a 900x1273px canvas matching A4's ratio, not its
physical size)."
```

---

### Task 12: Institutional stamp (`StampSeal.tsx`)

**Files:**
- Create: `digital_certificate/src/components/StampSeal.tsx`

**Interfaces:**
- Consumes: nothing external — pure presentational, ported from the
  mockup's inline `<script>` IIFE.
- Produces: `<StampSeal />`, replacing the Task 11 stub.

- [ ] **Step 1: Port the mockup's trig-based ring-text stamp builder to a React component**

The mockup built this with raw DOM (`document.createElementNS`) inside a
`<script>` tag, since it was static HTML. In React, build the same SVG tree
declaratively — no imperative DOM needed, this is a fixed, non-interactive
graphic.

```tsx
const R = 17.5

function ringPath(id: string, startDeg: number, sweep: 0 | 1) {
  const rad = (startDeg * Math.PI) / 180
  const x = R * Math.sin(rad)
  const y = sweep === 1 ? R * Math.cos(rad) : -R * Math.cos(rad)
  return { id, d: `M ${-x},${y} A ${R},${R} 0 0 ${sweep} ${x},${y}` }
}

// Timbre institucional — trazado geométricamente (no una imagen), portado
// del <script> del mockup aprobado a JSX declarativo. Mismo cálculo
// trigonométrico: dos arcos de texto (arriba/abajo) sobre un anillo doble,
// con el nombre y la norma centrados.
export function StampSeal() {
  const top = ringPath('stamp-top', 50, 0)
  const bot = ringPath('stamp-bot', 72, 1)

  return (
    <svg width={176} height={176} viewBox="-24 -24 48 48">
      <defs>
        <path id={top.id} d={top.d} fill="none" />
        <path id={bot.id} d={bot.d} fill="none" />
      </defs>
      <circle cx={0} cy={0} r={R} fill="none" stroke="#10151E" strokeWidth={6.5} />
      <circle cx={0} cy={0} r={R - 4.1} fill="none" stroke="#10151E" strokeWidth={0.35} />
      <text textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight={700} fontSize={3.3} fill="#F4F5F2" letterSpacing="0.06em">
        <textPath href={`#${top.id}`} startOffset="50%">
          CERTIFICADO
        </textPath>
      </text>
      <text textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight={700} fontSize={2.5} fill="#F4F5F2" letterSpacing="0.02em">
        <textPath href={`#${bot.id}`} startOffset="50%" side="right">
          PUNTOS DE ANCLAJE
        </textPath>
      </text>
      <text x={0} y={-1} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight={700} fontSize={4.4} fill="#10151E">
        ALTO TEST
      </text>
      <text x={0} y={4.8} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight={600} fontSize={2.9} fill="#10151E">
        EN 795:2012
      </text>
    </svg>
  )
}
```

Note the bottom ring text changed from the mockup's "ANCLAJE UNIPERSONAL" to
"PUNTOS DE ANCLAJE" — same content correction as everywhere else in this
plan (lote/proyecto, not a single anchor).

- [ ] **Step 2: Swap the stub import in `Certificate.tsx`**

Already imports `{ StampSeal } from './StampSeal'` — delete the temporary
stub file's content and confirm it now resolves to this real component (no
`Certificate.tsx` changes needed, the import path is unchanged).

- [ ] **Step 3: Visual verification**

```bash
cd /home/meraki/altotest/digital_certificate && npx tsc -b
npm run dev &
sleep 2
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
  await page.goto('http://localhost:5220');
  await page.waitForTimeout(300);
  const el = await page.\$('.valid-card');
  await el.screenshot({ path: '/tmp/stamp-check.png' });
  await browser.close();
})();
"
kill %1
```

Open `/tmp/stamp-check.png` — expect a circular stamp reading "CERTIFICADO"
curved along the top arc, "PUNTOS DE ANCLAJE" curved along the bottom arc
(right-side-up, not mirrored — this is exactly what `side="right"` on the
bottom `textPath` fixes, same technique already verified working in the
mockup), "ALTO TEST" / "EN 795:2012" centered.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add StampSeal: institutional ring-text stamp, ported from the mockup script"
```

---

### Task 13: Real scannable QR (`Qr.tsx`)

**Files:**
- Create: `digital_certificate/src/components/Qr.tsx`

**Interfaces:**
- Consumes: `qrcode` package (`QRCode.create`).
- Produces: `<Qr value={string} />`, replacing the Task 11 stub. Renders a
  **real, decodable** QR — this is the one place this plan requires
  verifying against an actual decoder, not just visual inspection, because
  the mockup's version was decorative (random dots, not real module data)
  and would NOT scan.

**Why this can't just reuse the mockup's QR script as-is:** the mockup drew
sparse pseudo-random dots (`r=0.36` circles, most cells empty) on a fixed
21×21 grid purely for visual texture — there was no real payload, so nothing
needed to actually decode. A real QR encoding a ~40-character URL at a
useful error-correction level needs more modules than 21×21 (that's QR
version 1, good for ~7 alphanumeric chars at high correction) and every dark
module needs to be *solid* enough for a scanner to read it as "dark", not a
sparse dot. This task computes the real module grid from the actual URL via
`qrcode`'s `create()`, renders each dark module as a circle sized to
actually cover the module cell, and — critically — verifies the rendered
result decodes back to the original URL before calling it done.

- [ ] **Step 1: Write `src/components/Qr.tsx`**

```tsx
import { create } from 'qrcode'

interface Props {
  value: string
}

// Ojos "finder" circulares (mismo tratamiento estético que el mockup:
// anillo oscuro / claro / punto oscuro), pero ahora dibujados según la
// posición real que exige la especificación QR (7 módulos, en las 3
// esquinas, sin importar el tamaño total de la matriz) — no una posición
// fija asumiendo 21x21.
function FinderEye({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill="#10151E" />
      <circle cx={cx} cy={cy} r={2.4} fill="#F4F5F2" />
      <circle cx={cx} cy={cy} r={1.35} fill="#10151E" />
    </g>
  )
}

export function Qr({ value }: Props) {
  // Nivel de corrección alto ('H', ~30% recuperable): necesario para poder
  // tapar el centro con "ALTO TEST" sin romper el escaneo. `create()` elige
  // automáticamente la versión (tamaño de matriz) mínima que entra a ese
  // nivel — nunca asumir un tamaño fijo, una URL más larga necesita más
  // módulos.
  const qr = create(value, { errorCorrectionLevel: 'H' })
  const { size } = qr.modules
  const mid = size / 2
  // Radio del hueco central para el logo, en módulos — calibrado para
  // quedar bajo el ~30% de tolerancia de 'H' sumado al margen que ya
  // consumen las formas circulares en vez de cuadradas exactas (ver Step 2
  // de verificación: se prueba con el decoder real, no se asume).
  const logoRadius = Math.max(3.2, size * 0.14)

  const isFinderZone = (x: number, y: number) =>
    (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9)

  const dots: { x: number; y: number }[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (isFinderZone(x, y)) continue
      const dx = x + 0.5 - mid
      const dy = y + 0.5 - mid
      if (Math.sqrt(dx * dx + dy * dy) < logoRadius) continue
      // .get(row, col) — método público de BitMatrix, más seguro que indexar
      // su array interno a mano (no está garantizado en los tipos de @types/qrcode).
      if (qr.modules.get(y, x)) dots.push({ x, y })
    }
  }

  return (
    <svg width={96} height={96} viewBox={`0 0 ${size} ${size}`}>
      <rect x={0} y={0} width={size} height={size} fill="#F4F5F2" />
      {dots.map((d, i) => (
        // r=0.46: casi todo el módulo (pitch=1), a propósito — un punto
        // chico como el del mockup decorativo (r=0.36, mucho hueco entre
        // puntos) no tiene suficiente "oscuridad" por módulo para que un
        // lector real lo distinga de fondo. Ver verificación con jsQR.
        <circle key={i} cx={d.x + 0.5} cy={d.y + 0.5} r={0.46} fill="#10151E" />
      ))}
      <FinderEye cx={3.5} cy={3.5} />
      <FinderEye cx={size - 3.5} cy={3.5} />
      <FinderEye cx={3.5} cy={size - 3.5} />
      <circle cx={mid} cy={mid} r={logoRadius} fill="#F4F5F2" />
      <circle cx={mid} cy={mid} r={logoRadius} fill="none" stroke="#10151E" strokeWidth={0.25} />
      <text x={mid} y={mid - 0.55} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight={700} fontSize={2.1} fill="#10151E">
        ALTO
      </text>
      <text x={mid} y={mid + 1.8} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight={700} fontSize={2.1} fill="#10151E">
        TEST
      </text>
    </svg>
  )
}
```

- [ ] **Step 2: Verify it actually decodes — this is the real acceptance test, not visual inspection**

Set up an isolated scratch check (not a project dependency — same "ad hoc
verification tool" pattern the sibling projects use for Playwright/PDF
checks):

```bash
mkdir -p /tmp/qr-verify && cd /tmp/qr-verify
npm init -y >/dev/null
npm install qrcode jsqr sharp playwright >/dev/null
```

```js
// /tmp/qr-verify/check.js
const { chromium } = require('playwright')
const jsQR = require('jsqr')
const sharp = require('sharp')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 200, height: 200 } })
  await page.goto('http://localhost:5220')
  await page.waitForTimeout(300)
  const el = await page.$('.qr-card svg')
  const buf = await el.screenshot()
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height)
  if (!result) {
    console.error('FAILED TO DECODE')
    process.exit(1)
  }
  console.log('decoded:', result.data)
})()
```

```bash
cd /home/meraki/altotest/digital_certificate && npm run dev &
sleep 2
node /tmp/qr-verify/check.js
kill %1
```

Expected: `decoded: https://altotest.cl/verifica/CPA-...` (the exact code
currently in `initialTemplate()`'s blank certificate, or whatever `code` the
running editor currently has). **If this fails to decode**, do not proceed —
increase `dots` circle radius (try `0.5`) and/or shrink `logoRadius` first,
re-run this exact check, before moving on. This is the concrete,
non-negotiable gate this task is built around.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add Qr: real scannable QR (qrcode lib, H correction, styled circular modules)

Verified with jsQR against a rendered screenshot, not just visually --
the mockup's QR was decorative dots with no real payload and would not
have scanned."
```

---

## Phase 3 — Editor chrome

### Task 14: Toolbar, HistoryMenu, SyncStatus, full `CertificateEditor`

**Files:**
- Create: `digital_certificate/src/components/Toolbar.tsx`
- Create: `digital_certificate/src/components/HistoryMenu.tsx`
- Create: `digital_certificate/src/components/SyncStatus.tsx`
- Modify: `digital_certificate/src/CertificateEditor.tsx` (replacing the
  Task 11 stub)
- Modify: `digital_certificate/src/index.css` (toolbar/history/sync styles)

**Interfaces:**
- Consumes: `useCertificateStore` (Task 8), `listCertificates` /
  `fetchCertificate` / `deleteCertificate` (Task 7), `Certificate` (Task
  11), `isStillValid` (Task 5).
- Produces: the real `CertificateEditor` default export that `App.tsx`
  (Task 9) mounts.

- [ ] **Step 1: `src/components/SyncStatus.tsx`** (adapted from informe, no `reicon-react`)

```tsx
import type { SyncState } from '../lib/api'

const LABEL: Partial<Record<SyncState, string>> = {
  saving: 'Guardando…',
  saved: 'Guardado en la nube',
  offline: 'Sin conexión — cambios no guardados',
  error: 'Error al guardar',
}

export function SyncStatus({ state }: { state: SyncState }) {
  const label = LABEL[state]
  if (!label) return null
  return (
    <div className={`sync-status sync-status--${state} no-print`} title={label}>
      {label}
    </div>
  )
}
```

- [ ] **Step 2: `src/components/HistoryMenu.tsx`** (adapted from informe, `CertificateState`/`Summary` types)

```tsx
import { useEffect, useRef, useState } from 'react'
import type { CertificateState } from '../types'
import { listCertificates, deleteCertificate, fetchCertificate, type CertificateSummary } from '../lib/api'

interface Props {
  currentCode: string
  onOpen: (cert: CertificateState) => void
}

export function HistoryMenu({ currentCode, onOpen }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<CertificateSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [openingCode, setOpeningCode] = useState<string | null>(null)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      setItems(await listCertificates())
    } catch {
      setError('No se pudo cargar el historial.')
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    if (!open) refresh()
    setOpen((v) => !v)
  }

  async function openItem(code: string) {
    setOpeningCode(code)
    try {
      onOpen(await fetchCertificate(code))
      setOpen(false)
    } catch {
      setError('No se pudo abrir ese certificado.')
    } finally {
      setOpeningCode(null)
    }
  }

  async function removeItem(code: string) {
    try {
      await deleteCertificate(code)
      setItems((prev) => prev.filter((i) => i.code !== code))
    } catch {
      setError('No se pudo quitar ese certificado.')
    }
  }

  return (
    <div className="history-menu no-print" ref={ref}>
      <button type="button" className="toolbar-btn toolbar-btn--ghost" onClick={toggle}>
        Historial
      </button>
      {open && (
        <div className="history-dropdown">
          {loading && <p className="history-empty">Cargando…</p>}
          {!loading && error && <p className="history-empty">{error}</p>}
          {!loading && !error && items.length === 0 && <p className="history-empty">Todavía no hay certificados guardados.</p>}
          {!loading &&
            !error &&
            items.map((item) => (
              <div key={item.code} className={`history-item ${item.code === currentCode ? 'is-current' : ''}`}>
                <button type="button" className="history-item-open" disabled={openingCode !== null} onClick={() => openItem(item.code)}>
                  <p className="history-item-code">
                    {item.code}
                    {item.code === currentCode && <span className="history-item-tag"> · actual</span>}
                  </p>
                  <p className="history-item-client">{item.client || 'Sin cliente'}</p>
                  <p className="history-item-date">{item.date || 'sin fecha'}</p>
                </button>
                <button type="button" className="history-item-remove" onClick={() => removeItem(item.code)}>
                  ×
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `src/components/Toolbar.tsx`**

```tsx
import { Wordmark } from './Wordmark'
import { HistoryMenu } from './HistoryMenu'
import { SyncStatus } from './SyncStatus'
import type { CertificateState } from '../types'
import type { SyncState } from '../lib/api'

interface Props {
  cert: CertificateState
  syncState: SyncState
  canUndo: boolean
  onNew: () => void
  onUndo: () => void
  onOpen: (cert: CertificateState) => void
}

export function Toolbar({ cert, syncState, canUndo, onNew, onUndo, onOpen }: Props) {
  return (
    <div className="toolbar no-print">
      <Wordmark tone="steel" textClassName="text-[14px]" />
      <div className="toolbar-actions">
        <SyncStatus state={syncState} />
        <HistoryMenu currentCode={cert.code} onOpen={onOpen} />
        {canUndo && (
          <button type="button" className="toolbar-btn toolbar-btn--ghost" onClick={onUndo}>
            Deshacer
          </button>
        )}
        <button type="button" className="toolbar-btn toolbar-btn--ghost" onClick={onNew}>
          Nuevo
        </button>
        <button type="button" className="toolbar-btn" onClick={() => window.print()}>
          Imprimir / PDF
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Real `src/CertificateEditor.tsx`**

```tsx
import { useCertificateStore } from './lib/store'
import { Certificate } from './components/Certificate'
import { Toolbar } from './components/Toolbar'

export default function CertificateEditor({ onAuthExpired }: { onAuthExpired: () => void }) {
  const { cert, setCert, reset, undo, canUndo, loadCertificate, syncState, booting } = useCertificateStore(onAuthExpired)

  if (booting) return <div className="boot-screen">Cargando…</div>

  return (
    <div className="editor-shell">
      <Toolbar cert={cert} syncState={syncState} canUndo={canUndo} onNew={reset} onUndo={undo} onOpen={loadCertificate} />
      <Certificate cert={cert} onChange={(patch) => setCert((c) => ({ ...c, ...patch }))} />
    </div>
  )
}
```

Update `App.tsx` (Task 9) — it already imports `CertificateEditor` and
passes `onAuthExpired`, no change needed there.

- [ ] **Step 5: Append toolbar/history/sync CSS to `src/index.css`**

```css
.editor-shell{ min-height:100vh; }
.toolbar{
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 28px; background:var(--ink); position:sticky; top:0; z-index:10;
}
.toolbar-actions{ display:flex; align-items:center; gap:12px; }
.toolbar-btn--ghost{ background:transparent; color:var(--paper); border:1px solid var(--steel-body); }
.sync-status{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--steel-light); }
.sync-status--offline, .sync-status--error{ color:#E2723D; }
.history-menu{ position:relative; }
.history-dropdown{
  position:absolute; top:calc(100% + 8px); right:0; width:280px; max-height:360px; overflow-y:auto;
  background:var(--ink-soft); border:1px solid var(--steel-body); border-radius:4px; padding:6px; z-index:20;
}
.history-empty{ color:var(--steel-light); font-size:12px; padding:12px; margin:0; }
.history-item{ display:flex; align-items:center; gap:6px; padding:4px; border-radius:3px; }
.history-item.is-current{ background:rgba(255,255,255,0.06); }
.history-item-open{ flex:1; text-align:left; background:none; border:none; cursor:pointer; padding:6px; color:var(--paper); }
.history-item-code{ font-family:'IBM Plex Mono',monospace; font-size:11px; margin:0; color:var(--paper); }
.history-item-tag{ color:var(--steel-light); }
.history-item-client, .history-item-date{ font-size:10px; color:var(--steel-light); margin:2px 0 0; }
.history-item-remove{ background:none; border:none; color:var(--steel-light); cursor:pointer; font-size:14px; padding:6px; }

@media print{ .toolbar{ display:none; } }
```

- [ ] **Step 6: Full local end-to-end pass**

```bash
cd /home/meraki/altotest/altotest-documentos && npm run dev &
cd /home/meraki/altotest/digital_certificate && npm run dev &
sleep 2
```

Open `http://localhost:5220`, log in, edit a few fields (client name, add a
standard chip, remove one), click "Historial" (expect the just-saved
certificate to appear after the 3s autosave debounce), click "Nuevo",
confirm "Deshacer" brings back the previous certificate.

```bash
kill %1 %2
```

- [ ] **Step 7: Full verification suite**

```bash
cd /home/meraki/altotest/digital_certificate
npx tsc -b
npx oxlint
npm run build
```

Expected: all three clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Wire Toolbar/HistoryMenu/SyncStatus into a working CertificateEditor"
```

---

## Phase 4 — Public verification page (`site/`)

### Task 15: Verification client and page

**Files:**
- Create: `site/src/lib/verify.ts`
- Create: `site/src/pages/Verify.tsx`
- Modify: `site/src/App.tsx`

**Interfaces:**
- Produces: `fetchVerification(code: string)`, route `/verifica/:folio` and
  `/verifica` (no folio, manual input).

- [ ] **Step 1: `src/lib/verify.ts`**

```ts
const BASE_URL = import.meta.env.VITE_REPORTS_ENDPOINT

// Duplicado a propósito, mismo criterio que la validación del formulario de
// contacto de este sitio (ver CLAUDE.md, "Validación duplicada a
// propósito"): el Worker nunca calcula vigente/vencido (no interpreta
// `doc`), así que quien lo necesita lo calcula acá con los mismos nombres
// de campo que usa digital_certificate/src/types.ts (CertificateState).
function parseDdMmAaaa(value: string): Date | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
  if (!m) return null
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
}

export interface CertificateDoc {
  clientName: string
  clientAsset: string
  address: string
  certificationDate: string
  expirationDate: string
  deviceType: string
  installedCount: number
  certifiedCount: number
  standards: string[]
}

export interface VerificationResult {
  found: true
  code: string
  updatedAt: number
  doc: CertificateDoc
  valid: boolean
}

export interface VerificationNotFound {
  found: false
}

export async function fetchVerification(code: string): Promise<VerificationResult | VerificationNotFound> {
  const res = await fetch(`${BASE_URL}/verify/certificado/${encodeURIComponent(code)}`)
  if (!res.ok) return { found: false }
  const envelope = (await res.json()) as { code: string; updatedAt: number; doc: CertificateDoc }
  const expiration = parseDdMmAaaa(envelope.doc.expirationDate)
  const valid = expiration !== null && new Date() <= expiration
  return { found: true, code: envelope.code, updatedAt: envelope.updatedAt, doc: envelope.doc, valid }
}
```

`VITE_REPORTS_ENDPOINT` needs to be added to `site/.env` /
`site/.env.example` — same variable name and same URL
(`https://altotest-documentos.altotest.workers.dev` in production) already
used by the other 3 apps.

- [ ] **Step 2: `src/pages/Verify.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchVerification, type VerificationResult, type VerificationNotFound } from '../lib/verify'

export default function Verify() {
  const { folio } = useParams()
  const navigate = useNavigate()
  const [input, setInput] = useState(folio ?? '')
  const [result, setResult] = useState<VerificationResult | VerificationNotFound | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!folio) return
    setLoading(true)
    fetchVerification(folio)
      .then(setResult)
      .finally(() => setLoading(false))
  }, [folio])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (input.trim()) navigate(`/verifica/${encodeURIComponent(input.trim())}`)
  }

  return (
    <section className="verify-page">
      <h1>Revisa tu certificado</h1>
      <p className="verify-hint">Escribe el folio impreso en el certificado, o escanea su código QR.</p>
      <form onSubmit={handleSubmit} className="verify-form">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="CPA-20260921-101532" />
        <button type="submit">Verificar</button>
      </form>

      {loading && <p>Buscando…</p>}

      {result && !result.found && <p className="verify-not-found">No encontramos ningún certificado con ese folio.</p>}

      {result && result.found && (
        <div className={`verify-result ${result.valid ? 'is-valid' : 'is-expired'}`}>
          <p className="verify-status">{result.valid ? 'Certificado vigente' : 'Certificado vencido'}</p>
          <dl>
            <div>
              <dt>Folio</dt>
              <dd>{result.code}</dd>
            </div>
            <div>
              <dt>Cliente</dt>
              <dd>{result.doc.clientName}</dd>
            </div>
            <div>
              <dt>Recinto</dt>
              <dd>{result.doc.clientAsset}</dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{result.doc.address}</dd>
            </div>
            <div>
              <dt>Vigencia</dt>
              <dd>
                {result.doc.certificationDate} — {result.doc.expirationDate}
              </dd>
            </div>
            <div>
              <dt>Cantidad certificada</dt>
              <dd>{result.doc.certifiedCount}</dd>
            </div>
            <div>
              <dt>Normas aplicables</dt>
              <dd>{result.doc.standards.join(' · ')}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  )
}
```

Styling is intentionally left minimal/unstyled-structural in this task —
follow `site/`'s own design tokens (`@theme` in `src/index.css`) and the
`artifact-design`/site conventions (IBM Plex, paper/ink/steel palette,
`signal` used sparingly) when polishing, matching how every other page on
that site looks; this task's job is correct data wiring, not final visual
design.

- [ ] **Step 3: Wire the route in `src/App.tsx`**

```tsx
// existing imports...
import Verify from './pages/Verify'

// inside <Routes>, alongside the existing <Route path="/" .../> and catch-all:
<Route path="/verifica/:folio" element={<Verify />} />
<Route path="/verifica" element={<Verify />} />
```

- [ ] **Step 4: Verify against the local Worker**

```bash
cd /home/meraki/altotest/altotest-documentos && npm run dev &
sleep 2
curl -s -X PUT http://localhost:8787/reports/certificado/CPA-VERIFYTEST \
  -H "Authorization: Bearer 1234" -H "Content-Type: application/json" \
  -d '{"code":"CPA-VERIFYTEST","client":"Cliente Demo","date":"21-09-2026","doc":{"clientName":"Cliente Demo","clientAsset":"Edificio Demo","address":"Calle Falsa 123","certificationDate":"21-09-2026","expirationDate":"21-09-2027","deviceType":"Tipo A","installedCount":10,"certifiedCount":10,"standards":["EN 795:2012"]}}'

cd /home/meraki/altotest/site
echo "VITE_REPORTS_ENDPOINT=http://localhost:8787" >> .env
npm run dev &
sleep 2
```

Open `http://localhost:5173/verifica/CPA-VERIFYTEST` (or whatever port
`site/` uses — check its `vite.config.ts`). Expected: "Certificado vigente",
with the seeded fields shown. Also try `/verifica/DOES-NOT-EXIST` → expect
the not-found message, and `/verifica` with no folio → expect the empty
input form.

```bash
kill %1 %2
```

- [ ] **Step 5: Type-check and build**

```bash
cd /home/meraki/altotest/site
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

Expected: both clean.

- [ ] **Step 6: Commit**

```bash
cd /home/meraki/altotest/site
git add -A
git commit -m "Add public certificate verification page (/verifica/:folio)

Fetches the new unauthenticated /verify endpoint on altotest-documentos
and computes vigente/vencido here, since the Worker deliberately never
interprets doc's internal shape."
```

---

## Phase 5 — Deployment

### Task 16: Deploy `digital_certificate/` and confirm `site/`'s redeploy picks up `/verifica`

- [ ] **Step 1: Push `digital_certificate/` to a new GitHub repo (same pattern as the 3 siblings)**

```bash
cd /home/meraki/altotest/digital_certificate
gh repo create Alto-Test-Spa/anchor-point-certificate --private --source=. --remote=origin
git push -u origin master
```

- [ ] **Step 2: Import into a new Vercel project (manual step, same as the siblings)**

In the Vercel dashboard: New Project → import
`Alto-Test-Spa/anchor-point-certificate` → Framework Preset: Vite → add
environment variable `VITE_REPORTS_ENDPOINT` =
`https://altotest-documentos.altotest.workers.dev` → Deploy.

- [ ] **Step 3: Confirm the live deploy**

Open the deployed URL, log in with the real 4-digit access key, confirm a
save round-trips (create a test certificate, refresh, confirm it's still
there via History).

- [ ] **Step 4: Push `altotest-documentos/` to its own GitHub repo (documentation/backup — Cloudflare deploy already happened in Task 3, this is just so the source isn't only local)**

```bash
cd /home/meraki/altotest/altotest-documentos
gh repo create Alto-Test-Spa/documentos-worker --private --source=. --remote=origin
git push -u origin master
```

- [ ] **Step 5: Push `site/`'s new commit and confirm its existing Vercel project redeploys with the new route**

```bash
cd /home/meraki/altotest/site
git push
```

Wait for the Vercel deploy triggered by the push, then open
`https://altotest.cl/verifica` (or whatever the current preview/production
URL is — check `site/CLAUDE.md`, "DNS y hosting" for the real current state,
it noted the domain might still be serving an old site as of this plan's
writing) and confirm the page loads.

- [ ] **Step 6: Final cross-project smoke test**

Generate one real certificate in `digital_certificate`, scan its printed QR
(or copy the URL it encodes) with a phone, confirm it opens
`altotest.cl/verifica/<folio>` and shows "Certificado vigente" with the
right data.

---

## Self-Review Notes

- **Spec coverage:** every section of
  `2026-09-21-certificado-anclaje-design.md` maps to a task — §1 (data
  model, standards-as-chips) → Tasks 5–6, 11; §2 (Worker extraction) → Tasks
  1–3; §3 (QR + verification) → Tasks 13, 15; §4 (internal access) → Task 9;
  §5 (visual design) → Tasks 9–13; §6 (deployment) → Task 16.
- **Type consistency checked:** `CertificateState` (Task 5) field names are
  used identically in `template.ts` (6), `api.ts` (7), `store.ts` (8),
  `Certificate.tsx` (11), and independently redeclared (on purpose, see Task
  15's own comment) as `CertificateDoc` in `site/src/lib/verify.ts` — kept
  in sync by field name, not by importing across repos (there is no shared
  package between `digital_certificate` and `site`).
- **Known gap carried forward from the spec, not silently dropped:** the
  vendored-worker risk is fixed for the 3 *existing* sibling repos and this
  new one, but nothing technically stops a fifth future project from
  vendoring its own copy again — the real guardrail is that
  `altotest-documentos/` is now the only repo with `src/index.ts` in it, so
  there's nothing left to copy from by accident.
