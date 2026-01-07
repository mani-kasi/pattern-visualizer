import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'

import '../App.css'
import { API_BASE_URL } from '../constants/api'
import { clearAuthToken, getAuthToken } from '../constants/auth'
import { BUILT_IN_PATTERNS, type PatternOption } from '../constants/patterns'
import { type LightingPreset, PantsModel, RendererBackground, StudioLights } from '../components/ViewerScene'

const DEFAULT_SCALE = 1
const LIGHTING_STORAGE_KEY = 'patternVisualizer:lightingPreset'
const SHARE_URL_MODE: 'browser' | 'hash' = 'browser'
const LIGHTING_LABELS: Record<LightingPreset, string> = {
  studioSoft: 'Studio Soft',
  flat: 'Flat',
  dramatic: 'Dramatic',
}

type Preset = {
  id: string
  name: string
  patternId: string
  settings: {
    scale?: number
    lightingPreset?: LightingPreset
    transparentBg?: boolean
  }
  isPublic: boolean
  shareSlug: string | null
  createdAt: string
}

type ShareResponse = {
  shareSlug: string
  shareUrl: string
}



export default function VisualizerPage() {
  const navigate = useNavigate()
  const [patterns, setPatterns] = useState<PatternOption[]>(BUILT_IN_PATTERNS)
  const [selectedPatternId, setSelectedPatternId] = useState<string>('none')
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>(() => {
    if (typeof window === 'undefined') return 'studioSoft'
    const stored = window.localStorage.getItem(LIGHTING_STORAGE_KEY)
    return stored === 'flat' || stored === 'dramatic' || stored === 'studioSoft' ? stored : 'studioSoft'
  })
  const [isStudioOpen, setIsStudioOpen] = useState(true)
  const [isPresetsOpen, setIsPresetsOpen] = useState(true)
  const [transparentBg, setTransparentBg] = useState(false)
  const [showAxes, setShowAxes] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [exportHint, setExportHint] = useState<string | null>(null)
  const [presetName, setPresetName] = useState('')
  const [presets, setPresets] = useState<Preset[]>([])
  const [isSavingPreset, setIsSavingPreset] = useState(false)
  const [isLoadingPresets, setIsLoadingPresets] = useState(false)
  const [presetStatus, setPresetStatus] = useState<string | null>(null)
  const [activePresetAction, setActivePresetAction] = useState<string | null>(null)
  const glRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isModelLoading, setIsModelLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedPattern = useMemo(
    () => patterns.find((pattern) => pattern.id === selectedPatternId) ?? BUILT_IN_PATTERNS[0],
    [patterns, selectedPatternId],
  )

  const getShareUrl = useCallback((shareSlug?: string | null) => {
    if (!shareSlug) return null
    const origin = typeof window === 'undefined' ? API_BASE_URL : window.location.origin
    if (SHARE_URL_MODE === 'hash') {
      return `${origin}/#/s/${shareSlug}`
    }
    return `${origin}/s/${shareSlug}`
  }, [])

  useEffect(() => {
    if (!selectedPattern || !selectedPattern.file) {
      setTexture((prev) => {
        prev?.dispose()
        return null
      })
      return
    }

    let cancelled = false
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    const source = selectedPattern.file

    loader.load(
      source,
      (loadedTexture) => {
        if (cancelled) {
          loadedTexture.dispose()
          return
        }

        loadedTexture.wrapS = THREE.RepeatWrapping
        loadedTexture.wrapT = THREE.RepeatWrapping
        loadedTexture.repeat.set(DEFAULT_SCALE, DEFAULT_SCALE)
        loadedTexture.colorSpace = THREE.SRGBColorSpace
        loadedTexture.anisotropy = 16

        setTexture((prev) => {
          prev?.dispose()
          return loadedTexture
        })
      },
      undefined,
      () => {
        setTexture((prev) => {
          prev?.dispose()
          return null
        })
      },
    )

    return () => {
      cancelled = true
    }
  }, [selectedPattern])

  useEffect(() => {
    if (!texture) return
    texture.repeat.set(scale, scale)
    texture.needsUpdate = true
  }, [texture, scale])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LIGHTING_STORAGE_KEY, lightingPreset)
  }, [lightingPreset])


  const handleLogout = useCallback(() => {
    clearAuthToken()
    navigate('/login', { replace: true })
  }, [navigate])

  const handleUnauthorized = useCallback(() => {
    handleLogout()
  }, [handleLogout])

  const handleModelLoaded = useCallback(() => {
    setIsModelLoading(false)
  }, [])

  const isExportReady = !isModelLoading && (selectedPattern?.file ? Boolean(texture) : true)
  const canSavePreset = Boolean(presetName.trim() && selectedPattern?.file && texture) && !isSavingPreset

  const handleExportClick = useCallback(async () => {
    if (isModelLoading) {
      setError('Preview is still loading. Please wait a moment.')
      return
    }

    if (!isExportReady) {
      setExportHint('Scene still loading…')
      return
    }

    const renderer = glRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    const canvas = renderer?.domElement ?? null

    if (!canvas) {
      setError('Preview is not available yet.')
      return
    }

    try {
      setIsExporting(true)
      setExportHint(null)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (renderer && scene && camera) {
        renderer.render(scene, camera)
      }
      const dataUrl = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.href = dataUrl
      downloadLink.download = 'pattern-preview.png'
      setError((prev) => {
        if (
          prev === 'Preview is still loading. Please wait a moment.' ||
          prev === 'Preview is not available yet.' ||
          prev === 'Failed to export preview. Please try again.'
        ) {
          return null
        }
        return prev
      })
      downloadLink.click()
    } catch (exportError) {
      console.error('Export error:', exportError)
      setError('Failed to export preview. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }, [isExportReady, isModelLoading, selectedPattern?.file, setError, texture])

  const fetchPatterns = useCallback(
    async (patternToSelect?: string | null) => {
      const token = getAuthToken()
      if (!token) {
        handleUnauthorized()
        return
      }

      setIsLoadingPatterns(true)
      setError(null)

      try {
        const response = await fetch(`${API_BASE_URL}/api/patterns`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.status === 401 || response.status === 403) {
          handleUnauthorized()
          return
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null)
          throw new Error(errorBody?.message ?? 'Failed to load patterns.')
        }

        const data: Array<{ id: number; filename: string; url: string }> = await response.json()
        const remotePatterns: PatternOption[] = data.map((pattern) => ({
          id: `remote-${pattern.id}`,
          name: pattern.filename,
          file: `${API_BASE_URL}${pattern.url}`,
          isUpload: true,
        }))

        const nextPatterns = [...BUILT_IN_PATTERNS, ...remotePatterns]
        setPatterns(nextPatterns)
        setSelectedPatternId((prevSelected) => {
          if (patternToSelect && nextPatterns.some((pattern) => pattern.id === patternToSelect)) {
            return patternToSelect
          }
          return nextPatterns.some((pattern) => pattern.id === prevSelected) ? prevSelected : 'none'
        })
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load patterns.')
      } finally {
        setIsLoadingPatterns(false)
      }
    },
    [handleUnauthorized],
  )

  const fetchPresets = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      handleUnauthorized()
      return
    }

    setIsLoadingPresets(true)
    setPresetStatus(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/presets`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        throw new Error(errorBody?.message ?? 'Failed to load presets.')
      }

      const data: Preset[] = await response.json()
      setPresets(data)
    } catch (requestError) {
      setPresetStatus(requestError instanceof Error ? requestError.message : 'Failed to load presets.')
    } finally {
      setIsLoadingPresets(false)
    }
  }, [handleUnauthorized])

  useEffect(() => {
    fetchPatterns()
  }, [fetchPatterns])

  useEffect(() => {
    fetchPresets()
  }, [fetchPresets])

  const handleSavePreset = useCallback(async () => {
    const trimmedName = presetName.trim()
    if (!trimmedName) {
      setPresetStatus('Preset name is required.')
      return
    }

    if (!selectedPattern?.file || !texture) {
      setPresetStatus('Select a pattern before saving.')
      return
    }

    const token = getAuthToken()
    if (!token) {
      handleUnauthorized()
      return
    }

    setIsSavingPreset(true)
    setPresetStatus(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/presets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          patternId: selectedPatternId,
          settings: {
            scale,
            lightingPreset,
            transparentBg,
          },
        }),
      })

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        throw new Error(errorBody?.message ?? 'Failed to save preset.')
      }

      const created: Preset = await response.json()
      setPresets((prev) => [created, ...prev])
      setPresetName('')
      setPresetStatus('Preset saved.')
    } catch (requestError) {
      setPresetStatus(requestError instanceof Error ? requestError.message : 'Failed to save preset.')
    } finally {
      setIsSavingPreset(false)
    }
  }, [handleUnauthorized, lightingPreset, presetName, scale, selectedPattern?.file, selectedPatternId, texture, transparentBg])

  const handleLoadPreset = useCallback(
    (preset: Preset) => {
      setSelectedPatternId(preset.patternId)
      if (typeof preset.settings.scale === 'number') {
        setScale(preset.settings.scale)
      }
      if (preset.settings.lightingPreset) {
        setLightingPreset(preset.settings.lightingPreset)
      }
      if (typeof preset.settings.transparentBg === 'boolean') {
        setTransparentBg(preset.settings.transparentBg)
      }
      setPresetStatus(`Loaded preset "${preset.name}".`)
    },
    [setLightingPreset],
  )

  const handleDeletePreset = useCallback(
    async (presetId: string) => {
      const token = getAuthToken()
      if (!token) {
        handleUnauthorized()
        return
      }

      setActivePresetAction(presetId)
      setPresetStatus(null)

      try {
        const response = await fetch(`${API_BASE_URL}/api/presets/${presetId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.status === 401 || response.status === 403) {
          handleUnauthorized()
          return
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null)
          throw new Error(errorBody?.message ?? 'Failed to delete preset.')
        }

        setPresets((prev) => prev.filter((preset) => preset.id !== presetId))
        setPresetStatus('Preset deleted.')
      } catch (requestError) {
        setPresetStatus(requestError instanceof Error ? requestError.message : 'Failed to delete preset.')
      } finally {
        setActivePresetAction(null)
      }
    },
    [handleUnauthorized],
  )

  const handleSharePreset = useCallback(
    async (presetId: string) => {
      const token = getAuthToken()
      if (!token) {
        handleUnauthorized()
        return
      }

      setActivePresetAction(presetId)
      setPresetStatus(null)

      try {
        const response = await fetch(`${API_BASE_URL}/api/presets/${presetId}/share`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.status === 401 || response.status === 403) {
          handleUnauthorized()
          return
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null)
          throw new Error(errorBody?.message ?? 'Failed to share preset.')
        }

        const data: ShareResponse = await response.json()
        setPresets((prev) =>
          prev.map((preset) =>
            preset.id === presetId
              ? { ...preset, isPublic: true, shareSlug: data.shareSlug }
              : preset,
          ),
        )
        setPresetStatus('Share link created.')
      } catch (requestError) {
        setPresetStatus(requestError instanceof Error ? requestError.message : 'Failed to share preset.')
      } finally {
        setActivePresetAction(null)
      }
    },
    [handleUnauthorized],
  )

  const handleUnsharePreset = useCallback(
    async (presetId: string) => {
      const token = getAuthToken()
      if (!token) {
        handleUnauthorized()
        return
      }

      setActivePresetAction(presetId)
      setPresetStatus(null)

      try {
        const response = await fetch(`${API_BASE_URL}/api/presets/${presetId}/unshare`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.status === 401 || response.status === 403) {
          handleUnauthorized()
          return
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null)
          throw new Error(errorBody?.message ?? 'Failed to unshare preset.')
        }

        setPresets((prev) =>
          prev.map((preset) => (preset.id === presetId ? { ...preset, isPublic: false } : preset)),
        )
        setPresetStatus('Share link disabled.')
      } catch (requestError) {
        setPresetStatus(requestError instanceof Error ? requestError.message : 'Failed to unshare preset.')
      } finally {
        setActivePresetAction(null)
      }
    },
    [handleUnauthorized],
  )

  const handleCopyShareLink = useCallback(async (shareSlug: string | null) => {
    const shareUrl = getShareUrl(shareSlug)
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setPresetStatus('Share link copied.')
    } catch (copyError) {
      console.error('Copy share link error:', copyError)
      setPresetStatus('Failed to copy share link.')
    }
  }, [getShareUrl])

  useEffect(() => {
    if (isExportReady) {
      setExportHint(null)
    }
  }, [isExportReady])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const inputElement = event.target
    const files = inputElement.files
    if (!files?.length) return

    const token = getAuthToken()
    if (!token) {
      handleUnauthorized()
      return
    }

    setIsUploading(true)
    setError(null)

    let uploadedAny = false
    let lastUploadedPatternId: string | null = null

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          continue
        }

        const formData = new FormData()
        formData.append('pattern', file)

        const response = await fetch(`${API_BASE_URL}/api/patterns/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        if (response.status === 401 || response.status === 403) {
          handleUnauthorized()
          return
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null)
          throw new Error(errorBody?.message ?? 'Failed to upload pattern.')
        }

        const uploadedPattern: { id: number } = await response.json()
        uploadedAny = true
        lastUploadedPatternId = `remote-${uploadedPattern.id}`
      }

      if (!uploadedAny) {
        setError('Please choose an image file to upload.')
        return
      }

      await fetchPatterns(lastUploadedPatternId)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload pattern.')
    } finally {
      setIsUploading(false)
      inputElement.value = ''
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div>
            <h1 className="app-title">Pattern Library</h1>
            <p className="app-subtitle">Upload or select a fabric to preview it on the garment.</p>
          </div>

          <button type="button" className="button button--secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="sidebar-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading…' : 'Upload Pattern'}
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={handleExportClick}
            disabled={isExporting || !isExportReady}
          >
            {isExporting ? 'Exporting…' : 'Export PNG'}
          </button>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={transparentBg}
              onChange={(event) => setTransparentBg(event.target.checked)}
            />
            Transparent background
          </label>
        </div>
        {exportHint ? <div className="sidebar-message">{exportHint}</div> : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFilesSelected}
        />

        {error ? <div className="sidebar-error">{error}</div> : null}
        {isLoadingPatterns ? <div className="sidebar-message">Syncing your pattern library…</div> : null}

        <div className="pattern-scroll">
          <div className="pattern-buttons">
            {patterns.map((pattern) => {
              const isSelected = pattern.id === selectedPatternId
              return (
                <button
                  key={pattern.id}
                  type="button"
                  className={`pattern-button${isSelected ? ' pattern-button--active' : ''}`}
                  onClick={() => setSelectedPatternId(pattern.id)}
                >
                  {pattern.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="scale-control">
          <div className="scale-header">
            <label htmlFor="pattern-scale">Pattern Scale</label>
            <span className="scale-value">{scale.toFixed(2)}×</span>
          </div>
          <input
            id="pattern-scale"
            type="range"
            min="0.5"
            max="10"
            step="0.1"
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
            disabled={!selectedPattern?.file}
          />
        </div>

      </aside>

      <main className="viewer">
        <div className="canvas-wrapper">
          {isModelLoading ? <div className="canvas-loading">Loading garment…</div> : null}
          <div className="hud-stack">
            <section className={`studio-hud${isStudioOpen ? ' studio-hud--open' : ''}`}>
              <div className="studio-hud__header">
                <h2 className="studio-hud__title">Studio Mode</h2>
                <button
                  type="button"
                  className="studio-hud__toggle"
                  onClick={() => setIsStudioOpen((prev) => !prev)}
                >
                  {isStudioOpen ? 'Minimize' : 'Expand'}
                </button>
              </div>
              {isStudioOpen ? (
                <div className="studio-hud__body">
                  <div className="studio-group">
                    <span className="studio-label">Lighting</span>
                    <div className="studio-buttons">
                      <button
                        type="button"
                        className={`pattern-button${lightingPreset === 'studioSoft' ? ' pattern-button--active' : ''}`}
                        onClick={() => setLightingPreset('studioSoft')}
                      >
                        Studio Soft
                      </button>
                      <button
                        type="button"
                        className={`pattern-button${lightingPreset === 'flat' ? ' pattern-button--active' : ''}`}
                        onClick={() => setLightingPreset('flat')}
                      >
                        Flat
                      </button>
                      <button
                        type="button"
                        className={`pattern-button${lightingPreset === 'dramatic' ? ' pattern-button--active' : ''}`}
                        onClick={() => setLightingPreset('dramatic')}
                      >
                        Dramatic
                      </button>
                    </div>
                    <div className="studio-selected">Selected: {LIGHTING_LABELS[lightingPreset]}</div>
                  </div>
                  <div className="studio-group">
                    <span className="studio-label">Helpers</span>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={showAxes}
                        onChange={(event) => setShowAxes(event.target.checked)}
                      />
                      Show axes
                    </label>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={(event) => setShowGrid(event.target.checked)}
                      />
                      Show grid
                    </label>
                  </div>
                </div>
              ) : null}
            </section>
            <section className={`preset-hud${isPresetsOpen ? ' preset-hud--open' : ''}`}>
              <div className="preset-hud__header">
                <h2 className="preset-hud__title">Presets</h2>
                <button
                  type="button"
                  className="studio-hud__toggle"
                  onClick={() => setIsPresetsOpen((prev) => !prev)}
                >
                  {isPresetsOpen ? 'Minimize' : 'Expand'}
                </button>
              </div>
              {isPresetsOpen ? (
                <div className="preset-hud__body">
                  <div className="preset-form">
                    <input
                      type="text"
                      className="preset-input"
                      placeholder="Preset name"
                      value={presetName}
                      onChange={(event) => setPresetName(event.target.value)}
                    />
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={handleSavePreset}
                      disabled={!canSavePreset}
                    >
                      {isSavingPreset ? 'Saving…' : 'Save preset'}
                    </button>
                  </div>
                  {presetStatus ? <div className="sidebar-message">{presetStatus}</div> : null}
                  {isLoadingPresets ? <div className="sidebar-message">Loading presets…</div> : null}
                  <div className="preset-list">
                    {presets.length === 0 && !isLoadingPresets ? (
                      <div className="sidebar-message">No saved presets yet.</div>
                    ) : null}
                    {presets.map((preset) => {
                      const shareUrl = getShareUrl(preset.shareSlug)
                      return (
                        <div key={preset.id} className="preset-card">
                          <div className="preset-card__header">
                            <div className="preset-card__name">{preset.name}</div>
                            <div className="preset-card__meta">
                              {new Date(preset.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="preset-card__actions">
                            <button
                              type="button"
                              className="preset-action"
                              onClick={() => handleLoadPreset(preset)}
                            >
                              Load
                            </button>
                            <button
                              type="button"
                              className="preset-action"
                              onClick={() => handleDeletePreset(preset.id)}
                              disabled={activePresetAction === preset.id}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              className="preset-action"
                              onClick={() => handleSharePreset(preset.id)}
                              disabled={activePresetAction === preset.id}
                            >
                              Share
                            </button>
                            {preset.isPublic ? (
                              <button
                                type="button"
                                className="preset-action"
                                onClick={() => handleUnsharePreset(preset.id)}
                                disabled={activePresetAction === preset.id}
                              >
                                Unshare
                              </button>
                            ) : null}
                          </div>
                          {preset.isPublic && shareUrl ? (
                            <div className="preset-card__share">
                              <input className="preset-share-input" value={shareUrl} readOnly />
                              <button
                                type="button"
                                className="preset-action"
                                onClick={() => handleCopyShareLink(preset.shareSlug)}
                              >
                                Copy
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
          <Canvas
            camera={{ position: [0, 1.5, 3], fov: 50 }}
            shadows
            gl={{ alpha: true, preserveDrawingBuffer: true }}
            onCreated={({ gl, scene, camera }) => {
              glRef.current = gl
              sceneRef.current = scene
              cameraRef.current = camera
            }}
          >
            <RendererBackground transparent={transparentBg} />
            <StudioLights preset={lightingPreset} />

            <Suspense fallback={null}>
              <Bounds fit clip observe margin={1.1}>
                <PantsModel texture={texture} onLoaded={handleModelLoaded} />
              </Bounds>
            </Suspense>

            {showGrid ? <gridHelper args={[10, 10]} /> : null}
            {showAxes ? <axesHelper args={[3]} /> : null}

            <OrbitControls makeDefault />
          </Canvas>
        </div>
      </main>
    </div>
  )
}
