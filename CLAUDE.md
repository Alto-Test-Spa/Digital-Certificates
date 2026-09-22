# CLAUDE.md — Certificado de Punto de Anclaje (Alto Test)

Contexto para retomar este proyecto sin releer todo el chat. Aquí están las
**decisiones y las trampas**, no un tutorial de React. Cuarto miembro de la
familia de generadores de documentos de Alto Test — mismas convenciones de
fondo que `../informes/informe_levantamiento/CLAUDE.md`,
`../venta/propuesta_tecnica_react/CLAUDE.md` y
`../venta/propuesta_economica_react/CLAUDE.md` (Vite+React+TS+Tailwind,
Worker+KV compartido, clave de equipo). Se construyó el 2026-09-21 vía
subagent-driven-development; el plan y el registro completo de tareas,
hallazgos y decisiones quedaron en
`.superpowers/sdd/2026-09-21-certificado-anclaje/` mientras se ejecutaba —
si esa carpeta ya no existe, este archivo es el resumen que sobrevive.

## Qué es

La app con la que Alto Test emite el **Certificado de Punto de Anclaje**
(folio `CPA-aaaammdd-hhmmss`, prefijo sin cambios — ver "Título y tipo de
documento" abajo) — el paso de "Certificación" del ciclo completo que
gestiona Alto Test (Diagnóstico → Diseño → Instalación → **Certificación**
→ Mantención). A diferencia de los informes/propuestas, este documento es
**de lote, no por anclaje individual**: un certificado cubre N anclajes de
un mismo recinto con un resumen agregado (cantidad instalada/ensayada,
ensayo representativo), no una fila por anclaje — decisión de la spec
original, ver `types.ts`.

**No es un solo tipo de documento fijo** (feedback de Camilo, CEO de Alto
Test, 2026-09-22, probando la app en vivo): la misma plantilla puede tomar
tres caminos — *Certificado de Conformidad Técnica de Instalación*,
*Certificado de Conformidad Técnica por Inspección y Verificación*, o
*Informe de Inspección y Ensayo de Comprobación* — por eso el título
principal y varias etiquetas dejaron de ser texto fijo. Ver "Título y tipo
de documento" más abajo.

Trae un **sello institucional dibujado con SVG/trigonometría** (no una
imagen) y un **QR real y escaneable** (no decorativo) que apunta a
`altotest.cl/verifica/<folio>` — la página pública de `site/` donde
cualquiera que reciba el certificado en papel puede confirmar que existe y
si sigue vigente, sin necesitar la clave de equipo. Ver "Verificación
pública" más abajo.

## Stack

Vite 8 + React 19 + TypeScript + Tailwind v4 (`@theme` en `src/index.css`,
sin config aparte) + `reicon-react` para íconos de la barra + `qrcode` para
generar la matriz del QR (el dibujo final es SVG propio, ver
`components/Qr.tsx`). Mismo Worker compartido que las 3 apps hermanas
(`../altotest-documentos/`, su propio proyecto — ver su CLAUDE.md).

```bash
npm run dev              # localhost:5220 (puerto fijo)
npm run build             # tsc -b && vite build
npm run lint                # oxlint

cd ../altotest-documentos && npm install    # proyecto aparte, instalar una vez
npm run dev                                  # wrangler dev, localhost:8787 — KV local simulado
                                              # clave local: ver .dev.vars (ACCESS_KEY=1234)
```

## Arquitectura

```
src/
  App.tsx                    portón de acceso: pide/verifica la clave contra el Worker,
                              sólo entonces monta CertificateEditor
  CertificateEditor.tsx        Toolbar + Certificate + sincroniza document.title con
                                el folio (nombre sugerido al guardar el PDF)
  index.css                    @theme (paleta Alto Test) + estilos de la UI del editor
                                (toolbar, historial, portón)
  certificate.css               SOLO el documento imprimible — paginación A4, marco,
                                 grilla de datos, ficha técnica, timbre, ver "Impresión"
  types.ts                      CertificateState — un solo objeto, autoguardado completo
  lib/
    template.ts                  initialTemplate() (datos de ejemplo reales, no
                                  inventados) + normalizeCertificate() (fusión
                                  retrocompatible, ver "Migración de campos nuevos")
    api.ts                        fetchCertificate/saveCertificate/listCertificates/
                                   deleteCertificate/verifyAccessKey — único lugar que
                                   le habla al Worker, con timeout de 15s en cada llamada
    store.ts                      useCertificateStore: autoguardado (debounce 3s + guard
                                   de no-op), mirror local, Nuevo/Deshacer — mismo patrón
                                   que informe_levantamiento
    code.ts                        generateCode() → CPA-aaaammdd-hhmmss, isValidCode()
    date.ts                        todayDate()/addOneYear() (dd-mm-aaaa, CON GUIONES —
                                    distinto del dd/mm/aaaa de informe_levantamiento, es
                                    del mockup aprobado, no un error) + isStillValid()
    regiones.ts                    REGIONES: 16 regiones oficiales de Chile (BCN) con
                                    sus 346 comunas, ver "Dirección" más abajo
  components/
    AccessGate.tsx, SyncStatus.tsx, HistoryMenu.tsx, Toolbar.tsx   UI no imprimible
    EditableText.tsx               contentEditable — ver "Campos editables"
    Certificate.tsx                 el documento completo, lo único que se imprime
    StampSeal.tsx                    sello institucional, ver "Timbre"
    Qr.tsx                           QR real, ver "QR"
    Logomark.tsx, Wordmark.tsx        marca — copiadas de site/, ver "Marca"
```

El Worker compartido (`altotest-documentos`) vive en `../altotest-documentos/`,
proyecto/repo aparte — esta app sólo le habla por HTTP vía
`VITE_REPORTS_ENDPOINT` (`lib/api.ts`). Nunca vendorear una copia local del
Worker acá: fue justamente el riesgo que motivó extraerlo de
`informe_levantamiento` el 2026-09-21 (tres copias vendoreadas podían
pisarse entre sí en un deploy) — ver ese CLAUDE.md, "Arquitectura de datos".

## Modelo de datos (`types.ts`)

```ts
interface CertificateState {
  code: string
  title: string          // título principal, 100% editable, ver "Título y tipo de documento"
  clientName: string
  clientRut: string
  clientAsset: string   // recinto/edificio/proyecto
  street: string        // calle y número, texto libre
  region: string        // nombre oficial completo, ver lib/regiones.ts
  comuna: string         // filtrada según `region`
  address: string         // DERIVADO de street+comuna+region, ver "Dirección"
  certificationDate: string  // dd-mm-aaaa
  expirationDate: string     // dd-mm-aaaa
  validityNote: string        // texto editable bajo "Vigencia"
  deviceType: string
  substrate: string
  materiality: string
  verificationTest: string
  testLoad: string
  installedCountLabel: string  // editable: "Cantidad instalada"/"inspeccionada"/"existente"/etc.
  installedCount: number
  certifiedCountLabel: string   // editable: "Cantidad ensayada"/etc.
  certifiedCount: number
  standards: string[]    // chips "normativa y referencias técnicas", editable
  description: string
}
```

Es también, literalmente, el objeto que viaja tal cual dentro de `doc` al
Worker (ver "Arquitectura de datos" abajo) y el que consume `site/src/lib/verify.ts`
como `CertificateDoc` (redeclarado ahí a propósito, no importado entre
repos — no hay paquete compartido entre `digital_certificate` y `site`).
Si se agrega un campo nuevo acá, hay que decidir a mano si `site/` también
necesita mostrarlo.

**Migración de campos nuevos, sin romper certificados viejos**
(`normalizeCertificate()`): nunca alcanza con `{ ...initialTemplate(),
...partial }` a secas si el campo nuevo reemplaza a otro que ya existía —
ver el caso real de `region`/`comuna` abajo. La regla general: si un campo
nuevo puede inferirse de uno viejo, hacerlo explícito en `normalizeCertificate()`
en vez de dejar que el merge por defecto lo rellene con el valor de ejemplo
de la plantilla.

## Título y tipo de documento (`Certificate.tsx`, `lib/template.ts`)

El H1 principal (antes fijo: "CERTIFICADO" / "DE PUNTOS DE ANCLAJE" en dos
líneas, con un eyebrow fijo "Certificación de dispositivo — EN 795:2012"
encima) es ahora **un solo campo 100% editable** (`title`), sin eyebrow.
Motivo: Alto Test usa esta misma plantilla para tres tipos de documento
distintos, con títulos que no comparten estructura de dos líneas:

- Certificado de Conformidad Técnica de Instalación (default de la
  plantilla, `initialTemplate()`)
- Certificado de Conformidad Técnica por Inspección y Verificación
- Informe de Inspección y Ensayo de Comprobación

`.title-block h1` bajó de 64px (pensado para la única palabra
"CERTIFICADO") a 38px con `line-height:1.15`, para que estas frases largas
quepan en 2-3 líneas sin desbordar la hoja A4.

**Lo que NO cambió, a propósito, porque no se pidió:** el prefijo de folio
sigue siendo `CPA-` (`lib/code.ts`) y el header dice "DOCUMENTO N°" (ver
abajo) en vez de derivar un prefijo distinto por tipo de documento — si en
algún momento hace falta que el folio también varíe según el camino
elegido, es un cambio a `generateCode()`/`isValidCode()`, no algo que
`title` ya resuelva.

**Otras etiquetas que pasaron de texto fijo a editable por la misma razón**
(un documento de "Inspección" no necesariamente tiene una "cantidad
certificada"): `installedCountLabel` (default "Cantidad instalada") y
`certifiedCountLabel` (default "Cantidad ensayada", antes "Cantidad
certificada" fijo) — el `<dt>` de esas dos filas ahora es un `Field`, igual
que cualquier otro campo editable del documento; el valor numérico sigue
siendo un `<input type="number">` sin cambios.

## Dirección: calle libre + Región/Comuna en cascada (`Certificate.tsx`, `lib/regiones.ts`)

Pedido explícito del usuario: la calle/número sigue como texto libre
(`street`, mismo patrón `EditableText` que el resto), pero Región y Comuna
pasaron de texto suelto a **selectores en cascada** — 16 regiones oficiales
de Chile (nombres completos según la Biblioteca del Congreso Nacional,
`"Región de..."`/`"Región del..."`/`"Región Metropolitana de Santiago"`) con
sus 346 comunas, filtradas según la región elegida (`lib/regiones.ts`).
Elegir una región cuya comuna actual no le pertenece limpia la comuna
(`handleRegionChange` en `Certificate.tsx`), para no dejar una combinación
inconsistente.

**`address` es un campo derivado, no editable directamente** — se recalcula
en cada cambio de `street`/`region`/`comuna` (`setAddressPart()`) como
`[street, comuna, region].filter(Boolean).join(', ')`. Sigue siendo el único
de los tres que viaja al Worker/`site` (ver "Modelo de datos"): así no hizo
falta tocar ni `altotest-documentos` ni `site/src/lib/verify.ts` para esta
feature — el contrato con ellos no cambió.

Los dos `<select>` llevan clase `.address-selects.no-print` — **nunca deben
imprimirse**, un `<select>` nativo no se puede "aplanar" visualmente como un
`EditableText` (ver "Campos editables"). Lo que se imprime es siempre el
texto plano compuesto: la calle vía `EditableText` (editable) seguida del
sufijo `", {comuna}, {región}"` como texto estático (no editable a mano,
sólo a través de los selectores).

**Certificados guardados antes de esta feature no se rompen**
(`normalizeCertificate()` en `template.ts`): si el documento no trae
`region`/`comuna` pero sí `address` (formato viejo), toda la dirección vieja
se mueve completa a `street` **sin pisarla** con el ejemplo de la plantilla,
y `region`/`comuna` quedan vacías (selectores en placeholder) para
completarse a mano. El merge ingenuo `{ ...initialTemplate(), ...partial }`
habría dejado `street`/`region`/`comuna` con los valores de ejemplo
(Las Condes / Región Metropolitana) mientras `address` seguía mostrando la
dirección real — inconsistencia silenciosa, evitada a propósito.

## Arquitectura de datos: Worker + KV compartido

Mismo Worker y mismo KV que `informe_levantamiento`, `propuesta_tecnica_react`
y `propuesta_economica_react` — ver el CLAUDE.md de cualquiera de los tres,
sección "Arquitectura de datos", para el contrato completo (`ReportEnvelope`,
endpoints, `INDEX_MAX_STALENESS_MS`, la cuota del free tier de KV compartida
entre las 4 apps) y el de `../altotest-documentos/CLAUDE.md` para el detalle
del propio Worker. Lo específico de esta app:

- `kind = "certificado"` (`lib/api.ts`, constante `KIND`) — parte de la ruta
  (`/reports/certificado/:code`), separa este espacio de nombres del resto
  dentro del mismo KV compartido.
- Usa además la ruta pública **`GET /verify/:kind/:code`** (sin
  `Authorization`), agregada al Worker específicamente para esta app — es la
  que consume `site/`'s página `/verifica`, ver "Verificación pública".
- El free tier de KV (1000 escrituras/día, **compartidas entre las 4 apps**,
  no por app) es la razón del debounce de 3s + guard de no-op en
  `store.ts`, heredado íntegro del patrón de las 3 apps hermanas —
  ver su CLAUDE.md para la historia completa (incluye un incidente real de
  cuota agotada el 2026-09-01).

**Timeout de 15s en todas las llamadas al Worker** (`lib/api.ts`,
`AbortSignal.timeout(15_000)`, en `request()` y en `verifyAccessKey()`) —
`fetch()` no tiene timeout propio: si la red falla de una forma que no
rechaza la promesa (se cae en silencio a mitad de camino, un proxy que no
responde), la llamada queda colgada para siempre y el autoguardado se ve
pegado en "Guardando…" sin ningún error. Bug real reportado en producción
(ver "Bugs ya cazados"); confirmado que **no existe todavía** en los 3
hermanos (gap heredado, no una regresión de ellos — vale la pena portarlo
si vuelve a pasar ahí).

## Acceso (`AccessGate.tsx`, `lib/api.ts`)

Misma clave compartida de equipo que el resto de la familia — no cuentas
por persona, ver el CLAUDE.md de cualquier hermano ("Acceso") para el
razonamiento completo (por qué clave corta, por qué CORS abierto, por qué
no es confidencialidad real frente a alguien con acceso legítimo que la
comparte).

## Sincronización (`lib/store.ts`, `SyncStatus.tsx`)

Mismo patrón que `informe_levantamiento`: debounce de 3s, guard de no-op
(`lastSavedRef` vs `JSON.stringify`), flush en `visibilitychange → hidden`,
mirror local de resiliencia (`localStorage`, nunca fuente de verdad), estado
visible `idle → saving → saved` / `offline` / `error`. Ver su CLAUDE.md,
"Sincronización", para el detalle completo de por qué cada pieza existe.

## Campos editables (`EditableText.tsx`)

Portado casi verbatim de `informe_levantamiento/src/components/EditableText.tsx`
(mismo `contentEditable` + `useLayoutEffect` + commit en `onBlur`, sin
formato ni párrafos — es el análogo de `EditableText`, no de `RichText`, acá
no hay campos largos con negrita/párrafos). Único agregado: un prop `style`
opcional, para los pocos campos que necesitan `display:inline` en vez de
`block` (ver `Field` en `Certificate.tsx`, usado para "Emitido" y para la
calle dentro de la línea de Dirección).

CSS: `.field-input` lleva `overflow-wrap: anywhere; word-break: break-word`
— sin esto, un texto largo sin espacios se sale de su columna en vez de
partirse (mismo bug/fix que ya habían resuelto los 3 hermanos; se portó acá
después de que el usuario lo reportara en vivo, ver "Bugs ya cazados").

## Timbre institucional (`StampSeal.tsx`)

Dibujado con SVG + trigonometría (no una imagen), portado del `<script>` del
mockup aprobado a JSX declarativo: dos arcos de texto curvo — "VALIDADO"
arriba, "PUNTOS DE ANCLAJE" abajo (antes decía "CERTIFICADO", cambiado a
pedido de Camilo el 2026-09-22 porque no todo lo que pasa por este sello es
un certificado) — sobre un anillo doble, con "ALTO TEST" centrado. Ya **no**
lleva "EN 795:2012" (se sacó por el mismo pedido, texto fijo genérico que no
aplica a los 3 tipos de documento) — `ALTO TEST` se recentró verticalmente
(`y={1.6}`, antes `y={-1}` cuando compartía el centro con una segunda línea
de texto debajo).

**`ringPath()`'s sweep-flag es el complemento de `sweep`, no `sweep` mismo**
(`d="... A ${R},${R} 0 0 ${1 - sweep} ..."`) — bug real de la especificación
original, encontrado en revisión: `sweep` elige el signo de `y` (mitad
arriba/abajo del anillo), pero según la parametrización endpoint-to-center
de un arco SVG, aterrizar el arco menor sobre ESTE MISMO anillo centrado en
el origen (y no sobre el otro círculo, descentrado, de igual radio que
también pasa por los mismos dos puntos) exige el sweep-flag opuesto al valor
de `sweep`. Verificado tres veces independientes antes de creerlo: render en
vivo, derivación analítica propia de la parametrización del arco, y
revertir-y-reproducir (se restauró el `${sweep}` literal en un cambio
descartable, se vio romperse en fragmentos ilegibles, se restauró el fix).
Si se vuelve a tocar esta geometría, no asumir que el signo "obvio" es el
correcto sin volver a derivarlo.

`side="right"` en el segundo `<textPath>` necesita `@ts-expect-error` — es
SVG2, todavía no está en los tipos de `@types/react` (confirmado contra la
versión instalada). Si una actualización de tipos lo agrega, `tsc -b`
fallará con un error de supresión innecesaria, señal de que hay que sacar
el comentario.

## QR real y escaneable (`Qr.tsx`)

**No es decorativo** — apunta a `https://altotest.cl/verifica/{cert.code}` y
tiene que decodificar de verdad con un lector real (verificado con `jsQR`
durante el build, no sólo "se ve como un QR"). Usa `qrcode` con
`errorCorrectionLevel: 'H'` (~30% recuperable) específicamente para poder
tapar el centro con "ALTO TEST" sin romper el escaneo — el tamaño del hueco
central (`logoRadius`) y el radio de cada punto (`r=0.46`, casi todo el
módulo) están calibrados contra ese margen de tolerancia, no elegidos por
estética a secas. Los "ojos" finder (las 3 esquinas) se calculan según la
posición real que exige la especificación QR (7 módulos, siempre en 3
esquinas fijas) y no una posición fija asumiendo un tamaño de matriz
21×21 — una URL más larga sube de versión y el finder se sigue dibujando
bien.

Si se cambia cualquier constante acá (radio del punto, tamaño del hueco del
logo), hay que volver a verificar con un decoder real, no asumir que "se ve
bien" implica que escanea.

## Verificación pública (`site/`, no este repo)

El QR y el folio impreso apuntan a `altotest.cl/verifica/<folio>` —
página pública de `../site/` (ver su CLAUDE.md, sección de verificación)
que consulta `GET /verify/certificado/:code` del Worker compartido **sin**
necesitar la clave de equipo, y calcula vigente/vencido del lado del
cliente con la MISMA semántica que `lib/date.ts`'s `isStillValid()`
(duplicado a propósito en `site/src/lib/verify.ts` — el Worker nunca
interpreta `doc`, así que quien necesita la lógica de vigencia la duplica,
mismo criterio que la validación del formulario de contacto de `site/`).
Si se cambia cómo se calcula vigente/vencido acá, hay que replicar el
cambio ahí a mano.

## Impresión (`certificate.css`, `Certificate.tsx`)

Documento a tamaño A4 real vía `@page{ size:A4; margin:0 }` + un `transform:
scale(0.881890)` sobre el diseño hecho a 900×1273px (proporción A4 exacta) —
ver el comentario al inicio de `certificate.css` para la cuenta completa.
`-webkit-print-color-adjust`/`print-color-adjust: exact` es la primera regla
del bloque `@media print` — sin esto Chromium no imprime los
`background-color` (el marco del certificado es enteramente fondo, sin
`border` real), y el PDF sale sin bordes. `document.title` se sincroniza con
`cert.code` (`CertificateEditor.tsx`) para que "Guardar como PDF" sugiera el
folio como nombre de archivo en vez de un título genérico.

**Esquina exterior cuadrada, curva sólo en el papel interior** (2026-09-22):
`.sheet` (el marco exterior, tinta) y `.sheet-inner` (el papel) tenían el
mismo `clip-path` con una curva cóncava en cada esquina. Al imprimir contra
una hoja A4 física real, la esquina cóncava del marco EXTERIOR deja un
espacio en blanco visible entre el borde real de la hoja y donde empieza la
tinta — confirmado con un PDF real impreso (Wondershare PDFelement), más
notorio de lo esperado en pantalla. Se quitó el `clip-path` de `.sheet` (pasa
a esquina recta, llena la hoja física completa); la curva decorativa queda
sólo en `.sheet-inner`. Si se vuelve a tocar la geometría de las esquinas,
probar con un PDF impreso de verdad, no sólo la vista de pantalla — la
diferencia entre ambas fue justamente lo que hizo notorio este bug.

## Marca (`Toolbar.tsx`, `Logomark.tsx`, `Wordmark.tsx`)

La barra de herramientas usa `Logomark` (isotipo chico, `tone="signal"`) +
texto "ALTO TEST" — igual que los 3 hermanos —, **no** `Wordmark` (texto +
curva combinados). `Logomark.tsx` es copia byte-a-byte de
`../site/src/components/ui/Logomark.tsx` (fuente canónica compartida),
deliberadamente NO la variante "AnchorPoint" que usa `informe_levantamiento`.
`Wordmark.tsx` sí se usa, pero sólo dentro del documento impreso
(`Certificate.tsx` header, `tone="ink"`) y en el portón de acceso
(`AccessGate.tsx`, `tone="signal"`) — dos lugares distintos, no confundir
con la barra.

Botones: `.toolbar-btn` (papel/tinta por defecto, se invierte a
naranjo/blanco en hover) y `.toolbar-btn--ghost` (transparente, borde sutil,
se resalta a naranjo en hover) — mismas clases que los 3 hermanos, valores
CSS copiados literal. Orden: Historial → Nuevo → Deshacer (condicional) →
Imprimir/PDF.

## Bugs ya cazados — no los repitas

| Síntoma | Causa / fix |
|---|---|
| Botón de acceso quedaba pegado en "Verificando…" para siempre si la verificación fallaba de cualquier forma que no fuera resolver a `false` | `AccessGate.tsx`'s `handleSubmit` no tenía `try/catch` alrededor del `await onSubmit(...)` — un `throw` (red caída, CORS, endpoint mal configurado) nunca llegaba a `setBusy(false)`. Fix: `try/catch/finally` alrededor de la llamada. |
| `SyncStatus` quedaba pegado en "Guardando…" para siempre en producción | `fetch()` no tiene timeout propio — una llamada que se cuelga en silencio (sin resolver ni rechazar) nunca llega al `catch` que setea `offline`/`error`. Fix: `AbortSignal.timeout(15_000)` en TODAS las llamadas del Worker (`lib/api.ts`). Ver "Arquitectura de datos" arriba — gap heredado, no está corregido todavía en los 3 hermanos. |
| Texto largo en un campo editable se salía de su columna en vez de partirse | Mismo bug que ya habían resuelto los hermanos: faltaba `overflow-wrap:anywhere; word-break:break-word` en `.field-input`. Se portó `EditableText.tsx` de `informe_levantamiento` en vez de seguir con `<input>` nativo. |
| Timbre (`StampSeal`) se veía con el texto curvo en fragmentos ilegibles | `ringPath()`'s sweep-flag literal (`${sweep}`) en vez de su complemento (`${1 - sweep}`) — ver "Timbre institucional" arriba para la derivación completa. |
| `tsc -b`/`npm run build` fallaba con `CertificateEditor` | El stub temporal del Task 9 (antes de que Task 14 lo reemplazara por el real) tomaba 0 props, pero `App.tsx` ya le pasaba `onAuthExpired` — el dev server (esbuild, sólo transpila) no lo detectaba, sólo un build real. Lección: verificar con `npm run build`, no sólo con el dev server, antes de dar una tarea por terminada. |
| `text-paper` (Tailwind) no generaba ninguna regla CSS, marca invisible en `AccessGate` | Los tokens de marca vivían sólo en `:root` plano, nunca registrados bajo el `@theme` de Tailwind v4 (a diferencia de `site/`'s propio `index.css`). Fix: un bloque `@theme` nuevo con alias `--color-*` en hex literal (no `var()`, por seguridad de build), sin renombrar los tokens de `:root` (ya había 49+ usos `var(--token)` en el plan). |
| PDF impreso sin bordes/fondos | Falta `print-color-adjust: exact` — el marco del certificado es 100% `background-color`, sin `border` real; sin esa regla Chromium no imprime fondos por defecto. |
| "Guardar como PDF" sugería un nombre de archivo genérico | `document.title` era estático. Fix: `useEffect` en `CertificateEditor.tsx` que lo sincroniza con `cert.code`. |
| Esquina cóncava del marco dejaba espacio en blanco visible en el PDF impreso contra el borde real de la hoja A4 | Ver "Impresión" arriba — el `clip-path` cóncavo estaba tanto en `.sheet` (exterior) como en `.sheet-inner` (papel); se quitó del exterior. |

## Verificación

```bash
npx tsc -b --noEmit    # frontend
npm run build            # catch-all antes de dar por terminado algo — el dev
                          # server (esbuild) no atrapa todos los errores de tipos
                          # que sí atrapa un build real, ver "CertificateEditor" arriba
```

No hay test suite. Para verificación visual, Playwright ad-hoc contra el dev
server local (clave de acceso local en `../altotest-documentos/.dev.vars`).

## Despliegue

Repo: `Alto-Test-Spa/Digital-Certificates` en GitHub, rama `main`. Deploy en
Vercel (Framework Preset: Vite), variable de entorno
`VITE_REPORTS_ENDPOINT = https://altotest-documentos.altotest.workers.dev`.
Un `VITE_*` faltante o mal escrito en Vercel no da error obvio: Vite lo deja
como `undefined` en el bundle, `fetch()` arma una URL relativa rota, y
recién se nota si el código que la consume no maneja bien el fallo (ver el
mismo problema real que ocurrió en `site/`'s página de verificación, su
CLAUDE.md).

## Pendientes

- El timeout de 15s en `lib/api.ts` es un gap real que **también existe sin
  corregir** en `informe_levantamiento`/`propuesta_tecnica_react`/
  `propuesta_economica_react` — portarlo ahí si vuelve a reportarse un
  guardado colgado en cualquiera de los tres.
- Ningún campo de fecha (`certificationDate`/`expirationDate`) tiene
  validación de formato en la UI todavía (a diferencia de
  `informe_levantamiento`'s `isValidDate`) — se editan como texto libre vía
  `EditableText`, confiando en que quien certifica escribe bien la fecha.
