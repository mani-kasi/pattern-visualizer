import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'

import '../App.css'
import { API_BASE_URL } from '../constants/api'
import { clearAuthToken, getAuthToken } from '../constants/auth'

const DEFAULT_SCALE = 1
const PANTS_PATCH_NAME_HINTS = ['object_9']
const PANTS_PATCH_ACTION: 'hide' | 'neutral-material' = 'hide'

const BUILT_IN_PATTERNS: PatternOption[] = [
  { id: 'none', name: 'No Pattern', file: null },
  { id: 'cheetah', name: 'Cheetah', file: '/patterns/cheetah.jpg' },
  { id: 'tropical', name: 'Tropical', file: '/patterns/tropical.jpg' },
]

type PatternOption = {
  id: string
  name: string
  file: string | null
  isUpload?: boolean
}

type PantsModelProps = {
  texture: THREE.Texture | null
  onLoaded?: () => void
}

function PantsModel({ texture, onLoaded }: PantsModelProps) {
  const { scene } = useGLTF('/pants.glb')
  const pantsScene = useMemo(() => scene.clone(true), [scene])

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: texture ? new THREE.Color('#ffffff') : new THREE.Color('#b3b3b3'),
      map: texture ?? null,
    })
    mat.needsUpdate = true
    return mat
  }, [texture])

  const neutralMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#b3b3b3') })
    mat.needsUpdate = true
    return mat
  }, [])

  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => neutralMaterial.dispose(), [neutralMaterial])

  useEffect(() => {
    pantsScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const meshName = mesh.name.toLowerCase()
        const materialNames = Array.isArray(mesh.material)
          ? mesh.material.map((mat) => mat.name?.toLowerCase() ?? '')
          : [((mesh.material as THREE.Material | undefined)?.name ?? '').toLowerCase()]
        const matchesNameHint = PANTS_PATCH_NAME_HINTS.some((hint) => meshName.includes(hint))

        if (matchesNameHint) {
          if (PANTS_PATCH_ACTION === 'hide') {
            mesh.visible = false
          } else {
            mesh.material = neutralMaterial
          }
        } else {
          mesh.material = material
        }
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    onLoaded?.()
  }, [material, neutralMaterial, onLoaded, pantsScene])

  return <primitive object={pantsScene} />
}

useGLTF.preload('/pants.glb')

export default function VisualizerPage() {
  const navigate = useNavigate()
  const [patterns, setPatterns] = useState<PatternOption[]>(BUILT_IN_PATTERNS)
  const [selectedPatternId, setSelectedPatternId] = useState<string>('none')
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null)
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

  const handleExportClick = useCallback(() => {
    if (isModelLoading) {
      setError('Preview is still loading. Please wait a moment.')
      return
    }

    const canvas = canvasWrapperRef.current?.querySelector('canvas') as HTMLCanvasElement | null

    if (!canvas) {
      setError('Preview is not available yet.')
      return
    }

    try {
      setIsExporting(true)
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
  }, [isModelLoading, setError])

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

  useEffect(() => {
    fetchPatterns()
  }, [fetchPatterns])

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
            disabled={isExporting || isModelLoading}
          >
            {isExporting ? 'Exporting…' : 'Export PNG'}
          </button>
        </div>

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

        <div className="scale-control">
          <div className="scale-header">
            <label htmlFor="pattern-scale">Pattern Scale</label>
            <span className="scale-value">{scale.toFixed(2)}×</span>
          </div>
          <input
            id="pattern-scale"
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
            disabled={!selectedPattern?.file}
          />
        </div>
      </aside>

      <main className="viewer">
        <div className="canvas-wrapper" ref={canvasWrapperRef}>
          {isModelLoading ? <div className="canvas-loading">Loading garment…</div> : null}
          <Canvas camera={{ position: [0, 1.5, 3], fov: 50 }} shadows>
            <color attach="background" args={['#f3f4f6']} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[5, 5, 5]} intensity={1.1} castShadow />

            <Suspense fallback={null}>
              <Bounds fit clip observe margin={1.1}>
                <PantsModel texture={texture} onLoaded={handleModelLoaded} />
              </Bounds>
            </Suspense>

            <gridHelper args={[10, 10]} />
            <axesHelper args={[5]} />

            <OrbitControls makeDefault />
          </Canvas>
        </div>
      </main>
    </div>
  )
}
