import { useState } from 'react'
import FolderBrowserDialog from './FolderBrowserDialog'
import {
  EXPORT_FORMATS,
  exportObject3D,
  loadObject3DFromUrl,
  sanitizeBaseName,
  writeExportedFiles
} from '../utils/meshExport'
import './ExportMeshDialog.css'

// Reusable export popup. Provide either `getObject3D` (an async function that
// returns the in-memory THREE.Object3D to export) or `meshUrl` (a mesh URL the
// dialog loads itself). `defaultName` seeds the output file name.
export default function ExportMeshDialog({ getObject3D, meshUrl, defaultName = 'mesh', onClose }) {
  const [format, setFormat] = useState('glb')
  const [fileName, setFileName] = useState(sanitizeBaseName(defaultName))
  const [outputFolder, setOutputFolder] = useState('')
  const [showFolderBrowser, setShowFolderBrowser] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedFormat = EXPORT_FORMATS.find(entry => entry.value === format) || EXPORT_FORMATS[0]

  const handleExport = async () => {
    const folder = outputFolder.trim()
    const base = sanitizeBaseName(fileName)

    if (!folder) {
      setError('Choose an output folder first.')
      return
    }

    setExporting(true)
    setError('')
    setSuccess('')

    try {
      const object = getObject3D ? await getObject3D() : await loadObject3DFromUrl(meshUrl)
      if (!object) {
        throw new Error('No mesh is available to export.')
      }

      const files = await exportObject3D(object, { format, baseName: base })
      const result = await writeExportedFiles(folder, files)
      const writtenNames = (result?.written || files.map(file => file.filename)).join(', ')
      setSuccess(`Exported ${files.length} file${files.length === 1 ? '' : 's'}: ${writtenNames}`)
    } catch (err) {
      setError(err.message || 'Failed to export the mesh.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="export-mesh-overlay" role="presentation" onClick={onClose}>
      <div
        className="export-mesh"
        role="dialog"
        aria-modal="true"
        aria-label="Export mesh"
        onClick={event => event.stopPropagation()}
      >
        <div className="export-mesh__header">
          <h3 className="export-mesh__title font-headline">Export mesh</h3>
          <button type="button" className="export-mesh__close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="export-mesh__body">
          <label className="export-mesh__field">
            <span className="export-mesh__label">Format</span>
            <select
              className="export-mesh__select"
              value={format}
              onChange={event => { setFormat(event.target.value); setSuccess('') }}
            >
              {EXPORT_FORMATS.map(entry => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </label>

          <label className="export-mesh__field">
            <span className="export-mesh__label">File name</span>
            <div className="export-mesh__filename-row">
              <input
                className="export-mesh__input"
                value={fileName}
                onChange={event => setFileName(event.target.value)}
                spellCheck={false}
              />
              <span className="export-mesh__ext">.{selectedFormat.extension}</span>
            </div>
          </label>

          <label className="export-mesh__field">
            <span className="export-mesh__label">Output folder</span>
            <div className="export-mesh__folder-row">
              <input
                className="export-mesh__input"
                value={outputFolder}
                onChange={event => setOutputFolder(event.target.value)}
                placeholder="Choose a folder to export to"
                spellCheck={false}
              />
              <button
                type="button"
                className="export-mesh__browse"
                onClick={() => setShowFolderBrowser(true)}
              >
                <span className="material-symbols-outlined">folder_open</span>
                Browse
              </button>
            </div>
          </label>

          {selectedFormat.multiFile && (
            <p className="export-mesh__hint">
              OBJ saves geometry, materials and textures as separate files named after the mesh
              (e.g. {sanitizeBaseName(fileName)}.obj, {sanitizeBaseName(fileName)}.mtl, {sanitizeBaseName(fileName)}_albedo.png).
            </p>
          )}

          {error && <div className="export-mesh__message export-mesh__message--error">{error}</div>}
          {success && <div className="export-mesh__message export-mesh__message--success">{success}</div>}
        </div>

        <div className="export-mesh__actions">
          <button type="button" className="export-mesh__btn export-mesh__btn--secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="export-mesh__btn export-mesh__btn--primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>

      {showFolderBrowser && (
        <FolderBrowserDialog
          initialPath={outputFolder.trim()}
          onSelect={path => { setOutputFolder(path); setShowFolderBrowser(false) }}
          onClose={() => setShowFolderBrowser(false)}
        />
      )}
    </div>
  )
}
