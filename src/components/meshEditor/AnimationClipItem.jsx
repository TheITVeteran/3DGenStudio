// One row in the Animations tab: an animation clip's mp4 preview (plays on hover)
// plus its name. Selecting it retargets + plays the clip on the user's mesh.
import { useRef, useState } from 'react'

export default function AnimationClipItem({ name, previewUrl, selected, busy, onSelect }) {
  const videoRef = useRef(null)
  const [failed, setFailed] = useState(false)

  const handleEnter = () => {
    const v = videoRef.current
    if (v) { v.currentTime = 0; v.play().catch(() => {}) }
  }
  const handleLeave = () => {
    const v = videoRef.current
    if (v) { v.pause(); v.currentTime = 0 }
  }

  return (
    <button
      type="button"
      className={`mesh-editor-anim-item ${selected ? 'mesh-editor-anim-item--selected' : ''}`}
      onClick={onSelect}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      title={`Play "${name}" on your mesh`}
    >
      <div className="mesh-editor-anim-item__thumb">
        {previewUrl && !failed ? (
          <video
            ref={videoRef}
            src={previewUrl}
            muted
            loop
            playsInline
            preload="none"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="material-symbols-outlined">movie</span>
        )}
        {busy && (
          <span className="material-symbols-outlined mesh-editor-anim-item__spinner">progress_activity</span>
        )}
        {selected && !busy && (
          <span className="material-symbols-outlined mesh-editor-anim-item__playing">play_arrow</span>
        )}
      </div>
      <span className="mesh-editor-anim-item__name">{name}</span>
    </button>
  )
}
