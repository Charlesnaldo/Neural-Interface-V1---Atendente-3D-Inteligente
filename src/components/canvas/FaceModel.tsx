'use client'

import React, { useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { MeshoptDecoder } from 'meshoptimizer'
import { KTX2Loader } from 'three-stdlib'
import { useThree, useFrame } from '@react-three/fiber'

const MODEL_URL = '/models/facecap.glb'

export default function FaceModel({ isSpeaking }: { isSpeaking: boolean }) {
  const { gl } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const headMeshRef = useRef<THREE.Mesh | null>(null)
  
  // 1. Carregamos o modelo e as animações (actions)
  const { scene, animations } = useGLTF(MODEL_URL, undefined, undefined, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder)
    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/libs/basis/')
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  })

  // 2. Hook de animações para poder pará-las
  const { actions } = useAnimations(animations, scene)

  useEffect(() => {
    if (scene) {
      // PARAR TODAS AS ACTIONS: Se o modelo veio com uma animação de "pose", 
      // ela pode estar sobrescrevendo nossos comandos manuais.
      Object.values(actions).forEach(action => action?.stop())

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).morphTargetDictionary) {
          // No seu console, 'jawOpen' existe, então essa é a malha da cabeça
          if ((obj as THREE.Mesh).morphTargetDictionary?.['jawOpen'] !== undefined) {
            headMeshRef.current = obj as THREE.Mesh
            console.log("Sucesso: Malha da cabeça conectada.")
          }
        }
      })

      // Centralização
      const box = new THREE.Box3().setFromObject(scene)
      const center = box.getCenter(new THREE.Vector3())
      scene.position.set(-center.x, -center.y, -center.z)
    }
  }, [scene, actions])

  useFrame((state) => {
    if (!groupRef.current) return
    
    const time = state.clock.elapsedTime

    // 1. MOVIMENTO DA CABEÇA (Seguir mouse + balanço natural)
    const targetRotY = (state.mouse.x * 0.25) + Math.sin(time * 0.5) * 0.02
    const targetRotX = (-state.mouse.y * 0.15) + Math.cos(time * 0.3) * 0.02
    
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.1)
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.1)

    // 2. CONTROLE DE EXPRESSÕES (MorphTargets)
    if (headMeshRef.current && headMeshRef.current.morphTargetInfluences) {
      const influences = headMeshRef.current.morphTargetInfluences
      const dict = headMeshRef.current.morphTargetDictionary!

      // --- LÓGICA DO SORRISO ---
      // mouthSmile_L e mouthSmile_R conforme seu console.log
      const sL = dict['mouthSmile_L']
      const sR = dict['mouthSmile_R']
      
      if (sL !== undefined && sR !== undefined) {
        // Valor 0.4 para um sorriso visível mas elegante. 
        // Se quiser o sorriso "coringa" que estava antes, mude 0.4 para 0.9
        const smileIntensity = 0.4 
        influences[sL] = THREE.MathUtils.lerp(influences[sL], smileIntensity, 0.05)
        influences[sR] = THREE.MathUtils.lerp(influences[sR], smileIntensity, 0.05)
      }

      // --- LÓGICA DA FALA (JAW) ---
      if (dict['jawOpen'] !== undefined) {
        const targetJaw = isSpeaking ? Math.abs(Math.sin(time * 12)) * 0.4 : 0
        influences[dict['jawOpen']] = THREE.MathUtils.lerp(influences[dict['jawOpen']], targetJaw, 0.2)
      }

      // --- LÓGICA DA PISCADA ---
      if (dict['eyeBlink_L'] !== undefined && dict['eyeBlink_R'] !== undefined) {
        const blink = Math.sin(time * 0.9) > 0.98 ? 1 : 0
        influences[dict['eyeBlink_L']] = THREE.MathUtils.lerp(influences[dict['eyeBlink_L']], blink, 0.5)
        influences[dict['eyeBlink_R']] = THREE.MathUtils.lerp(influences[dict['eyeBlink_R']], blink, 0.5)
      }
    }
  })

  

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={2.1} />
    </group>
  )
}