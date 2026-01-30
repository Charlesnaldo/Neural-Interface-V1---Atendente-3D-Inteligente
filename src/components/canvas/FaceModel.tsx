'use client'

import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { MeshoptDecoder } from 'meshoptimizer'
import { KTX2Loader } from 'three-stdlib'
import { useThree, useFrame } from '@react-three/fiber'

const MODEL_URL = '/models/facecap.glb'

interface FaceModelProps {
  isSpeaking: boolean;
  loading: boolean;
  faceCoords: { x: number; y: number };
  expression: 'neutral' | 'smile' | 'sad';
}

export default function FaceModel({ isSpeaking, loading, faceCoords, expression }: FaceModelProps) {
  const { gl } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const headMeshesRef = useRef<THREE.Mesh[]>([])

  // Loaders configurados
  const { scene, animations } = useGLTF(MODEL_URL, undefined, undefined, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder)
    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/libs/basis/')
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  })

  const { actions } = useAnimations(animations, scene)

  useEffect(() => {
    if (scene) {
      headMeshesRef.current = []
      Object.values(actions).forEach(action => action?.stop())
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).morphTargetDictionary) {
          headMeshesRef.current.push(obj as THREE.Mesh)
        }
      })
    }
  }, [scene, actions])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const fx = faceCoords?.x ?? 0.5
    const fy = faceCoords?.y ?? 0.5

    if (groupRef.current) {
      // 0. RESPIRAÇÃO E MICRO-MOVIMENTOS Posturais
      const breath = Math.sin(t * 1.2) * 0.02
      const jitterX = Math.sin(t * 2.5) * 0.002
      const jitterY = Math.cos(t * 2.0) * 0.002

      const targetRotY = (fx - 0.5) * -1.0 + jitterY
      const targetRotX = (fy - 0.5) * 0.6 + jitterX + breath

      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.08)
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.08)
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, breath * 0.2, 0.05)
    }

    headMeshesRef.current.forEach((mesh) => {
      const influences = mesh.morphTargetInfluences
      const dict = mesh.morphTargetDictionary
      if (!influences || !dict) return

      // --- Sincronia de Tempo (Speech & Emotion) ---
      const s = isSpeaking ? Math.abs(Math.sin(t * 12)) : 0 // Ritmo rápido (fonemas)
      const sSlow = isSpeaking ? Math.abs(Math.sin(t * 4)) : 0 // Ritmo lento (expressão)
      const sMed = isSpeaking ? Math.abs(Math.sin(t * 8)) : 0 // Ritmo médio

      // --- 1. OLHOS E PISCADA (Principais) ---
      // Piscada natural rápida
      const blinkBase = Math.sin(t * 0.4) + Math.sin(t * 2.0) + Math.sin(t * 5.0)
      const isBlinking = blinkBase > 2.5
      const blinkTarget = isBlinking ? 1 : 0
      if (dict['eyeBlink_L'] !== undefined) influences[dict['eyeBlink_L']] = THREE.MathUtils.lerp(influences[dict['eyeBlink_L']], blinkTarget, isBlinking ? 0.9 : 0.2)
      if (dict['eyeBlink_R'] !== undefined) influences[dict['eyeBlink_R']] = THREE.MathUtils.lerp(influences[dict['eyeBlink_R']], blinkTarget, isBlinking ? 0.9 : 0.2)

      // --- EYE TRACKING & THINKING ---
      let targetLookX = (fx - 0.5) * 2.0
      let targetLookY = (fy - 0.5) * -2.0

      // Se estiver pensando (loading), olhos movem erraticamente para simular processamento
      if (loading) {
        targetLookX = Math.sin(t * 2) * 0.5
        targetLookY = 0.5 + Math.cos(t * 1.5) * 0.3
      }

      // Aplicar Eye Tracking (Vertical)
      if (dict['eyeLookUp_L'] !== undefined) influences[dict['eyeLookUp_L']] = THREE.MathUtils.lerp(influences[dict['eyeLookUp_L']], targetLookY > 0 ? targetLookY : 0, 0.1)
      if (dict['eyeLookUp_R'] !== undefined) influences[dict['eyeLookUp_R']] = THREE.MathUtils.lerp(influences[dict['eyeLookUp_R']], targetLookY > 0 ? targetLookY : 0, 0.1)
      if (dict['eyeLookDown_L'] !== undefined) influences[dict['eyeLookDown_L']] = THREE.MathUtils.lerp(influences[dict['eyeLookDown_L']], targetLookY < 0 ? -targetLookY : 0, 0.1)
      if (dict['eyeLookDown_R'] !== undefined) influences[dict['eyeLookDown_R']] = THREE.MathUtils.lerp(influences[dict['eyeLookDown_R']], targetLookY < 0 ? -targetLookY : 0, 0.1)

      // Aplicar Eye Tracking (Horizontal)
      if (dict['eyeLookOut_L'] !== undefined) influences[dict['eyeLookOut_L']] = THREE.MathUtils.lerp(influences[dict['eyeLookOut_L']], targetLookX < 0 ? -targetLookX : 0, 0.1)
      if (dict['eyeLookIn_L'] !== undefined) influences[dict['eyeLookIn_L']] = THREE.MathUtils.lerp(influences[dict['eyeLookIn_L']], targetLookX > 0 ? targetLookX : 0, 0.1)
      if (dict['eyeLookIn_R'] !== undefined) influences[dict['eyeLookIn_R']] = THREE.MathUtils.lerp(influences[dict['eyeLookIn_R']], targetLookX < 0 ? -targetLookX : 0, 0.1)
      if (dict['eyeLookOut_R'] !== undefined) influences[dict['eyeLookOut_R']] = THREE.MathUtils.lerp(influences[dict['eyeLookOut_R']], targetLookX > 0 ? targetLookX : 0, 0.1)

      // --- 2. GESTAO DE EMOCOES (Smile / Sad / Neutral) ---
      let baseSmile = 0.2
      let baseFrown = 0
      let baseBrowSad = 0

      if (expression === 'smile') {
        baseSmile = 0.7
      } else if (expression === 'sad') {
        baseSmile = 0
        baseFrown = 0.6
        baseBrowSad = 0.4
      } else {
        baseSmile = 0.3 // Standby neutro
      }

      const finalSmile = baseSmile + (isSpeaking ? sSlow * 0.2 : 0)
      const finalFrown = baseFrown + (isSpeaking ? sSlow * 0.1 : 0)

      if (dict['mouthSmile_L'] !== undefined) influences[dict['mouthSmile_L']] = THREE.MathUtils.lerp(influences[dict['mouthSmile_L']], finalSmile, 0.1)
      if (dict['mouthSmile_R'] !== undefined) influences[dict['mouthSmile_R']] = THREE.MathUtils.lerp(influences[dict['mouthSmile_R']], finalSmile, 0.1)
      if (dict['mouthFrown_L'] !== undefined) influences[dict['mouthFrown_L']] = THREE.MathUtils.lerp(influences[dict['mouthFrown_L']], finalFrown, 0.1)
      if (dict['mouthFrown_R'] !== undefined) influences[dict['mouthFrown_R']] = THREE.MathUtils.lerp(influences[dict['mouthFrown_R']], finalFrown, 0.1)

      // Squint/Bochecha acompanhando a emoção (Padrão ARKit)
      const targetSquint = finalSmile * 0.6 + (isSpeaking ? sSlow * 0.2 : 0)
      if (dict['eyeSquint_L'] !== undefined) influences[dict['eyeSquint_L']] = THREE.MathUtils.lerp(influences[dict['eyeSquint_L']], targetSquint, 0.1)
      if (dict['eyeSquint_R'] !== undefined) influences[dict['eyeSquint_R']] = THREE.MathUtils.lerp(influences[dict['eyeSquint_R']], targetSquint, 0.1)
      if (dict['cheekSquint_L'] !== undefined) influences[dict['cheekSquint_L']] = THREE.MathUtils.lerp(influences[dict['cheekSquint_L']], targetSquint * 0.8, 0.1)
      if (dict['cheekSquint_R'] !== undefined) influences[dict['cheekSquint_R']] = THREE.MathUtils.lerp(influences[dict['cheekSquint_R']], targetSquint * 0.8, 0.1)

      // --- 3. FALA E LIPSINC (Jaw & Mouth Shapes) ---
      if (dict['jawOpen'] !== undefined) {
        const targetJaw = isSpeaking ? (s * 0.6) : 0.02
        influences[dict['jawOpen']] = THREE.MathUtils.lerp(influences[dict['jawOpen']], targetJaw, 0.3)
      }
      // Shapes de vogais e tensão (Funnel/Pucker/Stretch)
      if (dict['mouthFunnel'] !== undefined) influences[dict['mouthFunnel']] = THREE.MathUtils.lerp(influences[dict['mouthFunnel']], isSpeaking ? sMed * 0.4 : 0, 0.2)
      if (dict['mouthPucker'] !== undefined) influences[dict['mouthPucker']] = THREE.MathUtils.lerp(influences[dict['mouthPucker']], isSpeaking ? s * 0.2 : 0, 0.15)
      if (dict['mouthStretch_L'] !== undefined) influences[dict['mouthStretch_L']] = THREE.MathUtils.lerp(influences[dict['mouthStretch_L']], isSpeaking ? sSlow * 0.2 : 0, 0.1)
      if (dict['mouthStretch_R'] !== undefined) influences[dict['mouthStretch_R']] = THREE.MathUtils.lerp(influences[dict['mouthStretch_R']], isSpeaking ? sSlow * 0.2 : 0, 0.1)

      // Relaxamento do lábio superior (evitar visual de mordida)
      if (dict['mouthUpperUp_L'] !== undefined) influences[dict['mouthUpperUp_L']] = THREE.MathUtils.lerp(influences[dict['mouthUpperUp_L']], 0.15, 0.05)
      if (dict['mouthUpperUp_R'] !== undefined) influences[dict['mouthUpperUp_R']] = THREE.MathUtils.lerp(influences[dict['mouthUpperUp_R']], 0.15, 0.05)

      // --- 4. SOBRANCELHAS (Expressividade) ---
      let browTarget = baseBrowSad + (isSpeaking ? sSlow * 0.4 : 0.1)
      if (loading) browTarget = 0.5 + Math.sin(t * 5) * 0.2 // Sobrancelha "pensativa" (inquietude)

      if (dict['browInnerUp'] !== undefined) influences[dict['browInnerUp']] = THREE.MathUtils.lerp(influences[dict['browInnerUp']], browTarget, 0.1)
      if (dict['browOuterUp_L'] !== undefined) influences[dict['browOuterUp_L']] = THREE.MathUtils.lerp(influences[dict['browOuterUp_L']], isSpeaking ? sSlow * 0.3 : 0, 0.08)
      if (dict['browOuterUp_R'] !== undefined) influences[dict['browOuterUp_R']] = THREE.MathUtils.lerp(influences[dict['browOuterUp_R']], isSpeaking ? sSlow * 0.3 : 0, 0.08)

      // --- 5. MICRO-DETALHES (Nose & Tongue) ---
      if (dict['noseSneer_L'] !== undefined) influences[dict['noseSneer_L']] = THREE.MathUtils.lerp(influences[dict['noseSneer_L']], isSpeaking ? sMed * 0.1 : 0, 0.1)
      if (dict['noseSneer_R'] !== undefined) influences[dict['noseSneer_R']] = THREE.MathUtils.lerp(influences[dict['noseSneer_R']], isSpeaking ? sMed * 0.1 : 0, 0.1)
    })
  })

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={2.4} />
    </group>
  )
}