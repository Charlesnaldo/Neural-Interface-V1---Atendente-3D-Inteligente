'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei'
import { Suspense } from 'react'
import FaceModel from './FaceModel'

export default function FaceScene() {
  return (
    <Canvas shadows dpr={[1, 2]}>
      <Suspense fallback={null}>
        {/* Posicionamento de câmera similar ao exemplo original */}
        <PerspectiveCamera makeDefault position={[0, 0, 4]} fov={45} />
        
        {/* Luz ambiente e reflexos de estúdio */}
        <Environment preset="city" /> 
        
        <FaceModel />

        {/* Sombra suave no chão para dar profundidade */}
        <ContactShadows opacity={0.4} scale={10} blur={2} far={4.5} />

        <OrbitControls 
          enableDamping 
          target={[0, 0.1, 0]}
          minDistance={2}
          maxDistance={6}
        />
      </Suspense>
    </Canvas>
  )
}