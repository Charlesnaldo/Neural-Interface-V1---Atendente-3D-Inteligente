'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { MeshoptDecoder } from 'meshoptimizer'
import { KTX2Loader } from 'three-stdlib'
import { useThree, useFrame } from '@react-three/fiber'

const MODEL_URL = '/models/facecap.glb'

interface FaceModelProps {
  isSpeaking: boolean
  loading: boolean
  faceCoords: { x: number; y: number }
  expression: 'neutral' | 'smile' | 'sad'
  audioMetrics: {
    amplitude: number
    sharpness: number
    low: number
    mid: number
    high: number
    dominantBand: 'low' | 'mid' | 'high'
  }
}

export default function FaceModel({ isSpeaking, loading, faceCoords, expression, audioMetrics }: FaceModelProps) {
  const { gl } = useThree()
  const [timingSeed] = useState(() => ({
    blink: Math.random() * 3 + 2,
    microBlink: Math.random() * 6 + 4,
    saccade: Math.random() * 2 + 0.5,
    headIdle: Math.random() * 3 + 2,
    browTimer: Math.random() * 2 + 1,
    breathPhase: Math.random() * Math.PI * 2,
  }))
  const groupRef = useRef<THREE.Group>(null)
  const headMeshesRef = useRef<THREE.Mesh[]>([])
  const audioMetricsRef = useRef(audioMetrics)
  const blinkState = useRef({ value: 0, active: false, timer: timingSeed.blink })
  const microBlinkState = useRef({
    value: 0,
    active: false,
    timer: timingSeed.microBlink,
  })
  const saccadeState = useRef({
    currentX: 0,
    currentY: 0,
    targetX: 0,
    targetY: 0,
    timer: timingSeed.saccade,
  })
  const headIdle = useRef({
    rotX: 0,
    rotY: 0,
    targetX: 0,
    targetY: 0,
    timer: timingSeed.headIdle,
  })
  const browMotion = useRef({
    left: 0,
    right: 0,
    pulse: 0,
    timer: timingSeed.browTimer,
    drift: 0,
  })
  const breathState = useRef({
    amplitude: 0.011,
    phase: timingSeed.breathPhase,
    targetAmplitude: 0.011,
    timer: 4,
  })
  const visemeState = useRef({
    aa: 0,
    e: 0,
    oo: 0,
    fv: 0,
    mbp: 0,
  })
  const expressionState = useRef({
    smile: 0.3,
    frown: 0,
    browSad: 0,
  })

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
    const metrics = audioMetricsRef.current ?? { amplitude: 0, sharpness: 0, low: 0, mid: 0, high: 0, dominantBand: 'mid' as const }
    const voiceEnergy = isSpeaking ? THREE.MathUtils.clamp(0.24 + metrics.amplitude * 0.64, 0, 1) : 0
    const voiceSharpness = isSpeaking ? THREE.MathUtils.clamp(metrics.sharpness * 1.18, 0, 1) : 0
    const speechPulse = isSpeaking ? Math.abs(Math.sin(t * (7.2 + metrics.high * 3.4))) : 0

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

    const microBlink = microBlinkState.current
    microBlink.timer -= delta
    if (microBlink.timer <= 0 && !microBlink.active) {
      microBlink.active = true
      microBlink.timer = Math.random() * 0.14 + 0.08
    }
    const microBlinkTarget = microBlink.active ? 0.45 : 0
    microBlink.value = THREE.MathUtils.damp(microBlink.value, microBlinkTarget, 0.35, delta * 60)
    if (microBlink.active && microBlink.value > 0.38) {
      microBlink.active = false
      microBlink.timer = Math.random() * 5.5 + 3.5
    }

    const saccade = saccadeState.current
    saccade.timer -= delta
    if (saccade.timer <= 0) {
      saccade.targetX = (Math.random() - 0.5) * 0.4
      saccade.targetY = (Math.random() - 0.5) * 0.28
      saccade.timer = Math.random() * 1.4 + 0.55
    }
    saccade.currentX = THREE.MathUtils.damp(saccade.currentX, saccade.targetX, 0.075, delta * 60)
    saccade.currentY = THREE.MathUtils.damp(saccade.currentY, saccade.targetY, 0.08, delta * 60)

    const headIdleState = headIdle.current
    headIdleState.timer -= delta
    if (headIdleState.timer <= 0) {
      headIdleState.targetX = (Math.random() - 0.5) * 0.05
      headIdleState.targetY = (Math.random() - 0.5) * 0.045
      headIdleState.timer = Math.random() * 3.2 + 1.8
    }
    headIdleState.rotX = THREE.MathUtils.damp(headIdleState.rotX, headIdleState.targetX, 0.04, delta * 60)
    headIdleState.rotY = THREE.MathUtils.damp(headIdleState.rotY, headIdleState.targetY, 0.045, delta * 60)

    if (groupRef.current) {
      const breath = Math.sin(t * 1.18 + breathState.current.phase) * breathState.current.amplitude
      const jitterX = Math.sin(t * 2.5) * 0.002
      const jitterY = Math.cos(t * 2.0) * 0.002

      const targetRotY = (fx - 0.5) * -1.0 + jitterY
      const targetRotX = (fy - 0.5) * 0.6 + jitterX + breath
      const finalRotY = targetRotY + headIdleState.rotY
      const finalRotX = targetRotX + headIdleState.rotX

      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, finalRotY, 0.08)
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, finalRotX, 0.08)
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, breath * 0.26, 0.04)
    }

    headMeshesRef.current.forEach((mesh) => {
      const influences = mesh.morphTargetInfluences
      const dict = mesh.morphTargetDictionary
      if (!influences || !dict) return

      const blinkStrength = THREE.MathUtils.clamp(blink.value + microBlink.value + voiceSharpness * 0.14, 0, 1)
      if (dict['eyeBlink_L'] !== undefined) influences[dict['eyeBlink_L']] = THREE.MathUtils.lerp(influences[dict['eyeBlink_L']], blinkStrength, 0.5)
      if (dict['eyeBlink_R'] !== undefined) influences[dict['eyeBlink_R']] = THREE.MathUtils.lerp(influences[dict['eyeBlink_R']], blinkStrength, 0.5)

      let targetLookX = (fx - 0.5) * 2.0
      let targetLookY = (fy - 0.5) * -2.0

      if (loading) {
        targetLookX = Math.sin(t * 2) * 0.5
        targetLookY = 0.5 + Math.cos(t * 1.5) * 0.3
      }

      targetLookX += saccade.currentX
      targetLookY += saccade.currentY

      if (dict['eyeLookUp_L'] !== undefined) influences[dict['eyeLookUp_L']] = THREE.MathUtils.lerp(influences[dict['eyeLookUp_L']], targetLookY > 0 ? targetLookY : 0, 0.1)
      if (dict['eyeLookUp_R'] !== undefined) influences[dict['eyeLookUp_R']] = THREE.MathUtils.lerp(influences[dict['eyeLookUp_R']], targetLookY > 0 ? targetLookY : 0, 0.1)
      if (dict['eyeLookDown_L'] !== undefined) influences[dict['eyeLookDown_L']] = THREE.MathUtils.lerp(influences[dict['eyeLookDown_L']], targetLookY < 0 ? -targetLookY : 0, 0.1)
      if (dict['eyeLookDown_R'] !== undefined) influences[dict['eyeLookDown_R']] = THREE.MathUtils.lerp(influences[dict['eyeLookDown_R']], targetLookY < 0 ? -targetLookY : 0, 0.1)

      if (dict['eyeLookOut_L'] !== undefined) influences[dict['eyeLookOut_L']] = THREE.MathUtils.lerp(influences[dict['eyeLookOut_L']], targetLookX < 0 ? -targetLookX : 0, 0.1)
      if (dict['eyeLookIn_L'] !== undefined) influences[dict['eyeLookIn_L']] = THREE.MathUtils.lerp(influences[dict['eyeLookIn_L']], targetLookX > 0 ? targetLookX : 0, 0.1)
      if (dict['eyeLookIn_R'] !== undefined) influences[dict['eyeLookIn_R']] = THREE.MathUtils.lerp(influences[dict['eyeLookIn_R']], targetLookX < 0 ? -targetLookX : 0, 0.1)
      if (dict['eyeLookOut_R'] !== undefined) influences[dict['eyeLookOut_R']] = THREE.MathUtils.lerp(influences[dict['eyeLookOut_R']], targetLookX > 0 ? targetLookX : 0, 0.1)

      const browMotionState = browMotion.current
      browMotionState.timer -= delta
      if (browMotionState.timer <= 0) {
        browMotionState.pulse = Math.random() * 0.5 + t * 0.02
        browMotionState.left = (Math.random() - 0.5) * 0.08
        browMotionState.right = (Math.random() - 0.5) * 0.08
        browMotionState.drift = (Math.random() - 0.5) * 0.04
        browMotionState.timer = Math.random() * 3.8 + 1.6
      }
      const browTalkPulse = isSpeaking ? Math.abs(Math.sin(t * 3.4 + browMotionState.pulse)) * 0.14 : 0
      const browAsymmetry = Math.sin(t * 0.9 + browMotionState.pulse) * 0.02 + browMotionState.drift

      let targetSmile = 0.22
      let targetFrown = 0
      let targetBrowSad = 0

      if (expression === 'smile') {
        targetSmile = 0.62
      } else if (expression === 'sad') {
        targetSmile = 0.05
        targetFrown = 0.42
        targetBrowSad = 0.34
      }

      expressionState.current.smile = THREE.MathUtils.damp(expressionState.current.smile, targetSmile, 0.18, delta * 60)
      expressionState.current.frown = THREE.MathUtils.damp(expressionState.current.frown, targetFrown, 0.18, delta * 60)
      expressionState.current.browSad = THREE.MathUtils.damp(expressionState.current.browSad, targetBrowSad, 0.18, delta * 60)

      const finalSmile = expressionState.current.smile + (isSpeaking ? voiceEnergy * 0.05 : 0)
      const finalFrown = expressionState.current.frown

      if (dict['mouthSmile_L'] !== undefined) influences[dict['mouthSmile_L']] = THREE.MathUtils.lerp(influences[dict['mouthSmile_L']], finalSmile, 0.1)
      if (dict['mouthSmile_R'] !== undefined) influences[dict['mouthSmile_R']] = THREE.MathUtils.lerp(influences[dict['mouthSmile_R']], finalSmile, 0.1)
      if (dict['mouthFrown_L'] !== undefined) influences[dict['mouthFrown_L']] = THREE.MathUtils.lerp(influences[dict['mouthFrown_L']], finalFrown, 0.1)
      if (dict['mouthFrown_R'] !== undefined) influences[dict['mouthFrown_R']] = THREE.MathUtils.lerp(influences[dict['mouthFrown_R']], finalFrown, 0.1)

      const targetSquint = finalSmile * 0.28 + (isSpeaking ? voiceSharpness * 0.146 : 0)
      if (dict['eyeSquint_L'] !== undefined) influences[dict['eyeSquint_L']] = THREE.MathUtils.lerp(influences[dict['eyeSquint_L']], targetSquint, 0.1)
      if (dict['eyeSquint_R'] !== undefined) influences[dict['eyeSquint_R']] = THREE.MathUtils.lerp(influences[dict['eyeSquint_R']], targetSquint, 0.1)
      if (dict['cheekSquint_L'] !== undefined) influences[dict['cheekSquint_L']] = THREE.MathUtils.lerp(influences[dict['cheekSquint_L']], targetSquint * 0.8, 0.1)
      if (dict['cheekSquint_R'] !== undefined) influences[dict['cheekSquint_R']] = THREE.MathUtils.lerp(influences[dict['cheekSquint_R']], targetSquint * 0.8, 0.1)

      const viseme = visemeState.current
      const plosivePulse = isSpeaking ? Math.max(0, Math.sin(t * 10.5 + metrics.low * 7)) * (1 - metrics.amplitude * 0.45) : 0
      const aaTarget = isSpeaking ? THREE.MathUtils.clamp(voiceEnergy * 0.96 + metrics.mid * 0.46 + speechPulse * 0.14, 0, 1) : 0
      const eTarget = isSpeaking ? THREE.MathUtils.clamp(metrics.high * 0.64 + (1 - metrics.low) * 0.16, 0, 0.78) : 0
      const ooTarget = isSpeaking ? THREE.MathUtils.clamp(metrics.low * 0.56 + voiceEnergy * 0.24, 0, 0.7) : 0
      const fvTarget = isSpeaking ? THREE.MathUtils.clamp(metrics.high * 0.58 + voiceSharpness * 0.34, 0, 0.7) : 0
      const mbpTarget = isSpeaking ? THREE.MathUtils.clamp(plosivePulse * 0.96, 0, 0.95) : 0.04

      viseme.aa = THREE.MathUtils.damp(viseme.aa, aaTarget, 0.16, delta * 60)
      viseme.e = THREE.MathUtils.damp(viseme.e, eTarget, 0.16, delta * 60)
      viseme.oo = THREE.MathUtils.damp(viseme.oo, ooTarget, 0.16, delta * 60)
      viseme.fv = THREE.MathUtils.damp(viseme.fv, fvTarget, 0.16, delta * 60)
      viseme.mbp = THREE.MathUtils.damp(viseme.mbp, mbpTarget, 0.2, delta * 60)

      if (dict['jawOpen'] !== undefined) {
        const targetJaw = isSpeaking
          ? THREE.MathUtils.clamp(0.035 + viseme.aa * 0.74 + speechPulse * 0.12 - viseme.mbp * 0.05, 0, 1)
          : 0.01
        influences[dict['jawOpen']] = THREE.MathUtils.lerp(influences[dict['jawOpen']], targetJaw, 0.34)
      }
      if (dict['mouthClose'] !== undefined) {
        const target = isSpeaking ? viseme.mbp * 0.26 : 0.16
        influences[dict['mouthClose']] = THREE.MathUtils.lerp(influences[dict['mouthClose']], target, 0.11)
      }
      if (dict['mouthPress_L'] !== undefined) {
        influences[dict['mouthPress_L']] = THREE.MathUtils.lerp(influences[dict['mouthPress_L']], viseme.mbp * 0.55, 0.2)
      }
      if (dict['mouthPress_R'] !== undefined) {
        influences[dict['mouthPress_R']] = THREE.MathUtils.lerp(influences[dict['mouthPress_R']], viseme.mbp * 0.55, 0.2)
      }
      if (dict['mouthFunnel'] !== undefined) {
        const target = isSpeaking
          ? THREE.MathUtils.clamp(viseme.oo * 0.94 + viseme.fv * 0.14, 0, 0.9)
          : 0
        influences[dict['mouthFunnel']] = THREE.MathUtils.lerp(influences[dict['mouthFunnel']], target, 0.12)
      }
      if (dict['mouthPucker'] !== undefined) {
        const target = isSpeaking
          ? THREE.MathUtils.clamp(viseme.oo * 0.78 + viseme.fv * 0.14, 0, 0.76)
          : 0
        influences[dict['mouthPucker']] = THREE.MathUtils.lerp(influences[dict['mouthPucker']], target, 0.1)
      }
      if (dict['mouthStretch_L'] !== undefined) {
        const target = isSpeaking
          ? THREE.MathUtils.clamp(viseme.e * 0.8 + voiceEnergy * 0.2, 0, 1)
          : 0
        influences[dict['mouthStretch_L']] = THREE.MathUtils.lerp(influences[dict['mouthStretch_L']], target, 0.1)
      }
      if (dict['mouthStretch_R'] !== undefined) {
        const target = isSpeaking
          ? THREE.MathUtils.clamp(viseme.e * 0.8 + voiceEnergy * 0.2, 0, 1)
          : 0
        influences[dict['mouthStretch_R']] = THREE.MathUtils.lerp(influences[dict['mouthStretch_R']], target, 0.1)
      }

      const upperLipTarget = isSpeaking ? 0.1 + viseme.fv * 0.26 + viseme.e * 0.12 : 0.08
      if (dict['mouthUpperUp_L'] !== undefined) influences[dict['mouthUpperUp_L']] = THREE.MathUtils.lerp(influences[dict['mouthUpperUp_L']], upperLipTarget, 0.08)
      if (dict['mouthUpperUp_R'] !== undefined) influences[dict['mouthUpperUp_R']] = THREE.MathUtils.lerp(influences[dict['mouthUpperUp_R']], upperLipTarget, 0.08)
      if (dict['mouthLowerDown_L'] !== undefined) influences[dict['mouthLowerDown_L']] = THREE.MathUtils.lerp(influences[dict['mouthLowerDown_L']], isSpeaking ? viseme.aa * 0.62 : 0.02, 0.12)
      if (dict['mouthLowerDown_R'] !== undefined) influences[dict['mouthLowerDown_R']] = THREE.MathUtils.lerp(influences[dict['mouthLowerDown_R']], isSpeaking ? viseme.aa * 0.62 : 0.02, 0.12)

      const browInnerTarget = Math.min(1, expressionState.current.browSad + (isSpeaking ? voiceEnergy * 0.1 + browTalkPulse : 0.03))
      if (dict['browInnerUp'] !== undefined) influences[dict['browInnerUp']] = THREE.MathUtils.lerp(influences[dict['browInnerUp']], browInnerTarget, 0.08)
      const browOuterTarget = isSpeaking
        ? THREE.MathUtils.lerp(0.02, voiceEnergy * 0.22 + browTalkPulse * 0.7, 0.36)
        : 0
      if (dict['browOuterUp_L'] !== undefined) influences[dict['browOuterUp_L']] = THREE.MathUtils.lerp(influences[dict['browOuterUp_L']], browOuterTarget + browMotionState.left + browAsymmetry, 0.075)
      if (dict['browOuterUp_R'] !== undefined) influences[dict['browOuterUp_R']] = THREE.MathUtils.lerp(influences[dict['browOuterUp_R']], browOuterTarget + browMotionState.right - browAsymmetry, 0.075)

      if (dict['noseSneer_L'] !== undefined) influences[dict['noseSneer_L']] = THREE.MathUtils.lerp(influences[dict['noseSneer_L']], 0, 0.08)
      if (dict['noseSneer_R'] !== undefined) influences[dict['noseSneer_R']] = THREE.MathUtils.lerp(influences[dict['noseSneer_R']], 0, 0.08)
    })
  })

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={2.4} />
    </group>
  )
}

