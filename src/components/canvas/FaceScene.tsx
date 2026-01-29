'use client'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { Suspense } from 'react'
import FaceModel from './FaceModel'

interface FaceSceneProps {
  isSpeaking: boolean;
  faceCoords: { x: number; y: number };
}

export default function FaceScene({ isSpeaking, faceCoords }: FaceSceneProps) {
  return (
    <Canvas camera={{ position: [0, 0, 4.5], fov: 80 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={1} />
      <Suspense fallback={null}>
        <FaceModel isSpeaking={isSpeaking} faceCoords={faceCoords} />
      </Suspense>
      <Environment preset="city" />
    </Canvas>
  )
}