import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const PANTS_PATCH_NAME_HINTS = ['object_9']
const PANTS_PATCH_ACTION: 'hide' | 'neutral-material' = 'hide'

export type LightingPreset = 'studioSoft' | 'flat' | 'dramatic'

type PantsModelProps = {
  texture: THREE.Texture | null
  onLoaded?: () => void
}

export function PantsModel({ texture, onLoaded }: PantsModelProps) {
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

type StudioLightsProps = {
  preset: LightingPreset
}

export function StudioLights({ preset }: StudioLightsProps) {
  if (preset === 'flat') {
    return (
      <>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 4, 2]} intensity={0.6} />
      </>
    )
  }

  if (preset === 'dramatic') {
    return (
      <>
        <ambientLight intensity={0.2} />
        <directionalLight position={[4, 5, 2]} intensity={1.4} castShadow />
        <directionalLight position={[-3, 3, -4]} intensity={0.9} />
      </>
    )
  }

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 2]} intensity={0.9} castShadow />
      <directionalLight position={[-3, 2, 3]} intensity={0.5} />
      <directionalLight position={[0, 3, -4]} intensity={0.6} />
    </>
  )
}

type RendererBackgroundProps = {
  transparent: boolean
}

export function RendererBackground({ transparent }: RendererBackgroundProps) {
  const { gl } = useThree()

  useEffect(() => {
    if (transparent) {
      gl.setClearColor('#000000', 0)
      return
    }

    gl.setClearColor('#f3f4f6', 1)
  }, [gl, transparent])

  return null
}

useGLTF.preload('/pants.glb')
