import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Bounds } from '@react-three/drei'
import * as THREE from 'three'

function PantsModel() {
  const { scene } = useGLTF('/pants.glb')
  return <primitive object={scene} />
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas camera={{ position: [0, 1, 3], fov: 50 }}>
        <color attach="background" args={['#f0f0f0']} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        
        <Bounds fit clip observe margin={1.2}>
          <PantsModel />
        </Bounds>

        <gridHelper args={[10, 10]} />
        <axesHelper args={[5]} />

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
