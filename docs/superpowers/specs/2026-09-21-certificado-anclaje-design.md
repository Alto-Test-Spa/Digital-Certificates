# Diseño: Certificado de Puntos de Anclaje + Worker compartido único

Fecha: 2026-09-21. Aprobado en conversación con Matías (Alto Test).

## Qué es

Nueva app (`digital_certificate/`, este repo) que genera el **Certificado de
Puntos de Anclaje** — a nivel de **lote/proyecto** (un certificado cubre N
anclajes de un mismo recinto, con resumen agregado, no una fila por anclaje),
siguiendo el mismo patrón de familia que `informes/informe_levantamiento` y
`venta/propuesta_tecnica_react`/`propuesta_economica_react`.

Referencia de contenido (no de diseño): `certificado_pa_2026_01_14_14_45.pdf`
en esta misma carpeta (gitignored, sólo local) — certificado real de Vertical
SPA, de ahí salieron los campos reales (cantidad instalada/certificada, tipo
de anclaje, normas citadas, código de verificación). El diseño visual es 100%
de Alto Test, ya aprobado como mockup HTML/CSS/SVG — ver "Diseño visual"
abajo.

Este proyecto además dispara un cambio de arquitectura que afecta a los 3
proyectos hermanos ya en producción: extraer el Worker compartido a su propio
proyecto (ver sección 2).

## 1. Alcance funcional del certificado

- **Un certificado = un lote/proyecto**, no un anclaje individual. Resumen
  agregado (cantidad instalada, cantidad certificada, ficha técnica del tipo
  de dispositivo usado), sin tabla de desglose por anclaje.
- **Normas aplicables como chips editables por certificado** — no hardcodear
  un set fijo. El PDF de referencia de Vertical cita EN 795:2012/ANSI
  Z395/NCh-ISO 14.567:2016; el mockup usó un set distinto (EN 795, BS 8610,
  ACI 355.2/355.4, ISO 22846-2). Ambos son válidos según el proyecto — el
  usuario elige cuáles chips aplican al certificar.
- **Folio**: `CPA-aaaammdd-hhmmss`, mismo criterio que `IL-`/`PT-`/`COT-` de
  los hermanos. Es también la llave primaria en KV.
- **Vigencia**: 1 año calendario desde la fecha de certificación (fecha de
  vencimiento calculada por defecto, editable).

### Modelo de datos (`CertificateState`, borrador — se cierra en el plan de implementación)

```ts
interface CertificateState {
  code: string              // folio CPA-aaaammdd-hhmmss
  client: string            // empresa/cliente (para el sobre del Worker)
  clientRut: string
  asset: string              // recinto/edificio/proyecto
  address: string             // dirección completa
  certificationDate: string    // dd-mm-aaaa
  expirationDate: string        // dd-mm-aaaa, calculada +1 año, editable
  deviceType: string              // "Tipo A — anclaje estructural fijo"
  substrate: string                 // "Hormigón armado"
  materiality: string                 // "Acero inoxidable A4"
  verificationTest: string              // "Pull-Out — tracción estática"
  testLoad: string                        // "12,5 kN" (valor representativo del lote)
  installedCount: number
  certifiedCount: number
  standards: string[]                       // chips, editable
  description: string                         // campo libre (antes "trazabilidad")
}
```

## 2. Worker: extraer a proyecto único (fix de raíz, no mitigación)

**Problema actual**: `worker/src/index.ts` está vendoreado (copiado) dentro
de `informe_levantamiento/`, `propuesta_tecnica_react/` y
`propuesta_economica_react/`, los tres apuntando al mismo Worker desplegado
(`altotest-documentos`, mismo `wrangler.jsonc`/KV en las tres copias). Si se
agrega el endpoint público de verificación (ver sección 3) sólo en la copia
de `digital_certificate/`, un deploy futuro hecho desde cualquiera de las
otras tres copias — por un motivo no relacionado — pisaría el endpoint nuevo
sin que nadie lo note.

**Fix**: nuevo proyecto top-level `altotest-documentos/` (nombre = nombre del
Worker desplegado, sin ambigüedad), única fuente de verdad:

- Contiene `src/index.ts` + `wrangler.jsonc` (el `Env`, KV binding, lógica de
  `/reports/:kind` y `/reports/:kind/:code` ya existente, sin cambios de
  comportamiento) + el endpoint nuevo `/verify/:kind/:code` (sección 3).
- Es su propio repo git, con su propio `npm run deploy`.
- Los 3 proyectos hermanos **pierden su carpeta `worker/` local** — nunca
  tuvieron lógica propia ahí, sólo le hablan al Worker por HTTP vía
  `VITE_REPORTS_ENDPOINT` (`lib/api.ts` en cada uno), así que quitar la
  carpeta no cambia su comportamiento en absoluto.
- Se actualiza el `CLAUDE.md` de cada uno de los 3 hermanos: la sección
  "Arquitectura de datos"/"Despliegue" pasa a decir "el Worker vive en
  `altotest-documentos/` (repo propio), no acá" en vez de documentar un
  `worker/` que ya no existe.
- `digital_certificate/` (este proyecto) tampoco tiene copia propia — mismo
  criterio, sólo `VITE_REPORTS_ENDPOINT`.

Esto es un cambio de infraestructura compartida, no sólo del proyecto nuevo —
se hace ahora porque es la causa raíz señalada por Matías, no algo para
posponer con el riesgo documentado.

## 3. QR real + verificación pública

- El QR del mockup era decorativo (patrón de puntos falso). En la app real
  debe ser un QR **realmente escaneable**, generado con una librería real
  (a definir en el plan — ej. `qrcode`), nivel de corrección de errores alto
  (`H`, tolera ~30% de oclusión) para poder mantener el look aprobado ("ALTO
  TEST" en el centro, ojos circulares) sin romper el escaneo. Se verifica
  decodificando el QR generado (no sólo mirándolo), antes de dar el trabajo
  por bueno.
- El QR codifica una URL pública: `https://altotest.cl/verifica/:folio`.
- **Endpoint nuevo, público, sin `Authorization`**: `GET
  /verify/:kind/:code` en `altotest-documentos` — devuelve el documento
  (no hay nada confidencial en un certificado, a diferencia de los hallazgos
  de un informe) más un campo calculado `valid: boolean` (hoy ≤
  `expirationDate`). Vive aparte de `GET /reports/:kind/:code` (que sigue
  exigiendo Bearer, es el que usa el editor interno).
- **Página nueva en `site/`** (el sitio público de Alto Test, ya tiene
  `react-router-dom`): ruta `/verifica/:folio` (con input manual también,
  para quien llega sin folio en la URL). Llama al endpoint público de
  `altotest-documentos` y muestra estado (vigente/vencido/no encontrado) +
  los datos públicos del certificado, con el sistema de diseño ya existente
  de `site/`.

## 4. Herramienta interna (editor)

Mismo patrón que `informe_levantamiento`: `AccessGate` con la misma clave
compartida de 4 dígitos que ya usan los otros 3 documentos (Camilo no
aprende una clave nueva), autoguardado (debounce + guard de no-op, mismo
mecanismo ya calibrado contra la cuota free de KV) hacia
`PUT /reports/certificado/:code`, `HistoryMenu` sobre
`GET /reports/certificado`.

`kind = "certificado"` en la ruta.

## 5. Diseño visual

Ya aprobado como mockup HTML/CSS/SVG (Artifact
`https://claude.ai/artifact/YV1N9ihezHQnLs8hV9iVvy`): marco cóncavo
(`clip-path: path(...)`), torre como watermark de fondo, wordmark
manual-accurate (círculos simples en los extremos de la catenaria, IBM Plex
Mono 500, tracking -0.04em), card de "Validación" con timbre institucional +
QR. Se lleva 1:1 a componentes React, reutilizando `Wordmark.tsx`/
`Logomark.tsx` **canónicos** de `site/src/components/ui/` (confirmados como
la fuente de verdad del manual de marca) en vez de la variante propia de
`informe_levantamiento` (glifo placa+perno, deliberadamente distinta).

Ajustes de contenido respecto al mockup (por el cambio a lote/proyecto):
- "Ubicación del punto" + "Placa N°" (campos de un anclaje individual) se
  reemplazan por Cantidad instalada/certificada + dirección del recinto.
- Chips de normas dejan de ser fijos, se editan por certificado.
- Texto de "Descripción" deja de decir "Certificado individual, trazable
  al..." (ya no aplica a un lote) — se redacta de nuevo en el plan.

## 6. Despliegue

- `altotest-documentos/` (Worker): `wrangler deploy`, cuenta Cloudflare de
  Alto Test, mismo KV namespace ya existente (no se crea uno nuevo).
- `digital_certificate/`: nuevo proyecto Vercel, mismo patrón que los 3
  hermanos.
- `site/`: se redespliega con el build normal (ya tiene su propio proyecto
  Vercel), sin cambios de infraestructura.

## Riesgos conocidos / fuera de alcance

- El endpoint público `/verify` devuelve el documento completo — si en el
  futuro se agrega un campo realmente sensible al modelo de certificado, hay
  que revisar qué expone antes de agregarlo, no asumir que todo campo nuevo
  es público por defecto.
- No se aborda en este spec: exclusión granular de campos, envío
  automático del certificado al cliente, ni checklist de emisión — el
  alcance es generar + certificar + verificar.
