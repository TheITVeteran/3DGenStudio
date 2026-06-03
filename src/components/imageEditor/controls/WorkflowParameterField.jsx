// Renders a single non-image ComfyUI workflow parameter (boolean checkbox or
// text/number input). Shared by the AI control panels. Presentational.
import { getValueType } from '../../../utils/imageEditorCanvas'

export default function WorkflowParameterField({ parameter, value, onChange }) {
  const valueType = getValueType(parameter)

  if (valueType === 'boolean') {
    return (
      <label className="image-editor-label image-editor-label--checkbox">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={event => onChange(parameter.id, event.target.checked)}
        />
        <span>{parameter.name}</span>
      </label>
    )
  }

  return (
    <label className="image-editor-label">
      {parameter.name}
      <input
        className="image-editor-input"
        type={valueType === 'number' ? 'number' : 'text'}
        value={value ?? ''}
        onChange={event => onChange(parameter.id, event.target.value)}
      />
    </label>
  )
}
