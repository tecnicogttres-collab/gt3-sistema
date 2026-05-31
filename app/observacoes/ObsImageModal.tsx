'use client'

const BORDER = '#E2E8F0'
const MUTED = '#6B7A99'
const INK = '#1E253D'

type Props = {
  preview: string
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
}

export function ObsImageModal({ preview, onFileSelect, onRemove }: Props) {
  if (preview) {
    return (
      <div>
        <img
          src={preview}
          alt=""
          style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 8, border: `1px solid ${BORDER}`, display: 'block', marginBottom: 6 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <label style={{
            padding: '4px 10px', borderRadius: 6, border: `1px solid ${BORDER}`,
            background: '#F0F4FA', color: INK, fontSize: 12, cursor: 'pointer', fontWeight: 500,
          }}>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileSelect} />
            Trocar
          </label>
          <button
            onClick={onRemove}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5',
              background: '#FEF2F2', color: '#DC2626', fontSize: 12, cursor: 'pointer', fontWeight: 500,
            }}
          >
            Remover
          </button>
        </div>
      </div>
    )
  }

  return (
    <label style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '16px 12px', border: `2px dashed ${BORDER}`, borderRadius: 8,
      cursor: 'pointer', color: MUTED, fontSize: 12, transition: 'border-color 0.15s',
    }}>
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileSelect} />
      <span style={{ fontSize: 22 }}>🖼</span>
      <span>Clique para adicionar uma imagem</span>
    </label>
  )
}
