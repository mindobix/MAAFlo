import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  title:    string
  onClose:  () => void
  children: ReactNode
  footer?:  ReactNode
}

export default function Modal({ title, onClose, children, footer }: Props) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
