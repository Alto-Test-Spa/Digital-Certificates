import type { BatchItem, CertificateState } from '../types'
import { Wordmark } from './Wordmark'
import { StampSeal } from './StampSeal'
import { Qr } from './Qr'
import { EditableText } from './EditableText'
import towerSrc from '../assets/tower.svg'
import { useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'

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
  return <EditableText value={value} onChange={onChange} className="field-input no-print-chrome" style={style} />
}

// <input type="number"> no descarta un cero a la izquierda mientras se
// escribe ("06" queda tal cual en pantalla aunque Number("06") ya sea 6) —
// se fuerza a mano para que lo que se ve no diverja del dato (bug real
// reportado en vivo).
function parseCount(e: ChangeEvent<HTMLInputElement>): number {
  const stripped = e.target.value.replace(/^0+(?=\d)/, '')
  if (stripped !== e.target.value) e.target.value = stripped
  return stripped === '' ? 0 : Number(stripped)
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

  // installedCount/certifiedCount son derivados (mismo criterio que
  // `address`, ver setAddressPart más arriba) — se recalculan acá en cada
  // cambio a una fila y viajan igual al Worker/site, sin tocar su contrato.
  function setBatchItems(items: BatchItem[]) {
    onChange({
      batchItems: items,
      installedCount: items.reduce((sum, item) => sum + item.installedCount, 0),
      certifiedCount: items.reduce((sum, item) => sum + item.certifiedCount, 0),
    })
  }

  function updateBatchItem(index: number, patch: Partial<BatchItem>) {
    setBatchItems(cert.batchItems.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function addBatchItem() {
    setBatchItems([
      ...cert.batchItems,
      {
        deviceType: '',
        substrate: '',
        verificationTest: '',
        testLoad: '6 kN',
        installedCount: 0,
        certifiedCount: 0,
        extra: cert.extraSpecFields.map(() => ''),
      },
    ])
  }

  function removeBatchItem(index: number) {
    if (cert.batchItems.length <= 1) return // siempre al menos un tipo de anclaje
    setBatchItems(cert.batchItems.filter((_, i) => i !== index))
  }

  // Filas adicionales de la ficha técnica ("+ agregar propiedad") — simétrico
  // a agregar/quitar tipo de anclaje, pero como fila en vez de columna:
  // extraSpecFields[j] es la etiqueta compartida, item.extra[j] el valor de
  // esa fila para cada tipo/columna (mismo índice j en todas las filas).
  function addExtraField() {
    onChange({
      extraSpecFields: [...cert.extraSpecFields, ''],
      batchItems: cert.batchItems.map((item) => ({ ...item, extra: [...item.extra, ''] })),
    })
  }

  function removeExtraField(j: number) {
    onChange({
      extraSpecFields: cert.extraSpecFields.filter((_, k) => k !== j),
      batchItems: cert.batchItems.map((item) => ({ ...item, extra: item.extra.filter((_, k) => k !== j) })),
    })
  }

  function setExtraLabel(j: number, label: string) {
    onChange({ extraSpecFields: cert.extraSpecFields.map((l, k) => (k === j ? label : l)) })
  }

  function updateExtraValue(i: number, j: number, value: string) {
    setBatchItems(cert.batchItems.map((item, k) => (k === i ? { ...item, extra: item.extra.map((v, l) => (l === j ? value : v)) } : item)))
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
              DOCUMENTO N° <b>{cert.code}</b>
            </div>
          </header>

          <div className="title-block">
            <h1><Field value={cert.title} onChange={(v) => set('title', v)} /></h1>
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
                  <dt>Emitido</dt>
                  <dd><Field value={cert.certificationDate} onChange={(v) => set('certificationDate', v)} /></dd>
                </div>
                <div>
                  <dt>Válido hasta</dt>
                  <dd><Field value={cert.expirationDate} onChange={(v) => set('expirationDate', v)} /></dd>
                </div>
                <div className="span-2">
                  <dt>Vigencia</dt>
                  <dd className="muted">
                    <Field value={cert.validityNote} onChange={(v) => set('validityNote', v)} />
                  </dd>
                </div>
              </dl>

              <div className="spec-block">
                <table className="spec">
                  <caption>Ficha técnica del lote</caption>
                  <thead>
                    <tr>
                      <th />
                      {cert.batchItems.map((_, i) => (
                        <th key={i} className="spec-col-head">
                          {cert.batchItems.length > 1 && (
                            <button type="button" className="tag-remove no-print" onClick={() => removeBatchItem(i)} title="Quitar tipo">
                              ×
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Tipo / configuración de anclaje</td>
                      {cert.batchItems.map((item, i) => (
                        <td key={i}><Field value={item.deviceType} onChange={(v) => updateBatchItem(i, { deviceType: v })} /></td>
                      ))}
                    </tr>
                    <tr>
                      <td>Sustrato de fijación</td>
                      {cert.batchItems.map((item, i) => (
                        <td key={i}><Field value={item.substrate} onChange={(v) => updateBatchItem(i, { substrate: v })} /></td>
                      ))}
                    </tr>
                    <tr>
                      <td>Ensayo de verificación</td>
                      {cert.batchItems.map((item, i) => (
                        <td key={i}><Field value={item.verificationTest} onChange={(v) => updateBatchItem(i, { verificationTest: v })} /></td>
                      ))}
                    </tr>
                    <tr>
                      <td>Carga de ensayo aplicada</td>
                      {cert.batchItems.map((item, i) => (
                        <td key={i}>
                          <span className="print-only">{item.testLoad}</span>
                          <select
                            className="blend-select no-print"
                            value={item.testLoad}
                            onChange={(e) => updateBatchItem(i, { testLoad: e.target.value })}
                          >
                            <option value="6 kN">6 kN</option>
                            <option value="12 kN">12 kN</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td><Field value={cert.installedCountLabel} onChange={(v) => set('installedCountLabel', v)} /></td>
                      {cert.batchItems.map((item, i) => (
                        <td key={i}>
                          <input
                            className="field-input"
                            type="number"
                            value={item.installedCount}
                            onChange={(e) => updateBatchItem(i, { installedCount: parseCount(e) })}
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td><Field value={cert.certifiedCountLabel} onChange={(v) => set('certifiedCountLabel', v)} /></td>
                      {cert.batchItems.map((item, i) => (
                        <td key={i}>
                          <input
                            className="field-input"
                            type="number"
                            value={item.certifiedCount}
                            onChange={(e) => updateBatchItem(i, { certifiedCount: parseCount(e) })}
                          />
                        </td>
                      ))}
                    </tr>
                    {cert.extraSpecFields.map((label, j) => (
                      <tr key={`extra-${j}`}>
                        <td>
                          <span className="spec-extra-label">
                            <Field value={label} onChange={(v) => setExtraLabel(j, v)} style={{ display: 'inline', width: 'auto' }} />
                            <button type="button" className="tag-remove no-print" onClick={() => removeExtraField(j)} title="Quitar propiedad">
                              ×
                            </button>
                          </span>
                        </td>
                        {cert.batchItems.map((item, i) => (
                          <td key={i}><Field value={item.extra[j] ?? ''} onChange={(v) => updateExtraValue(i, j, v)} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="batch-add-row">
                  <button type="button" className="tag-add-input no-print batch-add" onClick={addBatchItem}>
                    + agregar tipo de anclaje
                  </button>
                  <button type="button" className="tag-add-input no-print batch-add" onClick={addExtraField}>
                    + agregar propiedad
                  </button>
                </div>
              </div>

              <div>
                <p className="stamp-label">Normativa y referencias técnicas</p>
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
            <span className="fl">ALTO TEST · PUNTOS DE ANCLAJE</span>
            <span className="fr">{cert.code}</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
