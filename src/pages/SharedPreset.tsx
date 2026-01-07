import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useParams } from 'react-router-dom'

import '../App.css'
import { API_BASE_URL } from '../constants/api'
import { BUILT_IN_PATTERNS } from '../constants/patterns'
import { type LightingPreset, PantsModel, RendererBackground, StudioLights } from '../components/ViewerScene'

type SharedPresetResponse = {
  name: string
  patternId: string
  settings: {
    scale?: number
    lightingPreset?: LightingPreset
    transparentBg?: boolean
  }
  patternUrl: string | null
}

const DEFAULT_SCALE = 1

export default function SharedPresetPage() {
  const { slug } = useParams<{ slug: string }>()
  const [presetName, setPresetName] = useState<string>('Shared preset')
  const [patternId, setPatternId] = useState<string>('none')
  const [patternUrl, setPatternUrl] = useState<string | null>(null)
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('studioSoft')
  const [transparentBg, setTransparentBg] = useState(false)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [isModelLoading, setIsModelLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingPreset, setIsLoadingPreset] = useState(true)
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null)

  const resolvedPatternFile = useMemo(() => {
    const builtIn = BUILT_IN_PATTERNS.find((pattern) => pattern.id === patternId)
    if (builtIn?.file) {
      return builtIn.file
    }
    return patternUrl
  }, [patternId, patternUrl])

  useEffect(() => {
    if (!slug) {
      setError('Invalid share link.')
      setIsLoadingPreset(false)
      return
    }

    let cancelled = false
    setIsLoadingPreset(true)
    setError(null)

    fetch(`${API_BASE_URL}/api/share/${slug}`)
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null)
          throw new Error(errorBody?.message ?? 'Shared preset not found.')
        }
        return response.json()
      })
      .then((data: SharedPresetResponse) => {
        if (cancelled) return
        setPresetName(data.name)
        setPatternId(data.patternId)
        setPatternUrl(data.patternUrl)
        setScale(typeof data.settings.scale === 'number' ? data.settings.scale : DEFAULT_SCALE)
        setLightingPreset(data.settings.lightingPreset ?? 'studioSoft')
        setTransparentBg(Boolean(data.settings.transparentBg))
      })
      .catch((fetchError) => {
        if (cancelled) return
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load shared preset.')
      })
      .finally(() => {
        if (cancelled) return
        setIsLoadingPreset(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!resolvedPatternFile) {
      setTexture((prev) => {
        prev?.dispose()
        return null
      })
      return
    }

    let cancelled = false
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')

    loader.load(
      resolvedPatternFile,
      (loadedTexture) => {
        if (cancelled) {
          loadedTexture.dispose()
          return
        }

        loadedTexture.wrapS = THREE.RepeatWrapping
        loadedTexture.wrapT = THREE.RepeatWrapping
        loadedTexture.repeat.set(scale, scale)
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
  }, [resolvedPatternFile, scale])

  useEffect(() => {
    if (!texture) return
    texture.repeat.set(scale, scale)
    texture.needsUpdate = true
  }, [texture, scale])

  return (
    <div className="app">
      <main className="viewer">
        <div className="canvas-wrapper" ref={canvasWrapperRef}>
          {isModelLoading ? <div className="canvas-loading">Loading garment…</div> : null}
          <div className="share-banner">
            <div className="share-banner__title">{presetName}</div>
            <div className="share-banner__subtitle">Shared preset</div>
          </div>
          {error ? <div className="share-banner share-banner--error">{error}</div> : null}
          {isLoadingPreset ? <div className="share-banner share-banner--loading">Loading preset…</div> : null}
          <Canvas camera={{ position: [0, 1.5, 3], fov: 50 }} shadows gl={{ alpha: true }}>
            <RendererBackground transparent={transparentBg} />
            <StudioLights preset={lightingPreset} />
            <Suspense fallback={null}>
              <Bounds fit clip observe margin={1.1}>
                <PantsModel texture={texture} onLoaded={() => setIsModelLoading(false)} />
              </Bounds>
            </Suspense>
            <OrbitControls makeDefault />
          </Canvas>
        </div>
      </main>
    </div>
  )
}
