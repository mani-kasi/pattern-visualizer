import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import './App.css'

type PatternOption = {
  name: string
  file: string | null
}

const PATTERNS: PatternOption[] = [
  { name: 'No Pattern', file: null },
  { name: 'Cheetah', file: '/patterns/cheetah.jpg' },
  { name: 'Tropical', file: '/patterns/tropical.jpg' },
]

type PantsModelProps = {
  texture: THREE.Texture | null
}

function PantsModel({ texture }: PantsModelProps) {
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

  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    pantsScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.material = material
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
  }, [material, pantsScene])

  return <primitive object={pantsScene} />
}

useGLTF.preload('/pants.glb')

export default function App() {
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    setScale(1)
  }, [selectedPattern])

  useEffect(() => {
    if (!selectedPattern) {
      setTexture((prev) => {
        prev?.dispose()
        return null
      })
      return
    }

    let cancelled = false
    const loader = new THREE.TextureLoader()

    loader.load(
      selectedPattern,
      (loadedTexture) => {
        if (cancelled) {
          loadedTexture.dispose()
          return
        }

        loadedTexture.wrapS = THREE.RepeatWrapping
        loadedTexture.wrapT = THREE.RepeatWrapping
        loadedTexture.repeat.set(1, 1)
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

  return (
<div className="app">
      <aside className="sidebar">
        <div>
          <h1 className="app-title">Pattern Library</h1>
          <p className="app-subtitle">Select a pattern to preview it on the garment.</p>
        </div>

        <div className="pattern-buttons">
          {PATTERNS.map((pattern) => {
            const isSelected = selectedPattern === pattern.file || (!selectedPattern && pattern.file === null)
            return (
              <button
                key={pattern.name}
                type="button"
                className={`pattern-button${isSelected ? ' pattern-button--active' : ''}`}
                onClick={() => setSelectedPattern(pattern.file)}
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
            disabled={!selectedPattern}
          />
        </div>
      </aside>

      <main className="viewer">
        <div className="canvas-wrapper">
          <Canvas camera={{ position: [0, 1.5, 3], fov: 50 }} shadows>
            <color attach="background" args={['#f3f4f6']} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[5, 5, 5]} intensity={1.1} castShadow />

            <Bounds fit clip observe margin={1.1}>
              <PantsModel texture={texture} />
            </Bounds>

            <gridHelper args={[10, 10]} />
            <axesHelper args={[5]} />

            <OrbitControls makeDefault />
          </Canvas>
        </div>
      </main>
    </div>
  )
}
