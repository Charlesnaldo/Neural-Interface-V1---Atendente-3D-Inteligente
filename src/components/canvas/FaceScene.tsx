// src/components/canvas/FaceScene.tsx
import { Canvas } from '@react-three/fiber'
import { Environment, ContactShadows } from '@react-three/drei'
import FaceModel from './FaceModel'

export default function FaceScene({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <Canvas 
      // O fov 30 é ótimo para retratos (evita distorcer o nariz)
      camera={{ position: [0, 0, 4.5], fov: 90 }} 
      // Garante que o Canvas preencha a DIV circular da interface
      style={{ width: '100%', height: '100%' }}
    >
      {/* Luz ambiente suave */}
      <ambientLight intensity={0.8} />
      
      {/* Luz direcional para criar sombras no rosto e dar volume */}
      <pointLight position={[5, 5, 5]} intensity={1.5} />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#3b82f6" />

      {/* O Modelo Centralizado */}
      <FaceModel isSpeaking={isSpeaking} />

      {/* Reflexos realistas (o preset 'city' ou 'night' ajuda muito no brilho dos olhos) */}
      <Environment preset="city" />

      {/* Sombra suave no chão (opcional, se o modelo tiver corpo/pescoço longo) */}
      <ContactShadows opacity={0.4} scale={5} blur={2} far={1} />
    </Canvas>
  )
}