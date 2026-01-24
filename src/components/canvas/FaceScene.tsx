'use client'

import { Canvas } from '@react-three/fiber'
import FaceModel from './FaceModel' // Ajuste o caminho se necessário
import { Environment, OrbitControls } from '@react-three/drei'

// Definimos a interface para o TypeScript parar de reclamar
interface FaceSceneProps {
  isSpeaking: boolean
}

export default function FaceScene({ isSpeaking }: FaceSceneProps) {
  return (
    <Canvas camera={{ position: [0, 0, 4], fov: 35 }}>
      <ambientLight intensity={1.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
      <pointLight position={[-10, -10, -10]} />
      
      <FaceModel isSpeaking={isSpeaking} />
      
      <Environment preset="city" />
      <OrbitControls 
        enablePan={false} 
        enableZoom={false} 
        minPolarAngle={Math.PI / 2.2} 
        maxPolarAngle={Math.PI / 2.2} 
      />
    </Canvas>
  )
}