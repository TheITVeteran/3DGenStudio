import Viewer from '../Viewer'
import {
  TENCENT_GENERATION_TYPE_OPTIONS,
  TENCENT_MODEL_VERSION_OPTIONS,
  TENCENT_POLYGON_TYPE_OPTIONS,
  TENCENT_REGION_OPTIONS,
  TRIPO_GEOMETRY_QUALITY_OPTIONS,
  TRIPO_MODEL_VERSION_OPTIONS,
  TRIPO_ORIENTATION_OPTIONS,
  TRIPO_TEXTURE_ALIGNMENT_OPTIONS,
  TRIPO_TEXTURE_QUALITY_OPTIONS,
  buildMeshEditorPath,
  canFetchTencentMeshResult,
  canFetchTripoMeshResult,
  getWorkflowParameterValueType,
  isTencentMeshGenerationApi,
  isTripoMeshGenerationApi
} from '../../utils/kanbanHelpers'

// A single Kanban board card (image / image-edit / mesh-gen / mesh-edit / texturing).
// Presentational: all board state, derived selectors, and handlers are passed in
// via props (spread from the page's cardContext). Behavior is identical to the
// former inline `renderImageCard` in KanbanPage.
export default function KanbanImageCard({
  card,
  showAttributes = false,
  // board state
  projectId,
  imageCardPages,
  setImageCardPages,
  cardAttributesByCardId,
  imageEditDraft,
  draggedCard,
  imageEditPreviewIndexes,
  imageEditPendingCardId,
  imageEditProgressByCardId,
  attributeTypes,
  // derived selectors
  getCardRuntimeState,
  getCardPreviewItems,
  getCardImageSourceGroups,
  getCardMeshSourceGroups,
  getApiOptionsForCard,
  getWorkflowsForCard,
  getAssetEditDisplayItems,
  getAssetPreviewUrl,
  formatAssetDimensions,
  getWorkflowSourceOptionLabel,
  getAttributeOptionsForCard,
  getPromptOptionsForCard,
  getImageEditParameterBinding,
  resolveImageEditParameterValue,
  getCardFileSourceGroups,
  // handlers
  navigate,
  handleCardDragStart,
  handleCardDragEnd,
  openImageSourceMenu,
  handleRemoveImageCard,
  openMeshPreview,
  handleRemoveImage,
  handleImageEditPreviewStep,
  openImageEditActionMenu,
  handleGetAsyncMeshResult,
  handleImageEditDraftChange,
  handleImageEditParameterSourceChange,
  handleImageEditParameterValueChange,
  handleRunImageEdit,
  closeImageEditActionMenu,
  handleAddCustomAttribute,
  handleAttributeTypeChange,
  handleAttributeValueChange,
  handleAttributeValueBlur,
  handleDeleteCustomAttribute
}) {
  const runtimeState = getCardRuntimeState(card)
  const cardLocked = runtimeState?.status === 'processing'
  const canFetchAsyncResult = canFetchTencentMeshResult(runtimeState) || canFetchTripoMeshResult(runtimeState)
  const displaySourceLabel = runtimeState?.source
    ? String(runtimeState.source).toUpperCase()
    : card.sourceLabel
  const displayMetaLabel = cardLocked
    ? (Number.isFinite(runtimeState?.progressPercent)
        ? `${runtimeState.progressPercent}%`
        : (runtimeState?.detail || card.metaLabel || 'Processing…'))
    : card.metaLabel
  const isMeshGenCard = card.kanbanColumnId === 3
  const isMeshEditCard = card.kanbanColumnId === 4
  const isTexturingCard = card.kanbanColumnId === 5
  const isMeshWorkflowCard = isMeshGenCard || isMeshEditCard || isTexturingCard
  const carouselItems = getCardPreviewItems(card, showAttributes)
  const useAssetCarousel = carouselItems.length > 0
  const previewAssets = isMeshWorkflowCard && (card.meshAssets?.length || 0) > 0 && !useAssetCarousel
    ? card.meshAssets
    : card.assets
  const totalPages = useAssetCarousel
    ? Math.max(1, carouselItems.length)
    : Math.max(1, Math.ceil(previewAssets.length / 4))
  const currentPage = Math.min(imageCardPages[card.id] || 0, totalPages - 1)
  const visibleAssets = useAssetCarousel
    ? carouselItems.slice(currentPage, currentPage + 1)
    : previewAssets.slice(currentPage * 4, currentPage * 4 + 4)
  const attributes = cardAttributesByCardId[card.id] || []
  const imageSourceGroups = getCardImageSourceGroups(card)
  const meshSourceGroups = getCardMeshSourceGroups(card)
  const availableActionApis = getApiOptionsForCard(card)
  const availableActionWorkflows = getWorkflowsForCard(card)
  const selectedActionWorkflow = availableActionWorkflows.find(workflow => workflow.id == imageEditDraft?.workflowId) || null
  const apiSourceGroups = isMeshEditCard || isTexturingCard ? meshSourceGroups : imageSourceGroups
  const apiSourceValueType = isMeshEditCard || isTexturingCard ? 'mesh' : 'image'
  const isTripoP1Model = isMeshGenCard
    && isTripoMeshGenerationApi(imageEditDraft?.selectedApi)
    && (imageEditDraft?.modelVersion || 'v2.5-20250123') === 'P1-20260311'

  return (
    <div
      className={`image-card ${draggedCard?.id === card.id ? 'image-card--dragging' : ''} ${cardLocked ? 'image-card--loading image-card--locked' : ''}`}
      id={`image-card-${card.id}`}
      draggable={!cardLocked}
      onDragStart={(event) => handleCardDragStart(event, card)}
      onDragEnd={handleCardDragEnd}
    >
      <div className="image-card__actions">
        {!showAttributes && (
          <button
            className="image-card__action-btn"
            disabled={cardLocked}
            onClick={(e) => {
              e.stopPropagation()
              openImageSourceMenu(card.id)
            }}
            title="Add more images"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_photo_alternate</span>
          </button>
        )}
        <button
          className="image-card__action-btn image-card__delete"
          disabled={cardLocked}
          onClick={(e) => {
            e.stopPropagation()
            handleRemoveImageCard(card.id, card.allAssets || card.assets)
          }}
          title="Remove card"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
        </button>
      </div>

      <div className={`image-card__thumb ${visibleAssets.length > 1 && !useAssetCarousel ? 'image-card__thumb--grid' : ''} ${useAssetCarousel ? 'image-card__thumb--carousel' : ''} ${cardLocked && visibleAssets.length === 0 ? 'image-card__thumb--loading' : ''}`}>
        {visibleAssets.length > 0 ? (
          visibleAssets.map(asset => {
            const displayItems = showAttributes && !useAssetCarousel && asset.type === 'image' ? getAssetEditDisplayItems(asset) : []
            const previewIndex = showAttributes
              ? Math.min(imageEditPreviewIndexes[asset.id] || 0, Math.max(0, displayItems.length - 1))
              : 0
            const previewItem = showAttributes ? (displayItems[previewIndex] || displayItems[0]) : asset
            const previewFilename = useAssetCarousel
              ? (asset.previewFilename || asset.filename)
              : (showAttributes ? previewItem?.filename : asset.filename)
            const previewName = useAssetCarousel
              ? asset.name
              : (showAttributes ? previewItem?.name : asset.name)
            const previewDimensions = useAssetCarousel
              ? formatAssetDimensions(asset.width, asset.height)
              : (showAttributes ? formatAssetDimensions(previewItem?.width, previewItem?.height) : formatAssetDimensions(asset.width, asset.height))
            const previewType = useAssetCarousel ? asset.assetType : asset.type
            const previewUrl = getAssetPreviewUrl(previewFilename)
            const sourceAsset = useAssetCarousel ? asset.asset : asset
            const modelUrl = getAssetPreviewUrl(sourceAsset?.filename)

            return (
            <div
              key={asset.key || asset.id}
              className={`image-card__thumb-item ${previewType === 'mesh' ? 'image-card__thumb-item--mesh' : ''}`}
              onClick={previewType === 'mesh' ? (event) => {
                event.stopPropagation()
                openMeshPreview(sourceAsset)
              } : undefined}
              role={previewType === 'mesh' ? 'button' : undefined}
              tabIndex={previewType === 'mesh' ? 0 : undefined}
              onKeyDown={previewType === 'mesh' ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  openMeshPreview(sourceAsset)
                }
              } : undefined}
            >
              {previewType === 'mesh' && previewUrl ? (
                asset.previewFilename ? (
                  <img
                    src={previewUrl}
                    alt={previewName}
                    className="image-card__thumb-image"
                  />
                ) : (
                  <Viewer
                    height="100%"
                    modelUrl={modelUrl}
                  />
                )
              ) : previewFilename ? (
                <img
                  src={previewUrl}
                  alt={previewName}
                  className="image-card__thumb-image"
                />
              ) : (
                <div className="image-card__thumb-placeholder">
                  <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'rgba(143,245,255,0.08)' }}>{previewType === 'mesh' ? 'deployed_code' : 'image'}</span>
                </div>
              )}

              {!showAttributes && !useAssetCarousel && (
                <button
                  className="image-card__thumb-remove"
                  disabled={cardLocked}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveImage(asset.id)
                  }}
                  title="Remove image"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                </button>
              )}

              {previewType === 'mesh' && sourceAsset?.id && (
                <button
                  className="image-card__thumb-remove image-card__thumb-remove--left"
                  disabled={cardLocked}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleRemoveImage(sourceAsset.id)
                  }}
                  title="Remove mesh"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                </button>
              )}

              {showAttributes && (
                <div className="image-card__thumb-caption font-label">
                  {previewName}
                </div>
              )}

              {previewType === 'image' && previewDimensions && (
                <div className={`image-card__thumb-dimensions font-label ${showAttributes ? 'image-card__thumb-dimensions--with-caption' : ''}`}>
                  {previewDimensions}
                </div>
              )}

              {useAssetCarousel && previewType === 'mesh' && (
                <div className="image-card__edit-preview-indicator font-label">
                  3D MESH
                </div>
              )}

              {useAssetCarousel && previewType === 'mesh' && sourceAsset?.id && [3, 4, 5].includes(card.kanbanColumnId) && (
                <button
                  type="button"
                  className="image-card__mesh-edit-btn"
                  disabled={cardLocked}
                  onClick={(event) => {
                    event.stopPropagation()
                    navigate(buildMeshEditorPath(sourceAsset, projectId, `/projects/${projectId}`))
                  }}
                  title="Edit mesh"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                  EDIT
                </button>
              )}

              {showAttributes && !useAssetCarousel && displayItems.length > 1 && (
                <>
                  <div className="image-card__edit-preview-indicator font-label">
                    {previewIndex === 0
                      ? `ORIGINAL • 1/${displayItems.length}`
                      : `EDIT ${previewIndex}/${displayItems.length - 1} • ${previewIndex + 1}/${displayItems.length}`}
                  </div>
                  <button
                    className="image-card__thumb-nav image-card__thumb-nav--prev"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleImageEditPreviewStep(asset, -1)
                    }}
                    title="Previous image edit"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                  </button>
                  <button
                    className="image-card__thumb-nav image-card__thumb-nav--next"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleImageEditPreviewStep(asset, 1)
                    }}
                    title="Next image edit"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                  </button>
                </>
              )}
            </div>
          )})
        ) : cardLocked ? (
          <div className="image-card__loading-state">
            <span className="material-symbols-outlined image-card__loading-spinner">progress_activity</span>
            <span className="font-label image-card__loading-label">
              {Number.isFinite(runtimeState?.progressPercent) ? `${runtimeState.progressPercent}%` : 'PROCESSING'}
            </span>
          </div>
        ) : (
          <div className="image-card__thumb-placeholder">
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'rgba(143,245,255,0.08)' }}>image</span>
          </div>
        )}

        {totalPages > 1 && (
          <>
            <button
              className="image-card__thumb-nav image-card__thumb-nav--prev"
              onClick={(e) => {
                e.stopPropagation()
                setImageCardPages(prev => ({
                  ...prev,
                  [card.id]: Math.max(0, currentPage - 1)
                }))
              }}
              disabled={cardLocked || currentPage === 0}
              title={useAssetCarousel ? 'Previous asset' : 'Previous images'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
            </button>
            <button
              className="image-card__thumb-nav image-card__thumb-nav--next"
              onClick={(e) => {
                e.stopPropagation()
                setImageCardPages(prev => ({
                  ...prev,
                  [card.id]: Math.min(totalPages - 1, currentPage + 1)
                }))
              }}
              disabled={cardLocked || currentPage >= totalPages - 1}
              title={useAssetCarousel ? 'Next asset' : 'Next images'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
            </button>
            <div className="image-card__thumb-page-indicator font-label">
              {currentPage + 1}/{totalPages}
            </div>
          </>
        )}
      </div>

      <div className="image-card__info">
        <div className="image-card__row">
          <h3 className="image-card__name">{card.primaryDisplayAsset?.name || 'Untitled asset'}</h3>
          <div className="image-card__badges">
            {card.assets.length > 1 && (
              <span className="image-card__count font-label">{card.assets.length} IMAGES</span>
            )}
            <span
              className="image-card__source"
              style={{
                color: ['AI GEN', 'COMFYUI'].includes(displaySourceLabel) ? 'var(--primary)' : 'var(--on-surface-variant)',
                background: ['AI GEN', 'COMFYUI'].includes(displaySourceLabel) ? 'rgba(143,245,255,0.1)' : 'rgba(71,72,74,0.2)',
              }}
            >
              {displaySourceLabel}
            </span>
          </div>
        </div>
        <p className="image-card__meta font-label">{displayMetaLabel}</p>

        {runtimeState && (
          <div className="image-card__edit-progress">
            <p className="image-card__meta font-label">{runtimeState.detail || (cardLocked ? 'Processing…' : 'Last operation update')}</p>
            {runtimeState.currentNodeLabel && (
              <p className="image-card__meta font-label image-card__meta--loading-node">
                {runtimeState.currentNodeLabel}
              </p>
            )}
            {Number.isFinite(runtimeState.progressPercent) && (
              <div className="image-card__progress" aria-hidden="true">
                <div
                  className="image-card__progress-bar"
                  style={{ width: `${Math.max(0, Math.min(100, runtimeState.progressPercent || 0))}%` }}
                />
              </div>
            )}
          </div>
        )}

        {showAttributes && (
          <div className="image-card__attributes">
            <div className="image-card__edit-actions">
              <button className="image-card__edit-action-btn" onClick={() => openImageEditActionMenu(card)} disabled={cardLocked}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>play_arrow</span>
                Action
              </button>
              {canFetchAsyncResult && (
                <button className="image-card__edit-action-btn" onClick={() => handleGetAsyncMeshResult(card)} disabled={imageEditPendingCardId === card.id}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
                  GET RESULT
                </button>
              )}

              {imageEditDraft?.cardId === card.id && !imageEditDraft?.mode && imageEditPendingCardId !== card.id && (
                <div className="image-card__edit-action-menu">
                  <button className="image-card__edit-action-option" onClick={() => openImageEditActionMenu(card, 'api')}>
                    API
                  </button>
                  <button className="image-card__edit-action-option" onClick={() => openImageEditActionMenu(card, 'comfy')}>
                    ComfyUI
                  </button>
                </div>
              )}

              {imageEditDraft?.cardId === card.id && imageEditDraft?.mode && imageEditPendingCardId !== card.id && (
                <div className="image-card__edit-panel">
                  <div className="params-card__field">
                    <label className="params-card__label font-label">NAME</label>
                    <input
                      type="text"
                      className="params-card__input"
                      value={imageEditDraft.name}
                      onChange={event => handleImageEditDraftChange(card, 'name', event.target.value)}
                      placeholder="Enter edit name"
                      required
                    />
                  </div>

                  {imageEditDraft.mode === 'api' ? (
                    <>
                      <div className="params-card__field">
                        <label className="params-card__label font-label">{isMeshEditCard || isTexturingCard ? 'Mesh' : 'Image'}</label>
                        <select
                          className="image-card__attribute-select"
                          value={imageEditDraft.selectedAssetId}
                          onChange={event => handleImageEditDraftChange(card, 'selectedAssetId', event.target.value)}
                        >
                          {isMeshGenCard && (isTencentMeshGenerationApi(imageEditDraft.selectedApi) || isTripoMeshGenerationApi(imageEditDraft.selectedApi)) && (
                            <option value="">No image source (use prompt)</option>
                          )}
                          {apiSourceGroups.length === 0 && <option value="">{isMeshEditCard || isTexturingCard ? 'No meshes available' : 'No images available'}</option>}
                          {apiSourceGroups.map(group => (
                            <optgroup key={group.asset.id} label={group.asset.name}>
                              {group.options.map(option => (
                                <option key={option.value} value={option.value}>
                                  {getWorkflowSourceOptionLabel(apiSourceValueType, option)}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      <div className="params-card__field">
                        <label className="params-card__label font-label">API</label>
                        <select
                          className="image-card__attribute-select"
                          value={imageEditDraft.selectedApi}
                          onChange={event => handleImageEditDraftChange(card, 'selectedApi', event.target.value)}
                          disabled={availableActionApis.length === 0}
                        >
                          {availableActionApis.length === 0 && <option value="">No APIs available</option>}
                          {availableActionApis.map(api => (
                            <option key={api.id} value={api.id}>{api.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="params-card__field">
                        <label className="params-card__label font-label">{isMeshGenCard && (isTencentMeshGenerationApi(imageEditDraft.selectedApi) || isTripoMeshGenerationApi(imageEditDraft.selectedApi)) ? 'Prompt' : 'Prompt Source'}</label>
                        {isMeshGenCard && (isTencentMeshGenerationApi(imageEditDraft.selectedApi) || isTripoMeshGenerationApi(imageEditDraft.selectedApi)) ? (
                          <textarea
                            className="gen-prompt-input"
                            value={imageEditDraft.prompt || ''}
                            onChange={event => handleImageEditDraftChange(card, 'prompt', event.target.value)}
                            placeholder="Describe the mesh to generate"
                          />
                        ) : (
                          <select
                            className="image-card__attribute-select"
                            value={imageEditDraft.promptSource}
                            onChange={event => handleImageEditDraftChange(card, 'promptSource', event.target.value)}
                          >
                            {getPromptOptionsForCard(card.id).map(option => (
                              <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {(!isMeshGenCard || (!isTencentMeshGenerationApi(imageEditDraft.selectedApi) && !isTripoMeshGenerationApi(imageEditDraft.selectedApi))) && imageEditDraft.promptSource === 'custom' && (
                        <div className="params-card__field">
                          <label className="params-card__label font-label">Custom Prompt</label>
                          <textarea
                            className="gen-prompt-input"
                            value={imageEditDraft.customPrompt}
                            onChange={event => handleImageEditDraftChange(card, 'customPrompt', event.target.value)}
                            placeholder="Enter a custom prompt"
                          />
                        </div>
                      )}

                      {isMeshGenCard && isTencentMeshGenerationApi(imageEditDraft.selectedApi) && (
                        <>
                          <div className="params-card__field">
                            <label className="params-card__label font-label">Region</label>
                            <select
                              className="image-card__attribute-select"
                              value={imageEditDraft.region}
                              onChange={event => handleImageEditDraftChange(card, 'region', event.target.value)}
                            >
                              {TENCENT_REGION_OPTIONS.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>

                          <div className="params-card__field">
                            <label className="params-card__label font-label">Model</label>
                            <select
                              className="image-card__attribute-select"
                              value={imageEditDraft.modelVersion}
                              onChange={event => handleImageEditDraftChange(card, 'modelVersion', event.target.value)}
                            >
                              {TENCENT_MODEL_VERSION_OPTIONS.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>

                          <div className="params-card__field">
                            <label className="params-card__label font-label">Generation Type</label>
                            <select
                              className="image-card__attribute-select"
                              value={imageEditDraft.generationType}
                              onChange={event => handleImageEditDraftChange(card, 'generationType', event.target.value)}
                            >
                              {TENCENT_GENERATION_TYPE_OPTIONS.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>

                          {imageEditDraft.generationType === 'LowPoly' && (
                            <div className="params-card__field">
                              <label className="params-card__label font-label">Polygon Type</label>
                              <select
                                className="image-card__attribute-select"
                                value={imageEditDraft.polygonType}
                                onChange={event => handleImageEditDraftChange(card, 'polygonType', event.target.value)}
                              >
                                {TENCENT_POLYGON_TYPE_OPTIONS.map(option => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="params-card__field">
                            <label className="params-card__label font-label">Face Count</label>
                            <input
                              type="number"
                              min="3000"
                              max="1500000"
                              className="params-card__input"
                              value={imageEditDraft.faceCount}
                              onChange={event => handleImageEditDraftChange(card, 'faceCount', event.target.value)}
                            />
                          </div>

                          <div className="params-card__field">
                            <label className="params-card__label font-label">Enable PBR</label>
                            <label className="params-card__checkbox-label">
                              <div className={`params-card__checkbox ${imageEditDraft.enablePBR ? 'params-card__checkbox--checked' : 'params-card__checkbox--unchecked'}`} onClick={() => handleImageEditDraftChange(card, 'enablePBR', !imageEditDraft.enablePBR)}>
                                {imageEditDraft.enablePBR && <span className="material-symbols-outlined" style={{ fontSize: '10px', color: 'var(--on-tertiary)', fontWeight: 700 }}>check</span>}
                              </div>
                              <span>Generate a PBR-ready mesh</span>
                            </label>
                          </div>

                          <p className="image-card__param-hint">Provide either a prompt or an image source for Tencent Cloud mesh generation.</p>
                        </>
                      )}

                      {isMeshGenCard && isTripoMeshGenerationApi(imageEditDraft.selectedApi) && (
                        <>
                          <div className="params-card__field">
                            <label className="params-card__label font-label">Model</label>
                            <select
                              className="image-card__attribute-select"
                              value={imageEditDraft.modelVersion || 'v2.5-20250123'}
                              onChange={event => handleImageEditDraftChange(card, 'modelVersion', event.target.value)}
                            >
                              {TRIPO_MODEL_VERSION_OPTIONS.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>

                          <div className="params-card__field">
                            <label className="params-card__label font-label">Model Seed (Optional)</label>
                            <input
                              type="number"
                              className="params-card__input"
                              value={imageEditDraft.modelSeed ?? ''}
                              onChange={event => handleImageEditDraftChange(card, 'modelSeed', event.target.value)}
                            />
                          </div>

                          {!isTripoP1Model && (
                            <div className="params-card__field">
                              <label className="params-card__label font-label">Enable Image Autofix</label>
                              <label className="params-card__checkbox-label">
                                <div className={`params-card__checkbox ${imageEditDraft.enableImageAutofix ? 'params-card__checkbox--checked' : 'params-card__checkbox--unchecked'}`} onClick={() => handleImageEditDraftChange(card, 'enableImageAutofix', !imageEditDraft.enableImageAutofix)}>
                                  {imageEditDraft.enableImageAutofix && <span className="material-symbols-outlined" style={{ fontSize: '10px', color: 'var(--on-tertiary)', fontWeight: 700 }}>check</span>}
                                </div>
                                <span>Fix input image before generation</span>
                              </label>
                            </div>
                          )}

                          <div className="params-card__field">
                            <label className="params-card__label font-label">Face Limit (Optional)</label>
                            <input
                              type="number"
                              min="1000"
                              max="300000"
                              className="params-card__input"
                              value={imageEditDraft.faceLimit ?? ''}
                              onChange={event => handleImageEditDraftChange(card, 'faceLimit', event.target.value)}
                            />
                          </div>

                          <div className="params-card__field">
                            <label className="params-card__label font-label">Texture</label>
                            <label className="params-card__checkbox-label">
                              <div className={`params-card__checkbox ${imageEditDraft.texture ? 'params-card__checkbox--checked' : 'params-card__checkbox--unchecked'}`} onClick={() => handleImageEditDraftChange(card, 'texture', !imageEditDraft.texture)}>
                                {imageEditDraft.texture && <span className="material-symbols-outlined" style={{ fontSize: '10px', color: 'var(--on-tertiary)', fontWeight: 700 }}>check</span>}
                              </div>
                              <span>Generate texture maps</span>
                            </label>
                          </div>

                          <div className="params-card__field">
                            <label className="params-card__label font-label">PBR</label>
                            <label className="params-card__checkbox-label">
                              <div className={`params-card__checkbox ${imageEditDraft.pbr ? 'params-card__checkbox--checked' : 'params-card__checkbox--unchecked'}`} onClick={() => handleImageEditDraftChange(card, 'pbr', !imageEditDraft.pbr)}>
                                {imageEditDraft.pbr && <span className="material-symbols-outlined" style={{ fontSize: '10px', color: 'var(--on-tertiary)', fontWeight: 700 }}>check</span>}
                              </div>
                              <span>Export PBR model</span>
                            </label>
                          </div>

                          <div className="params-card__field">
                            <label className="params-card__label font-label">Texture Seed (Optional)</label>
                            <input
                              type="number"
                              className="params-card__input"
                              value={imageEditDraft.textureSeed ?? ''}
                              onChange={event => handleImageEditDraftChange(card, 'textureSeed', event.target.value)}
                            />
                          </div>

                          {!isTripoP1Model && (
                            <div className="params-card__field">
                              <label className="params-card__label font-label">Texture Alignment</label>
                              <select
                                className="image-card__attribute-select"
                                value={imageEditDraft.textureAlignment || 'original_image'}
                                onChange={event => handleImageEditDraftChange(card, 'textureAlignment', event.target.value)}
                              >
                                {TRIPO_TEXTURE_ALIGNMENT_OPTIONS.map(option => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="params-card__field">
                            <label className="params-card__label font-label">Texture Quality</label>
                            <select
                              className="image-card__attribute-select"
                              value={imageEditDraft.textureQuality || 'standard'}
                              onChange={event => handleImageEditDraftChange(card, 'textureQuality', event.target.value)}
                            >
                              {TRIPO_TEXTURE_QUALITY_OPTIONS.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>

                          <div className="params-card__field">
                            <label className="params-card__label font-label">Auto Size</label>
                            <label className="params-card__checkbox-label">
                              <div className={`params-card__checkbox ${imageEditDraft.autoSize ? 'params-card__checkbox--checked' : 'params-card__checkbox--unchecked'}`} onClick={() => handleImageEditDraftChange(card, 'autoSize', !imageEditDraft.autoSize)}>
                                {imageEditDraft.autoSize && <span className="material-symbols-outlined" style={{ fontSize: '10px', color: 'var(--on-tertiary)', fontWeight: 700 }}>check</span>}
                              </div>
                              <span>Auto fit scale</span>
                            </label>
                          </div>

                          {!isTripoP1Model && (
                            <div className="params-card__field">
                              <label className="params-card__label font-label">Orientation</label>
                              <select
                                className="image-card__attribute-select"
                                value={imageEditDraft.orientation || 'default'}
                                onChange={event => handleImageEditDraftChange(card, 'orientation', event.target.value)}
                              >
                                {TRIPO_ORIENTATION_OPTIONS.map(option => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {!isTripoP1Model && (
                            <div className="params-card__field">
                              <label className="params-card__label font-label">Quad</label>
                              <label className="params-card__checkbox-label">
                                <div className={`params-card__checkbox ${imageEditDraft.quad ? 'params-card__checkbox--checked' : 'params-card__checkbox--unchecked'}`} onClick={() => handleImageEditDraftChange(card, 'quad', !imageEditDraft.quad)}>
                                  {imageEditDraft.quad && <span className="material-symbols-outlined" style={{ fontSize: '10px', color: 'var(--on-tertiary)', fontWeight: 700 }}>check</span>}
                                </div>
                                <span>Generate quad mesh</span>
                              </label>
                            </div>
                          )}

                          {!isTripoP1Model && (
                            <div className="params-card__field">
                              <label className="params-card__label font-label">Smart Low Poly</label>
                              <label className="params-card__checkbox-label">
                                <div className={`params-card__checkbox ${imageEditDraft.smartLowPoly ? 'params-card__checkbox--checked' : 'params-card__checkbox--unchecked'}`} onClick={() => handleImageEditDraftChange(card, 'smartLowPoly', !imageEditDraft.smartLowPoly)}>
                                  {imageEditDraft.smartLowPoly && <span className="material-symbols-outlined" style={{ fontSize: '10px', color: 'var(--on-tertiary)', fontWeight: 700 }}>check</span>}
                                </div>
                                <span>Optimize for low poly</span>
                              </label>
                            </div>
                          )}

                          {!isTripoP1Model && (
                            <div className="params-card__field">
                              <label className="params-card__label font-label">Generate Parts</label>
                              <label className="params-card__checkbox-label">
                                <div className={`params-card__checkbox ${imageEditDraft.generateParts ? 'params-card__checkbox--checked' : 'params-card__checkbox--unchecked'}`} onClick={() => handleImageEditDraftChange(card, 'generateParts', !imageEditDraft.generateParts)}>
                                  {imageEditDraft.generateParts && <span className="material-symbols-outlined" style={{ fontSize: '10px', color: 'var(--on-tertiary)', fontWeight: 700 }}>check</span>}
                                </div>
                                <span>Split into semantic parts</span>
                              </label>
                            </div>
                          )}

                          <div className="params-card__field">
                            <label className="params-card__label font-label">Export UV</label>
                            <label className="params-card__checkbox-label">
                              <div className={`params-card__checkbox ${imageEditDraft.exportUv ? 'params-card__checkbox--checked' : 'params-card__checkbox--unchecked'}`} onClick={() => handleImageEditDraftChange(card, 'exportUv', !imageEditDraft.exportUv)}>
                                {imageEditDraft.exportUv && <span className="material-symbols-outlined" style={{ fontSize: '10px', color: 'var(--on-tertiary)', fontWeight: 700 }}>check</span>}
                              </div>
                              <span>Include UVs in output</span>
                            </label>
                          </div>

                          {!isTripoP1Model && (
                            <div className="params-card__field">
                              <label className="params-card__label font-label">Geometry Quality</label>
                              <select
                                className="image-card__attribute-select"
                                value={imageEditDraft.geometryQuality || 'standard'}
                                onChange={event => handleImageEditDraftChange(card, 'geometryQuality', event.target.value)}
                              >
                                {TRIPO_GEOMETRY_QUALITY_OPTIONS.map(option => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {!isTripoP1Model && imageEditDraft.generateParts && (imageEditDraft.texture || imageEditDraft.pbr || imageEditDraft.quad) && (
                            <p className="image-card__param-hint">generate_parts is not compatible with texture, pbr, or quad.</p>
                          )}

                          <p className="image-card__param-hint">Provide either a prompt or an image source for Tripo AI mesh generation.</p>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="params-card__field">
                        <label className="params-card__label font-label">ComfyUI Workflow</label>
                        <select
                          className="image-card__attribute-select"
                          value={imageEditDraft.workflowId}
                          onChange={event => handleImageEditDraftChange(card, 'workflowId', event.target.value)}
                          disabled={availableActionWorkflows.length === 0}
                        >
                          {availableActionWorkflows.length === 0 && <option value="">No workflows available</option>}
                          {availableActionWorkflows.map(workflow => (
                            <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
                          ))}
                        </select>
                      </div>

                      {selectedActionWorkflow ? (
                        selectedActionWorkflow.parameters.map(parameter => {
                          const valueType = getWorkflowParameterValueType(parameter)
                          const binding = getImageEditParameterBinding(imageEditDraft, parameter)
                          const resolvedValue = resolveImageEditParameterValue(card, imageEditDraft, parameter)

                          if (['image', 'mesh'].includes(valueType)) {
                            const selectedAssetSource = binding.source || ''
                            const sourceGroups = getCardFileSourceGroups(card, valueType)

                            return (
                              <div key={parameter.id} className="params-card__field">
                                <label className="params-card__label font-label">{parameter.name} • {valueType.toUpperCase()}</label>
                                <select
                                  className="image-card__attribute-select"
                                  value={selectedAssetSource}
                                  onChange={event => handleImageEditParameterSourceChange(card, parameter, event.target.value)}
                                >
                                  {sourceGroups.map(group => (
                                    <optgroup key={group.asset.id} label={group.asset.name}>
                                      {group.options.map(option => (
                                        <option key={option.value} value={option.value}>
                                          {getWorkflowSourceOptionLabel(valueType, option)}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                                <span className="image-card__param-hint">{parameter.label}</span>
                              </div>
                            )
                          }

                          if (valueType === 'boolean') {
                            return (
                              <div key={parameter.id} className="params-card__field">
                                <label className="params-card__label font-label">{parameter.name} • BOOLEAN</label>
                                <label className="params-card__checkbox-label">
                                  <div className={`params-card__checkbox ${binding.customValue ? 'params-card__checkbox--checked' : 'params-card__checkbox--unchecked'}`} onClick={() => handleImageEditParameterValueChange(card, parameter, !binding.customValue)}>
                                    {binding.customValue && <span className="material-symbols-outlined" style={{ fontSize: '10px', color: 'var(--on-tertiary)', fontWeight: 700 }}>check</span>}
                                  </div>
                                  <span>{parameter.label || 'Toggle value'}</span>
                                </label>
                              </div>
                            )
                          }

                          const sourceOptions = getAttributeOptionsForCard(card.id, valueType === 'number' ? 'Number' : 'Text')

                          return (
                            <div key={parameter.id} className="params-card__field">
                              <label className="params-card__label font-label">{parameter.name} • {valueType.toUpperCase()}</label>
                              <select
                                className="image-card__attribute-select"
                                value={binding.source || 'custom'}
                                onChange={event => handleImageEditParameterSourceChange(card, parameter, event.target.value)}
                              >
                                {sourceOptions.map(option => (
                                  <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                              </select>
                              {valueType === 'string' ? (
                                <textarea
                                  className="gen-prompt-input image-card__param-textarea"
                                  value={binding.source === 'custom' ? (binding.customValue ?? '') : String(resolvedValue ?? '')}
                                  onChange={event => handleImageEditParameterValueChange(card, parameter, event.target.value)}
                                  disabled={binding.source !== 'custom'}
                                  placeholder={`Enter ${valueType} value`}
                                />
                              ) : (
                                <input
                                  type={valueType === 'number' ? 'number' : 'text'}
                                  className="params-card__input"
                                  value={binding.source === 'custom' ? (binding.customValue ?? '') : String(resolvedValue ?? '')}
                                  onChange={event => handleImageEditParameterValueChange(card, parameter, event.target.value)}
                                  disabled={binding.source !== 'custom'}
                                  placeholder={`Enter ${valueType} value`}
                                />
                              )}
                              <span className="image-card__param-hint">{parameter.label}</span>
                            </div>
                          )
                        })
                      ) : (
                        <div className="image-card__asset-picker-empty image-card__asset-picker-empty--compact">
                          <span className="material-symbols-outlined">tune</span>
                          <span>{isMeshGenCard
                            ? 'No compatible ComfyUI workflow available for mesh generation.'
                            : isMeshEditCard
                              ? 'No compatible ComfyUI workflow available for mesh edits.'
                              : isTexturingCard
                                ? 'No compatible ComfyUI workflow available for mesh texturing.'
                              : 'No compatible ComfyUI workflow available for image edits.'}</span>
                        </div>
                      )}
                    </>
                  )}

                  <div className="image-card__edit-panel-actions">
                    <button
                      className="gen-btn"
                      onClick={() => handleRunImageEdit(card)}
                      disabled={imageEditPendingCardId === card.id || !imageEditDraft.name?.trim()}
                    >
                      <span className="material-symbols-outlined">bolt</span>
                      {imageEditPendingCardId === card.id
                        ? `${imageEditProgressByCardId[card.id]?.progressPercent || 0}%`
                        : 'RUN ACTION'}
                    </button>
                    <button className="kanban-sidebar__nav-item" onClick={closeImageEditActionMenu} style={{ justifyContent: 'center' }}>
                      CANCEL
                    </button>
                  </div>

                  {imageEditPendingCardId === card.id && imageEditProgressByCardId[card.id] && (
                    <div className="image-card__edit-progress">
                      <p className="image-card__meta font-label">{imageEditProgressByCardId[card.id].detail}</p>
                      {imageEditProgressByCardId[card.id].currentNodeLabel && (
                        <p className="image-card__meta font-label image-card__meta--loading-node">
                          {imageEditProgressByCardId[card.id].currentNodeLabel}
                        </p>
                      )}
                      <div className="image-card__progress" aria-hidden="true">
                        <div
                          className="image-card__progress-bar"
                          style={{ width: `${Math.max(0, Math.min(100, imageEditProgressByCardId[card.id].progressPercent || 0))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="image-card__attributes-header">
              <span className="image-card__attributes-title font-label">CUSTOM ATTRIBUTES</span>
              <button className="image-card__attribute-add" onClick={() => handleAddCustomAttribute(card.id)} disabled={cardLocked}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                Add Custom Attribute
              </button>
            </div>

            {attributes.length > 0 ? (
              <div className="image-card__attribute-list">
                {attributes.map(attribute => {
                  const selectedType = attributeTypes.find(type => type.id === attribute.attributeTypeId)

                  return (
                    <div key={`${attribute.cardId}-${attribute.position}`} className="image-card__attribute-row">
                      <select
                        className="image-card__attribute-select"
                        value={attribute.attributeTypeId}
                        onChange={event => handleAttributeTypeChange(card.id, attribute.position, Number(event.target.value))}
                        disabled={cardLocked}
                      >
                        {attributeTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>

                      <input
                        type={selectedType?.name === 'Number' ? 'number' : 'text'}
                        className="image-card__attribute-input"
                        value={attribute.attributeValue || ''}
                        onChange={event => handleAttributeValueChange(card.id, attribute.position, event.target.value)}
                        onBlur={event => handleAttributeValueBlur(card.id, attribute.position, event.target.value)}
                        disabled={cardLocked}
                        placeholder={`Enter ${selectedType?.name?.toLowerCase() || 'attribute'} value`}
                      />

                      <button
                        className="image-card__attribute-delete"
                        onClick={() => handleDeleteCustomAttribute(card.id, attribute.position)}
                        disabled={cardLocked}
                        title="Delete attribute"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="image-card__attribute-empty">
                No custom attributes yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
