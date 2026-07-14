// Bone-mapping popup for the Auto Rig → Animations flow. Maps the reference
// animation skeleton's bones (source, left column) onto the user's rigged mesh
// bones (target, right column) so clips can be retargeted. Mirrors the
// mesh2motion mapping UI: drag a source bone onto a target row, or click a
// source then a target. Auto-Map fills the mapping heuristically.
import { useEffect, useMemo, useState } from 'react'

export default function BoneMappingModal({
  referenceLabel,
  sourceBones,
  targetBones,
  initialMapping,
  onAutoMap,
  onSave,
  onClose,
}) {
  const [mapping, setMapping] = useState(() => ({ ...(initialMapping || {}) }))
  const [sourceFilter, setSourceFilter] = useState('')
  const [targetFilter, setTargetFilter] = useState('')
  const [pickedSource, setPickedSource] = useState(null)
  const [dragSource, setDragSource] = useState(null)

  // Close on Escape.
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const mappedSources = useMemo(() => new Set(Object.values(mapping)), [mapping])
  const mappedCount = Object.keys(mapping).length

  const filteredSources = useMemo(
    () => sourceBones.filter(n => n.toLowerCase().includes(sourceFilter.trim().toLowerCase())),
    [sourceBones, sourceFilter],
  )
  const filteredTargets = useMemo(
    () => targetBones.filter(n => n.toLowerCase().includes(targetFilter.trim().toLowerCase())),
    [targetBones, targetFilter],
  )

  const assign = (targetName, sourceName) => {
    setMapping(prev => {
      const next = { ...prev }
      // A source bone maps to at most one target — remove any prior use.
      for (const t of Object.keys(next)) if (next[t] === sourceName) delete next[t]
      next[targetName] = sourceName
      return next
    })
    setPickedSource(null)
  }

  const clearTarget = targetName => {
    setMapping(prev => {
      const next = { ...prev }
      delete next[targetName]
      return next
    })
  }

  const handleTargetClick = targetName => {
    if (pickedSource) assign(targetName, pickedSource)
  }

  const handleDrop = targetName => {
    if (dragSource) assign(targetName, dragSource)
    setDragSource(null)
  }

  return (
    <div className="mesh-editor-bonemap__overlay" onClick={onClose}>
      <div className="mesh-editor-bonemap" onClick={e => e.stopPropagation()}>
        <div className="mesh-editor-bonemap__header">
          <div>
            <h2 className="mesh-editor-bonemap__title">Map bones — {referenceLabel}</h2>
            <p className="mesh-editor-bonemap__subtitle">
              Assign each animation (source) bone to a bone on your mesh (target). Drag a source
              bone onto a target, or click a source then a target. {mappedCount} mapped.
            </p>
          </div>
          <button type="button" className="mesh-editor-bonemap__close" onClick={onClose} title="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mesh-editor-bonemap__body">
          {/* SOURCE column */}
          <div className="mesh-editor-bonemap__col">
            <div className="mesh-editor-bonemap__col-head">
              <span className="mesh-editor-bonemap__col-title">Source · {referenceLabel}</span>
              <span className="mesh-editor-panel__hint">{sourceBones.length} bones</span>
            </div>
            <input
              className="mesh-editor-bonemap__filter"
              placeholder="Source bones filter"
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
            />
            <div className="mesh-editor-bonemap__list">
              {filteredSources.map(name => {
                const used = mappedSources.has(name)
                return (
                  <div
                    key={name}
                    className={`mesh-editor-bonemap__source ${pickedSource === name ? 'mesh-editor-bonemap__source--picked' : ''} ${used ? 'mesh-editor-bonemap__source--used' : ''}`}
                    draggable
                    onDragStart={() => setDragSource(name)}
                    onDragEnd={() => setDragSource(null)}
                    onClick={() => setPickedSource(pickedSource === name ? null : name)}
                    title={used ? `${name} (mapped)` : name}
                  >
                    <span className="material-symbols-outlined mesh-editor-bonemap__grip">drag_indicator</span>
                    <span className="mesh-editor-bonemap__source-name">{name}</span>
                    {used && <span className="material-symbols-outlined mesh-editor-bonemap__used-check">check</span>}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mesh-editor-bonemap__arrow">
            <span className="material-symbols-outlined">arrow_forward</span>
          </div>

          {/* TARGET column */}
          <div className="mesh-editor-bonemap__col">
            <div className="mesh-editor-bonemap__col-head">
              <span className="mesh-editor-bonemap__col-title">Target · your mesh</span>
              <div className="mesh-editor-bonemap__col-actions">
                <button type="button" className="mesh-editor-bonemap__mini-btn" onClick={() => setMapping(onAutoMap() || {})}>
                  Auto-Map
                </button>
                <button type="button" className="mesh-editor-bonemap__mini-btn" onClick={() => setMapping({})} disabled={!mappedCount}>
                  Clear
                </button>
              </div>
            </div>
            <input
              className="mesh-editor-bonemap__filter"
              placeholder="Target bones filter"
              value={targetFilter}
              onChange={e => setTargetFilter(e.target.value)}
            />
            <div className="mesh-editor-bonemap__list">
              {filteredTargets.map(name => {
                const src = mapping[name]
                return (
                  <div
                    key={name}
                    className={`mesh-editor-bonemap__target ${src ? 'mesh-editor-bonemap__target--mapped' : ''} ${pickedSource ? 'mesh-editor-bonemap__target--droppable' : ''}`}
                    onClick={() => handleTargetClick(name)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDrop(name)}
                  >
                    {src ? (
                      <span className="mesh-editor-bonemap__chip" title={src}>{src}</span>
                    ) : (
                      <span className="mesh-editor-bonemap__chip mesh-editor-bonemap__chip--empty">unmapped</span>
                    )}
                    <span className="mesh-editor-bonemap__target-name">{name}</span>
                    {src && (
                      <button
                        type="button"
                        className="mesh-editor-bonemap__clear-btn"
                        onClick={e => { e.stopPropagation(); clearTarget(name) }}
                        title="Clear mapping"
                      >
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mesh-editor-bonemap__footer">
          <span className="mesh-editor-panel__hint">{mappedCount} of {targetBones.length} target bones mapped</span>
          <div className="mesh-editor-bonemap__footer-actions">
            <button type="button" className="mesh-editor-btn mesh-editor-btn--ghost" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="mesh-editor-btn mesh-editor-btn--primary"
              onClick={() => onSave(mapping)}
              disabled={!mappedCount}
            >
              <span className="material-symbols-outlined">check</span>
              <span>Save mapping</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
