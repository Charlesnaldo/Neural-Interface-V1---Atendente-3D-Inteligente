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
  audioMetrics: { amplitude: number; sharpness: number };
}

export default function FaceModel({ isSpeaking, loading, faceCoords, expression, audioMetrics }: FaceModelProps) {
  const { gl } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const headMeshesRef = useRef<THREE.Mesh[]>([])
  const audioMetricsRef = useRef(audioMetrics)
  const blinkState = useRef({ value: 0, active: false, timer: Math.random() * 3 + 2 })
  const saccadeState = useRef({
    currentX: 0,
    currentY: 0,
    targetX: 0,
    targetY: 0,
    timer: Math.random() * 2 + 0.5,
  })
  const headIdle = useRef({
    rotX: 0,
    rotY: 0,
    targetX: 0,
    targetY: 0,
    timer: Math.random() * 3 + 2,
  })

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

  useEffect(() => {
    audioMetricsRef.current = audioMetrics
  }, [audioMetrics])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const delta = Math.min(0.06, state.clock.getDelta())
    const fx = faceCoords?.x ?? 0.5
    const fy = faceCoords?.y ?? 0.5
    const metrics = audioMetricsRef.current ?? { amplitude: 0, sharpness: 0 }
    const voiceEnergy = isSpeaking ? THREE.MathUtils.clamp(0.2 + metrics.amplitude * 0.5, 0, 1) : 0
    const voiceSharpness = isSpeaking ? THREE.MathUtils.clamp(metrics.sharpness * 1.1, 0, 1) : 0

    const blink = blinkState.current
    blink.timer -= delta
    if (blink.timer <= 0 && !blink.active) {
      blink.active = true
      blink.timer = 0.08
    }
    const blinkTarget = blink.active ? 1 : 0
    blink.value = THREE.MathUtils.damp(blink.value, blinkTarget, 0.5, delta * 60)
    if (blink.active && blink.value > 0.92) {
      blink.active = false
      blink.timer = Math.random() * 3 + 1.5
    }

    const saccade = saccadeState.current
    saccade.timer -= delta
    if (saccade.timer <= 0) {
      saccade.targetX = (Math.random() - 0.5) * 0.5
      saccade.targetY = (Math.random() - 0.5) * 0.35
      saccade.timer = Math.random() * 1.4 + 0.4
    }
    saccade.currentX = THREE.MathUtils.damp(saccade.currentX, saccade.targetX, 0.08, delta * 60)
    saccade.currentY = THREE.MathUtils.damp(saccade.currentY, saccade.targetY, 0.09, delta * 60)

    const headIdleState = headIdle.current
    headIdleState.timer -= delta
    if (headIdleState.timer <= 0) {
      headIdleState.targetX = (Math.random() - 0.5) * 0.06
      headIdleState.targetY = (Math.random() - 0.5) * 0.05
      headIdleState.timer = Math.random() * 3 + 2
    }
    headIdleState.rotX = THREE.MathUtils.damp(headIdleState.rotX, headIdleState.targetX, 0.04, delta * 60)
    headIdleState.rotY = THREE.MathUtils.damp(headIdleState.rotY, headIdleState.targetY, 0.05, delta * 60)

    if (groupRef.current) {
      // 0. RESPIRAÇÃO E MICRO-MOVIMENTOS Posturais
      const breath = Math.sin(t * 1.2) * 0.02
      const jitterX = Math.sin(t * 2.5) * 0.002
      const jitterY = Math.cos(t * 2.0) * 0.002

      const targetRotY = (fx - 0.5) * -1.0 + jitterY
      const targetRotX = (fy - 0.5) * 0.6 + jitterX + breath
      const finalRotY = targetRotY + headIdleState.rotY
      const finalRotX = targetRotX + headIdleState.rotX

      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, finalRotY, 0.08)
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, finalRotX, 0.08)
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
      const blinkStrength = THREE.MathUtils.clamp(blink.value + voiceSharpness * 0.15, 0, 1)
      if (dict['eyeBlink_L'] !== undefined) influences[dict['eyeBlink_L']] = THREE.MathUtils.lerp(influences[dict['eyeBlink_L']], blinkStrength, 0.5)
      if (dict['eyeBlink_R'] !== undefined) influences[dict['eyeBlink_R']] = THREE.MathUtils.lerp(influences[dict['eyeBlink_R']], blinkStrength, 0.5)

      // --- EYE TRACKING & THINKING ---
      let targetLookX = (fx - 0.5) * 2.0
      let targetLookY = (fy - 0.5) * -2.0

      // Se estiver pensando (loading), olhos movem erraticamente para simular processamento
      if (loading) {
        targetLookX = Math.sin(t * 2) * 0.5
        targetLookY = 0.5 + Math.cos(t * 1.5) * 0.3
      }

      targetLookX += saccade.currentX
      targetLookY += saccade.currentY

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

      const finalSmile = baseSmile + (isSpeaking ? sSlow * 0.2 + voiceEnergy * 0.1 : 0)
      const finalFrown = baseFrown + (isSpeaking ? sSlow * 0.1 : 0)

      if (dict['mouthSmile_L'] !== undefined) influences[dict['mouthSmile_L']] = THREE.MathUtils.lerp(influences[dict['mouthSmile_L']], finalSmile, 0.1)
      if (dict['mouthSmile_R'] !== undefined) influences[dict['mouthSmile_R']] = THREE.MathUtils.lerp(influences[dict['mouthSmile_R']], finalSmile, 0.1)
      if (dict['mouthFrown_L'] !== undefined) influences[dict['mouthFrown_L']] = THREE.MathUtils.lerp(influences[dict['mouthFrown_L']], finalFrown, 0.1)
      if (dict['mouthFrown_R'] !== undefined) influences[dict['mouthFrown_R']] = THREE.MathUtils.lerp(influences[dict['mouthFrown_R']], finalFrown, 0.1)

      // Squint/Bochecha acompanhando a emoção (Padrão ARKit)
      const targetSquint = finalSmile * 0.6 + (isSpeaking ? sSlow * 0.2 + voiceSharpness * 0.15 : 0)
      if (dict['eyeSquint_L'] !== undefined) influences[dict['eyeSquint_L']] = THREE.MathUtils.lerp(influences[dict['eyeSquint_L']], targetSquint, 0.1)
      if (dict['eyeSquint_R'] !== undefined) influences[dict['eyeSquint_R']] = THREE.MathUtils.lerp(influences[dict['eyeSquint_R']], targetSquint, 0.1)
      if (dict['cheekSquint_L'] !== undefined) influences[dict['cheekSquint_L']] = THREE.MathUtils.lerp(influences[dict['cheekSquint_L']], targetSquint * 0.8, 0.1)
      if (dict['cheekSquint_R'] !== undefined) influences[dict['cheekSquint_R']] = THREE.MathUtils.lerp(influences[dict['cheekSquint_R']], targetSquint * 0.8, 0.1)

      // --- 3. FALA E LIPSINC (Jaw & Mouth Shapes) ---
      if (dict['jawOpen'] !== undefined) {
        const targetJaw = isSpeaking ? 0.03 + s * 0.2 : 0.02
        influences[dict['jawOpen']] = THREE.MathUtils.lerp(influences[dict['jawOpen']], targetJaw, 0.3)
      }
      // Shapes de vogais e tensão (Funnel/Pucker/Stretch)
      if (dict['mouthFunnel'] !== undefined) {
        const target = isSpeaking
          ? THREE.MathUtils.lerp(sMed * 0.4, voiceEnergy * 0.3, 0.6)
          : 0
        influences[dict['mouthFunnel']] = THREE.MathUtils.lerp(influences[dict['mouthFunnel']], target, 0.2)
      }
      if (dict['mouthPucker'] !== undefined) {
        const target = isSpeaking
          ? THREE.MathUtils.lerp(s * 0.2, voiceEnergy * 0.3, 0.6)
          : 0
        influences[dict['mouthPucker']] = THREE.MathUtils.lerp(influences[dict['mouthPucker']], target, 0.15)
      }
      if (dict['mouthStretch_L'] !== undefined) {
        const target = isSpeaking
          ? THREE.MathUtils.lerp(sSlow * 0.2, voiceEnergy * 0.35, 0.5)
          : 0
        influences[dict['mouthStretch_L']] = THREE.MathUtils.lerp(influences[dict['mouthStretch_L']], target, 0.1)
      }
      if (dict['mouthStretch_R'] !== undefined) {
        const target = isSpeaking
          ? THREE.MathUtils.lerp(sSlow * 0.2, voiceEnergy * 0.35, 0.5)
          : 0
        influences[dict['mouthStretch_R']] = THREE.MathUtils.lerp(influences[dict['mouthStretch_R']], target, 0.1)
      }

      // Relaxamento do lábio superior (evitar visual de mordida)
      if (dict['mouthUpperUp_L'] !== undefined) influences[dict['mouthUpperUp_L']] = THREE.MathUtils.lerp(influences[dict['mouthUpperUp_L']], 0.15, 0.05)
      if (dict['mouthUpperUp_R'] !== undefined) influences[dict['mouthUpperUp_R']] = THREE.MathUtils.lerp(influences[dict['mouthUpperUp_R']], 0.15, 0.05)

      // --- 4. SOBRANCELHAS (Expressividade) ---
      let browTarget = baseBrowSad + (isSpeaking ? sSlow * 0.4 + voiceEnergy * 0.15 : 0.1)
      if (loading) browTarget = 0.5 + Math.sin(t * 5) * 0.2 // Sobrancelha "pensativa" (inquietude)

      const browInnerTarget = Math.min(1, browTarget + voiceEnergy * 0.2)
      if (dict['browInnerUp'] !== undefined) influences[dict['browInnerUp']] = THREE.MathUtils.lerp(influences[dict['browInnerUp']], browInnerTarget, 0.1)
      const browOuterTarget = isSpeaking
        ? THREE.MathUtils.lerp(sSlow * 0.3, voiceEnergy * 0.4, 0.45)
        : 0
      if (dict['browOuterUp_L'] !== undefined) influences[dict['browOuterUp_L']] = THREE.MathUtils.lerp(influences[dict['browOuterUp_L']], browOuterTarget, 0.08)
      if (dict['browOuterUp_R'] !== undefined) influences[dict['browOuterUp_R']] = THREE.MathUtils.lerp(influences[dict['browOuterUp_R']], browOuterTarget, 0.08)

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
