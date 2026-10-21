'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { MeshoptDecoder } from 'meshoptimizer'
import { KTX2Loader } from 'three-stdlib'
import { useThree, useFrame } from '@react-three/fiber'
import { blinkEnvelope, frameBlend, morphBlend } from '@/lib/face-motion'
import type { Gaze } from '@/lib/gaze'

const MODEL_URL = '/models/facecap.glb'

interface AudioMetrics {
  amplitude: number
  sharpness: number
  low: number
  mid: number
  high: number
  dominantBand: 'low' | 'mid' | 'high'
  mouthOpen: number
  mouthWide: number
  mouthRound: number
  mouthClosed: number
  mouthPress: number
  mouthDental: number
}

const ZERO_METRICS: AudioMetrics = {
  amplitude: 0, sharpness: 0, low: 0, mid: 0, high: 0, dominantBand: 'mid',
  mouthOpen: 0, mouthWide: 0, mouthRound: 0, mouthClosed: 0, mouthPress: 0, mouthDental: 0,
}

interface FaceModelProps {
  isSpeaking: boolean
  isListening: boolean
  loading: boolean
  faceCoords: { x: number; y: number }
  gaze?: Gaze | null
  expression: 'neutral' | 'smile' | 'sad'
  inputLevel: number
  audioMetrics?: AudioMetrics
  // Prefira passar audioMetricsLiveRef do useVoice — lido direto no useFrame
  // sem depender do ciclo setState → re-render → prop.
  audioMetricsLiveRef?: React.MutableRefObject<AudioMetrics>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Smooth damp — exponential approach, frame-rate independent. */
function damp(current: number, target: number, speed: number, dt: number) {
  return THREE.MathUtils.damp(current, target, speed, dt)
}

/** Lerp morph influence with guard for missing keys. */
function writeMorph(
  influences: number[],
  dict: { [key: string]: number },
  key: string,
  target: number,
  alpha: number,
  dt: number
) {
  if (dict[key] === undefined) return
  influences[dict[key]] = morphBlend(influences[dict[key]], target, alpha, dt)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FaceModel({
  isSpeaking,
  isListening,
  loading,
  faceCoords,
  gaze,
  expression,
  inputLevel,
  audioMetrics,
  audioMetricsLiveRef,
}: FaceModelProps) {
  const { gl } = useThree()

  const [timingSeed] = useState(() => ({
    blink: Math.random() * 3 + 2,
    microBlink: Math.random() * 6 + 4,
    saccade: Math.random() * 2 + 0.5,
    headIdle: Math.random() * 3 + 2,
    browTimer: Math.random() * 2 + 1,
    gestureTimer: Math.random() * 1.4 + 0.6,
    breathPhase: Math.random() * Math.PI * 2,
  }))

  const groupRef = useRef<THREE.Group>(null)
  const headMeshesRef = useRef<THREE.Mesh[]>([])
  const rigRef = useRef({ dictionary: {} as Record<string, number>, influences: [] as number[] })
  // Ref local — usada apenas quando audioMetricsLiveRef não é fornecida.
  const localMetricsRef = useRef<AudioMetrics>(audioMetrics ?? ZERO_METRICS)
  // Aponta para a ref viva do useVoice se disponível, senão usa a local.
  const audioMetricsRef = audioMetricsLiveRef ?? localMetricsRef

  // ── Blink ──────────────────────────────────────────────────────────────
  const blinkState = useRef({ value: 0, active: false, elapsed: 0, timer: timingSeed.blink })
  const microBlinkState = useRef({ value: 0, active: false, timer: timingSeed.microBlink })

  // ── Eye saccade ────────────────────────────────────────────────────────
  const saccadeState = useRef({
    currentX: 0, currentY: 0,
    targetX: 0,  targetY: 0,
    timer: timingSeed.saccade,
  })

  // ── Head idle ──────────────────────────────────────────────────────────
  const headIdle = useRef({ rotX: 0, rotY: 0, targetX: 0, targetY: 0, timer: timingSeed.headIdle })

  // ── Brow ───────────────────────────────────────────────────────────────
  const browMotion = useRef({
    left: 0, right: 0, pulse: 0, timer: timingSeed.browTimer, drift: 0,
  })

  // ── Gesture (nod / tilt / lean) ────────────────────────────────────────
  const gestureMotion = useRef({
    nod: 0, nodTarget: 0,
    tilt: 0, tiltTarget: 0,
    lean: 0, leanTarget: 0,
    timer: timingSeed.gestureTimer,
  })

  // ── Breath ─────────────────────────────────────────────────────────────
  const breathState = useRef({ amplitude: 0.011, phase: timingSeed.breathPhase })

  // ── Expression ─────────────────────────────────────────────────────────
  const expressionState = useRef({ smile: 0.06, frown: 0, browSad: 0, browFocus: 0, cheek: 0 })

  // ── Viseme (smoothed phoneme targets) ──────────────────────────────────
  //
  // Strategy: we maintain one smoothed value per phoneme dimension.
  // Round and Wide are mutually exclusive — when one is active the other is
  // suppressed so lips never pucker and stretch simultaneously.
  // mouthClose is only driven by the "press/closed" group, never by jawOpen,
  // so they don't cancel each other.
  //
  const visemeState = useRef({
    open:   0, // AA / AH — vertical jaw
    wide:   0, // EE / IH — lateral stretch
    round:  0, // OO / UH — lip pucker
    press:  0, // M / P / B — lip seal
    dental: 0, // F / V / S — upper-lip retraction
    // derived / internal
  })

  // ── Mouth idle micro-jitter ────────────────────────────────────────────

  // ── Load model ─────────────────────────────────────────────────────────
  const { scene, animations } = useGLTF(MODEL_URL, undefined, undefined, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder)
    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath(
      'https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/libs/basis/'
    )
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  })

  const { actions } = useAnimations(animations, scene)

  useEffect(() => {
    if (scene) {
      headMeshesRef.current = []
      Object.values(actions).forEach((a) => a?.stop())
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh && mesh.morphTargetDictionary) {
          // The capture asset includes a posed face; start from a neutral rig.
          mesh.morphTargetInfluences?.fill(0)
          headMeshesRef.current.push(mesh)
        }
      })
      const keys = [...new Set(headMeshesRef.current.flatMap(mesh => Object.keys(mesh.morphTargetDictionary ?? {})))]
      rigRef.current = { dictionary: Object.fromEntries(keys.map((key, index) => [key, index])), influences: keys.map(() => 0) }
    }
  }, [scene, actions])

  useEffect(() => {
    // Only sync local ref when caller passes audioMetrics as value (not liveRef)
    if (!audioMetricsLiveRef && audioMetrics) {
      localMetricsRef.current = audioMetrics
    }
  }, [audioMetrics, audioMetricsLiveRef])

  // ── Frame loop ─────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const t   = state.clock.elapsedTime
    // Fiber already advances the clock before invoking frame subscribers.
    const dt  = Math.min(0.05, delta)
    const fx  = faceCoords?.x ?? 0.5
    const fy  = faceCoords?.y ?? 0.5
    const m   = audioMetricsRef.current
    const setMorph = (inf: number[], dict: Record<string, number>, key: string, target: number, alpha: number) => writeMorph(inf, dict, key, target, alpha, dt)

    // ── Global voice energy scalars ──────────────────────────────────────
    const amp          = isSpeaking ? THREE.MathUtils.clamp(m.amplitude, 0, 1)     : 0
    const voiceEnergy  = isSpeaking ? THREE.MathUtils.clamp(amp * 0.85, 0, 1) : 0
    const voiceSharp   = isSpeaking ? THREE.MathUtils.clamp(m.sharpness * 1.1, 0, 1) : 0
    const listenEnergy = isListening && !isSpeaking
      ? THREE.MathUtils.clamp(inputLevel * 1.6, 0, 1) : 0

    // ────────────────────────────────────────────────────────────────────
    // BLINK
    // ────────────────────────────────────────────────────────────────────
    const blink = blinkState.current
    blink.timer -= dt
    if (blink.timer <= 0 && !blink.active) {
      blink.active = true
      blink.elapsed = 0
    }
    if (blink.active) blink.elapsed += dt
    blink.value = blink.active ? blinkEnvelope(blink.elapsed) : 0
    if (blink.active && blink.elapsed >= 0.18) {
      blink.active = false
      blink.timer  = Math.random() * 3 + 1.5
    }

    const microBlink = microBlinkState.current
    microBlink.timer -= dt
    if (microBlink.timer <= 0 && !microBlink.active) {
      microBlink.active = true
      microBlink.timer  = Math.random() * 0.14 + 0.08
    }
    microBlink.value = damp(microBlink.value, microBlink.active ? 0.45 : 0, 0.35, dt * 60)
    if (microBlink.active && microBlink.value > 0.38) {
      microBlink.active = false
      microBlink.timer  = Math.random() * 5.5 + 3.5
    }

    // ────────────────────────────────────────────────────────────────────
    // EYE SACCADE
    // ────────────────────────────────────────────────────────────────────
    const sacc = saccadeState.current
    sacc.timer -= dt
    if (sacc.timer <= 0) {
      sacc.targetX = (Math.random() - 0.5) * (isListening ? 0.10 : 0.22)
      sacc.targetY = (Math.random() - 0.5) * 0.12
      sacc.timer   = Math.random() * 1.4 + 0.55
    }
    sacc.currentX = damp(sacc.currentX, sacc.targetX, 22, dt)
    sacc.currentY = damp(sacc.currentY, sacc.targetY, 22, dt)

    // ────────────────────────────────────────────────────────────────────
    // HEAD IDLE
    // ────────────────────────────────────────────────────────────────────
    const hi = headIdle.current
    hi.timer -= dt
    if (hi.timer <= 0) {
      hi.targetX = (Math.random() - 0.5) * 0.05
      hi.targetY = (Math.random() - 0.5) * 0.045
      hi.timer   = Math.random() * 3.2 + 1.8
    }
    hi.rotX = damp(hi.rotX, hi.targetX, 0.04,  dt * 60)
    hi.rotY = damp(hi.rotY, hi.targetY, 0.045, dt * 60)

    // ────────────────────────────────────────────────────────────────────
    // GESTURE NOD / TILT / LEAN
    // ────────────────────────────────────────────────────────────────────
    const gesture = gestureMotion.current
    gesture.timer -= dt
    if (gesture.timer <= 0) {
      if (isSpeaking) {
        gesture.nodTarget  = (Math.random() - 0.5) * 0.045 * voiceEnergy
        gesture.tiltTarget = (Math.random() - 0.5) * 0.04 * voiceEnergy
        gesture.leanTarget = voiceEnergy * 0.025
        gesture.timer      = Math.random() * 1.2 + 0.8
      } else if (isListening) {
        gesture.nodTarget  = -0.018 - listenEnergy * 0.045
        gesture.tiltTarget = (Math.random() - 0.5) * 0.045
        gesture.leanTarget = 0.035 + listenEnergy * 0.045
        gesture.timer      = Math.random() * 0.8 + 0.45
      } else {
        gesture.nodTarget  = (Math.random() - 0.5) * 0.018
        gesture.tiltTarget = (Math.random() - 0.5) * 0.026
        gesture.leanTarget = 0
        gesture.timer      = Math.random() * 3 + 1.4
      }
    }
    gesture.nod  = damp(gesture.nod,  gesture.nodTarget,  0.12, dt * 60)
    gesture.tilt = damp(gesture.tilt, gesture.tiltTarget, 0.08, dt * 60)
    gesture.lean = damp(gesture.lean, gesture.leanTarget, 0.08, dt * 60)

    // ────────────────────────────────────────────────────────────────────
    // HEAD TRANSFORM
    // ────────────────────────────────────────────────────────────────────
    if (groupRef.current) {
      const breath     = Math.sin(t * 1.18 + breathState.current.phase) * breathState.current.amplitude
      const jitterX    = Math.sin(t * 2.5) * 0.002
      const jitterY    = Math.cos(t * 2.0) * 0.002
      const speechNod  = isSpeaking ? (m.mid - m.low) * voiceEnergy * 0.018 : 0
      const speechTilt = isSpeaking ? Math.sin(t * 0.7) * voiceEnergy * 0.006 : 0
      const listenNod  = listenEnergy * 0.008

      const tRotY = THREE.MathUtils.clamp((fx - 0.5) * -0.55, -0.22, 0.22) + jitterY
      const tRotX = THREE.MathUtils.clamp((fy - 0.5) * 0.35, -0.14, 0.14) + jitterX + breath
      const fRotY = tRotY + hi.rotY
      const fRotX = tRotX + hi.rotX + gesture.nod + speechNod + listenNod
      const fRotZ = gesture.tilt + speechTilt

      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, fRotY, frameBlend(0.08, dt))
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, fRotX, frameBlend(0.08, dt))
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, fRotZ, frameBlend(0.06, dt))
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, breath * 0.26, frameBlend(0.04, dt))
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, gesture.lean, frameBlend(0.05, dt))
    }

    // ────────────────────────────────────────────────────────────────────
    // MORPH TARGETS
    // ────────────────────────────────────────────────────────────────────
    {
      // Advance shared expression/viseme state once per frame, not once per mesh.
      const inf = rigRef.current.influences
      const dict = rigRef.current.dictionary

      // ── BLINK ─────────────────────────────────────────────────────────
      const blinkV = THREE.MathUtils.clamp(blink.value + microBlink.value * 0.3, 0, 1)
      setMorph(inf, dict, 'eyeBlink_L', blinkV, 1)
      setMorph(inf, dict, 'eyeBlink_R', blinkV, 1)

      // ── EYE LOOK ──────────────────────────────────────────────────────
      let lookX = (fx - 0.5) * 0.75 + sacc.currentX
      let lookY = (fy - 0.5) * -0.65 + sacc.currentY
      if (gaze) {
        lookX = THREE.MathUtils.clamp(gaze.x, -1, 1) * 0.65
        lookY = THREE.MathUtils.clamp(gaze.y, -1, 1) * 0.55
      } else if (loading) {
        lookX = sacc.currentX - 0.10
        lookY = sacc.currentY + 0.16
      }

      setMorph(inf, dict, 'eyeLookUp_L',   lookY > 0 ?  lookY : 0, 0.1)
      setMorph(inf, dict, 'eyeLookUp_R',   lookY > 0 ?  lookY : 0, 0.1)
      setMorph(inf, dict, 'eyeLookDown_L', lookY < 0 ? -lookY : 0, 0.1)
      setMorph(inf, dict, 'eyeLookDown_R', lookY < 0 ? -lookY : 0, 0.1)
      setMorph(inf, dict, 'eyeLookOut_L',  lookX < 0 ? -lookX : 0, 0.1)
      setMorph(inf, dict, 'eyeLookIn_L',   lookX > 0 ?  lookX : 0, 0.1)
      setMorph(inf, dict, 'eyeLookIn_R',   lookX < 0 ? -lookX : 0, 0.1)
      setMorph(inf, dict, 'eyeLookOut_R',  lookX > 0 ?  lookX : 0, 0.1)

      // ── BROW ──────────────────────────────────────────────────────────
      const brow = browMotion.current
      brow.timer -= dt
      if (brow.timer <= 0) {
        brow.pulse = Math.random() * 0.5 + t * 0.02
        brow.left  = (Math.random() - 0.5) * 0.08
        brow.right = (Math.random() - 0.5) * 0.08
        brow.drift = (Math.random() - 0.5) * 0.04
        brow.timer = Math.random() * 3.8 + 1.6
      }
      const browTalkPulse  = isSpeaking ? Math.abs(Math.sin(t * 3.4 + brow.pulse)) * 0.14 : 0
      const browAsymmetry  = Math.sin(t * 0.9 + brow.pulse) * 0.02 + brow.drift

      // ── EXPRESSION ────────────────────────────────────────────────────
      const es = expressionState.current
      let tSmile    = 0.06
      let tFrown    = 0
      let tBrowSad  = 0
      let tBrowFocus = isListening && !isSpeaking ? 0.12 + listenEnergy * 0.18 : 0
      let tCheek    = isSpeaking ? voiceEnergy * 0.08 : listenEnergy * 0.04

      if (expression === 'smile') { tSmile = 0.42; tCheek += 0.16 }
      else if (expression === 'sad') { tSmile = 0; tFrown = 0.24; tBrowSad = 0.26; tBrowFocus = 0.04 }

      const es_speed = 0.065
      es.smile    = damp(es.smile,    tSmile,    es_speed, dt * 60)
      es.frown    = damp(es.frown,    tFrown,    es_speed, dt * 60)
      es.browSad  = damp(es.browSad,  tBrowSad,  es_speed, dt * 60)
      es.browFocus = damp(es.browFocus, tBrowFocus, 0.16,  dt * 60)
      es.cheek    = damp(es.cheek,    tCheek,    0.16,    dt * 60)

      const lipArticulation = Math.max(m.mouthRound, m.mouthPress, m.mouthClosed, m.mouthWide)
      const finalSmile = es.smile * (isSpeaking ? 1 - Math.min(0.85, lipArticulation) : 1)
      const squint     = finalSmile * 0.25 + es.cheek * 0.3 + listenEnergy * 0.06 + (isSpeaking ? voiceSharp * 0.14 : 0)

      setMorph(inf, dict, 'mouthSmile_L',  finalSmile, 0.1)
      setMorph(inf, dict, 'mouthSmile_R',  finalSmile, 0.1)
      setMorph(inf, dict, 'mouthFrown_L',  es.frown,   0.1)
      setMorph(inf, dict, 'mouthFrown_R',  es.frown,   0.1)
      setMorph(inf, dict, 'eyeSquint_L',   squint,     0.1)
      setMorph(inf, dict, 'eyeSquint_R',   squint,     0.1)
      setMorph(inf, dict, 'cheekSquint_L', squint * 0.8, 0.1)
      setMorph(inf, dict, 'cheekSquint_R', squint * 0.8, 0.1)

      // ── BROW MORPHS ───────────────────────────────────────────────────
      const browInner = Math.min(1, es.browSad + es.browFocus * 0.35 + (isSpeaking ? voiceEnergy * 0.1 + browTalkPulse : 0.03))
      const browOuter = isSpeaking
        ? THREE.MathUtils.lerp(0.02, voiceEnergy * 0.22 + browTalkPulse * 0.7, 0.36)
        : listenEnergy * 0.08
      setMorph(inf, dict, 'browInnerUp',   browInner,                            0.08)
      setMorph(inf, dict, 'browOuterUp_L', browOuter + brow.left  + browAsymmetry, 0.075)
      setMorph(inf, dict, 'browOuterUp_R', browOuter + brow.right - browAsymmetry, 0.075)
      setMorph(inf, dict, 'browDown_L',    es.browFocus, 0.08)
      setMorph(inf, dict, 'browDown_R',    es.browFocus, 0.08)

      // ── NOSE ──────────────────────────────────────────────────────────
      setMorph(inf, dict, 'noseSneer_L', 0, 0.08)
      setMorph(inf, dict, 'noseSneer_R', 0, 0.08)

      // ================================================================
      // MOUTH / VISEME SYSTEM
      //
      // Architecture:
      //  1. Compute raw targets from audioMetrics (no damping yet).
      //  2. Apply mutual exclusion: round vs wide.
      //  3. Smooth each dimension at tuned speeds.
      //  4. Derive jaw, lip, and auxiliary morphs from the smoothed values.
      //
      // The fundamental rule: jawOpen and mouthClose must NEVER fight each
      // other. jawOpen is driven purely by vertical opening (open/round).
      // mouthClose is driven purely by lip-seal events (press/closed).
      // ================================================================

      const vs = visemeState.current

      if (isSpeaking) {
        // ── Raw phoneme targets ───────────────────────────────────────
        const rawOpen   = THREE.MathUtils.clamp(m.mouthOpen,   0, 0.85)
        const rawWide   = THREE.MathUtils.clamp(m.mouthWide,   0, 0.80)
        const rawRound  = THREE.MathUtils.clamp(m.mouthRound,  0, 0.80)
        const rawPress  = THREE.MathUtils.clamp(Math.max(m.mouthPress, m.mouthClosed), 0, 0.85)
        const rawDental = THREE.MathUtils.clamp(m.mouthDental, 0, 0.80)

        // ── Mutual exclusion: round ↔ wide ────────────────────────────
        const totalRW   = rawRound + rawWide
        const dominance = totalRW > 0.01 ? rawRound / totalRW : 0.5
        const wide_adj  = rawWide  * (1 - dominance * 0.9)
        const round_adj = rawRound * (dominance * 0.9 + 0.1)

        // Press suppresses open only when sealing (M/P/B).
        // Keep suppression mild so any residual press value doesn't kill
        // the opening on vowels that follow immediately after a bilabial.
        const pressSuppress = rawPress * 0.85
        const openFinal     = THREE.MathUtils.clamp(rawOpen - pressSuppress, 0, 0.85)

        // ── Smooth each dimension (single pass — no double-damping) ───
        vs.open   = damp(vs.open,   openFinal, 0.32, dt * 60)
        vs.wide   = damp(vs.wide,   wide_adj,  0.24, dt * 60)
        vs.round  = damp(vs.round,  round_adj, 0.24, dt * 60)
        vs.press  = damp(vs.press,  rawPress,  0.40, dt * 60)
        vs.dental = damp(vs.dental, rawDental, 0.26, dt * 60)

      } else {
        vs.open   = damp(vs.open,   0, 0.20, dt * 60)
        vs.wide   = damp(vs.wide,   0, 0.20, dt * 60)
        vs.round  = damp(vs.round,  0, 0.20, dt * 60)
        vs.press  = damp(vs.press,  0, 0.24, dt * 60)
        vs.dental = damp(vs.dental, 0, 0.22, dt * 60)
      }

      // ── jawOpen ───────────────────────────────────────────────────────
      //
      // Drive directly from vs.open — NO secondary smoother.
      // Double-damping was the reason the jaw never reached its target.
      // vs.open is already smoothed above; applying lerp(0.35) here just
      // prevents per-mesh jitter between meshes in the same frame.
      const jawTarget = isSpeaking
        ? THREE.MathUtils.clamp(vs.open * 0.70 + vs.round * 0.06, 0, 0.62)
        : 0

      setMorph(inf, dict, 'jawOpen', jawTarget, 0.35)

      // Jaw forward for round vowels.
      setMorph(inf, dict, 'jawForward',
        isSpeaking ? THREE.MathUtils.clamp(vs.round * 0.40, 0, 0.20) : 0, 0.18)

      // Subtle lateral jaw micro-movement.
      const lateralJaw = isSpeaking ? Math.sin(t * 8.5) * amp * 0.022 : 0
      setMorph(inf, dict, 'jawLeft',  lateralJaw < 0 ? -lateralJaw : 0, 0.08)
      setMorph(inf, dict, 'jawRight', lateralJaw > 0 ?  lateralJaw : 0, 0.08)

      // ── mouthClose ────────────────────────────────────────────────────
      //
      // This morph physically closes the lips over the jaw gap.
      // It must go to ZERO when speaking (except for M/P/B seal events),
      // otherwise it fights jawOpen and the mouth stays shut.
      // Resting value is also 0 — the natural resting lip position on
      // this rig is already slightly parted without needing mouthClose.
      const mouthCloseTarget = isSpeaking
        ? THREE.MathUtils.clamp(vs.press * 0.75, 0, 0.75)
        : 0
      setMorph(inf, dict, 'mouthClose', mouthCloseTarget, 0.30)

      // Lip press (bilateral bilabial pressure for M/P/B).
      const pressV = vs.press * 0.55
      setMorph(inf, dict, 'mouthPress_L', pressV, 0.22)
      setMorph(inf, dict, 'mouthPress_R', pressV, 0.22)

      // Lip funnel & pucker (OO / UH — round vowels).
      setMorph(inf, dict, 'mouthFunnel',
        isSpeaking ? THREE.MathUtils.clamp(vs.round * 0.60, 0, 0.60) : 0, 0.14)
      setMorph(inf, dict, 'mouthPucker',
        isSpeaking ? THREE.MathUtils.clamp(vs.round * 0.68, 0, 0.68) : 0, 0.12)

      // Lip stretch (EE / IH — wide vowels): corners retract.
      const stretchV = isSpeaking
        ? THREE.MathUtils.clamp(vs.wide * 0.70 + vs.open * 0.06, 0, 0.74) : 0
      setMorph(inf, dict, 'mouthStretch_L', stretchV, 0.12)
      setMorph(inf, dict, 'mouthStretch_R', stretchV, 0.12)

      // Upper-lip elevation: rises with dental consonants (F/V/S/Z)
      // and slightly with round vowels.
      const upperLip = isSpeaking
        ? THREE.MathUtils.clamp(vs.dental * 0.28 + vs.wide * 0.04, 0, 0.36) : 0
      setMorph(inf, dict, 'mouthUpperUp_L', upperLip, 0.10)
      setMorph(inf, dict, 'mouthUpperUp_R', upperLip, 0.10)

      // Lower-lip depression: proportional to open vowels, opposed by press.
      const lowerLip = isSpeaking
        ? THREE.MathUtils.clamp(vs.open * 0.38 + vs.round * 0.04 - vs.press * 0.10, 0, 0.36) : 0
      setMorph(inf, dict, 'mouthLowerDown_L', lowerLip, 0.14)
      setMorph(inf, dict, 'mouthLowerDown_R', lowerLip, 0.14)

      // Lip shrug (vertical lip body movement in closed/round phonemes).
      // Kept deliberately subtle to avoid "fish mouth" artifacts.
      const shrugU = isSpeaking
        ? THREE.MathUtils.clamp(vs.round * 0.14 + vs.press * 0.16, 0, 0.22) : 0.03
      const shrugL = isSpeaking
        ? THREE.MathUtils.clamp(vs.press * 0.14 + vs.round * 0.10, 0, 0.22) : 0.03
      setMorph(inf, dict, 'mouthShrugUpper', shrugU, 0.12)
      setMorph(inf, dict, 'mouthShrugLower', shrugL, 0.12)

      // Lip roll (lips rolling inward for soft bilabials).
      setMorph(inf, dict, 'mouthRollUpper',
        isSpeaking ? THREE.MathUtils.clamp(vs.press * 0.18, 0, 0.20) : 0, 0.14)
      setMorph(inf, dict, 'mouthRollLower',
        isSpeaking ? THREE.MathUtils.clamp(vs.press * 0.16, 0, 0.18) : 0, 0.14)

      // Mouth dimple — very subtle, only for wide vowels.
      const dimpleV = isSpeaking ? THREE.MathUtils.clamp(vs.wide * 0.07, 0, 0.10) : 0
      setMorph(inf, dict, 'mouthDimple_L', dimpleV, 0.10)
      setMorph(inf, dict, 'mouthDimple_R', dimpleV, 0.10)
      // Explicitly release every remaining channel in the 52-control capture rig.
      setMorph(inf, dict, 'eyeWide_L', isListening ? 0.035 : 0, 0.08)
      setMorph(inf, dict, 'eyeWide_R', isListening ? 0.035 : 0, 0.08)
      setMorph(inf, dict, 'cheekPuff', 0, 0.12)
      setMorph(inf, dict, 'mouthLeft', 0, 0.12)
      setMorph(inf, dict, 'mouthRight', 0, 0.12)
      setMorph(inf, dict, 'tongueOut', 0, 0.12)
    }
    for (const mesh of headMeshesRef.current) {
      const inf = mesh.morphTargetInfluences
      const dict = mesh.morphTargetDictionary
      if (!inf || !dict) continue
      // Three.js owns these GPU animation buffers; updates belong in useFrame.
      // eslint-disable-next-line react-hooks/immutability
      for (const key in dict) inf[dict[key]] = rigRef.current.influences[rigRef.current.dictionary[key]] ?? 0
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={2.4} />
    </group>
  )
}
