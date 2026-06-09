// Small ComfyUI-logo button placed next to a text field. Clicking it opens the
// ComfyTextGenModal; the generated string is returned via onResult.
import { useState } from 'react'
import comfyLogo from '../../assets/comfyui.webp'
import ComfyTextGenModal from './ComfyTextGenModal'
import './ComfyTextButton.css'

export default function ComfyTextButton({ onResult, title = 'Generate text with ComfyUI', className = '' }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={`comfy-text-btn ${className}`.trim()}
        title={title}
        aria-label={title}
        onClick={() => setOpen(true)}
      >
        <img src={comfyLogo} alt="" className="comfy-text-btn__icon" />
      </button>

      <ComfyTextGenModal
        open={open}
        onClose={() => setOpen(false)}
        onResult={(text) => {
          onResult?.(text)
          setOpen(false)
        }}
      />
    </>
  )
}
