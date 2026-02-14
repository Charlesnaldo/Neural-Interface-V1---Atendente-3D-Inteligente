'use client'
import { Canvas } from '@react-three/fiber'
import { Environment, ContactShadows } from '@react-three/drei'
import { Suspense } from 'react'
import * as THREE from 'three'
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import FaceModel from './FaceModel'

export interface FaceSceneProps {
  isSpeaking: boolean;
  loading: boolean;
  faceCoords: { x: number; y: number };
  expression: 'neutral' | 'smile' | 'sad';
  audioMetrics: { amplitude: number; sharpness: number };
}

export default function FaceScene({ isSpeaking, loading, faceCoords, expression, audioMetrics }: FaceSceneProps) {
  return (
    <Canvas camera={{ position: [0, 0, 4.5], fov: 80 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={1} />
      <Suspense fallback={null}>
        <FaceModel isSpeaking={isSpeaking} loading={loading} faceCoords={faceCoords} expression={expression} audioMetrics={audioMetrics} />
      </Suspense>
      <Environment preset="city" />

      <EffectComposer>
        <Bloom luminanceThreshold={1} luminanceSmoothing={0.9} height={300} intensity={0.5} />
        <ChromaticAberration offset={new THREE.Vector2(0.001, 0.001)} />
      </EffectComposer>
    </Canvas>
  )
}
