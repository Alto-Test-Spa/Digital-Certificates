import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ElementType, KeyboardEvent } from 'react'

interface Props {
  value: string
  onChange: (valor: string) => void
  placeholder?: string
  className?: string
  style?: CSSProperties
  as?: ElementType
}

// Campo de una sola idea (título, etiqueta, nombre de campo): sin Enter, sin formato.
// El valor se guarda al perder el foco, no en cada tecla, para no pelear con el cursor.
// Portado de informe_levantamiento/src/components/EditableText.tsx — mismo criterio
// en toda la familia de apps: un <input> de una sola línea no ajusta texto largo,
// se corta o hace scroll horizontal; contentEditable + overflow-wrap ajusta de verdad.
export function EditableText({ value, onChange, placeholder, className, style, as: Tag = 'span' }: Props) {
  const ref = useRef<HTMLElement>(null)

  // useLayoutEffect, no useEffect — escribe el DOM antes del paint, mismo motivo
  // que el original: evita que una medición de layout atrape el campo vacío.
  useLayoutEffect(() => {
    const el = ref.current
    if (el && el.textContent !== value) el.textContent = value
  }, [value])

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter') e.preventDefault()
  }

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-ph={placeholder}
      className={`editable ${className ?? ''}`}
      style={style}
      onKeyDown={onKeyDown}
      onBlur={() => onChange(ref.current?.textContent?.trim() ?? '')}
    />
  )
}
