import type { CertificateState } from '../types'
import { Wordmark } from './Wordmark'
import { StampSeal } from './StampSeal'
import { Qr } from './Qr'
import { EditableText } from './EditableText'
import { REGIONES } from '../lib/regiones'
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
  return <EditableText value={value} onChange={onChange} className="field-input no-print-chrome" style={style} />
}

export function Certificate({ cert, onChange }: Props) {
  const [newStandard, setNewStandard] = useState('')

  function set<K extends keyof CertificateState>(key: K, value: CertificateState[K]) {
    onChange({ [key]: value } as Partial<CertificateState>)
  }

  // `address` es el único campo que viaja al Worker/site (ver types.ts) —
  // se recalcula acá en cada cambio de calle/comuna/región para que
  // siempre quede en sync, sin tocar site/ ni el Worker.
  function setAddressPart(patch: Partial<Pick<CertificateState, 'street' | 'region' | 'comuna'>>) {
    const street = patch.street ?? cert.street
    const region = patch.region ?? cert.region
    const comuna = patch.comuna ?? cert.comuna
    onChange({ ...patch, address: [street, comuna, region].filter(Boolean).join(', ') })
  }

  function handleRegionChange(region: string) {
    const comunas = REGIONES.find((r) => r.region === region)?.comunas ?? []
    setAddressPart({ region, comuna: comunas.includes(cert.comuna) ? cert.comuna : '' })
  }

  const comunasDeLaRegion = REGIONES.find((r) => r.region === cert.region)?.comunas ?? []
  const addressSuffix = [cert.comuna, cert.region].filter(Boolean).join(', ')

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
                  <dd>
                    <span>
                      <Field
                        value={cert.street}
                        onChange={(v) => setAddressPart({ street: v })}
                        style={{ display: 'inline', width: 'auto' }}
                      />
                      {addressSuffix && `, ${addressSuffix}`}
                    </span>
                    <div className="address-selects no-print">
                      <select value={cert.region} onChange={(e) => handleRegionChange(e.target.value)}>
                        <option value="" disabled>
                          Región…
                        </option>
                        {REGIONES.map((r) => (
                          <option key={r.region} value={r.region}>
                            {r.region}
                          </option>
                        ))}
                      </select>
                      <select
                        value={cert.comuna}
                        onChange={(e) => setAddressPart({ comuna: e.target.value })}
                        disabled={!cert.region}
                      >
                        <option value="" disabled>
                          Comuna…
                        </option>
                        {comunasDeLaRegion.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </dd>
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
                    <Field value={cert.validityNote} onChange={(v) => set('validityNote', v)} />
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
                    <td className="field">Carga de ensayo aplicada</td>
                    <td className="value"><Field value={cert.testLoad} onChange={(v) => set('testLoad', v)} /></td>
                  </tr>
                </tbody>
              </table>

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
