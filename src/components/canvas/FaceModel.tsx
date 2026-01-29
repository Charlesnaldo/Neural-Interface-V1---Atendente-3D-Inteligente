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
  faceCoords: { x: number; y: number };
}

export default function FaceModel({ isSpeaking, faceCoords }: FaceModelProps) {
  const { gl } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const headMeshRef = useRef<THREE.Mesh | null>(null)
  
  // AQUI ESTÁ O SEGREDO: Configuramos os loaders ANTES do carregamento
  const { scene, animations } = useGLTF(MODEL_URL, undefined, undefined, (loader) => {
    // 1. Configura Meshopt (Necessário para o facecap.glb)
    loader.setMeshoptDecoder(MeshoptDecoder)
    
    // 2. Configura KTX2 (O que estava dando erro)
    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/libs/basis/')
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  })

  const { actions } = useAnimations(animations, scene)

  useEffect(() => {
    if (scene) {
      Object.values(actions).forEach(action => action?.stop())
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).morphTargetDictionary) {
          if ((obj as THREE.Mesh).morphTargetDictionary?.['jawOpen'] !== undefined) {
            headMeshRef.current = obj as THREE.Mesh
          }
        }
      })
    }
  }, [scene, actions])

  useFrame((state) => {
    const fx = faceCoords?.x ?? 0.5
    const fy = faceCoords?.y ?? 0.5

    if (groupRef.current) {
      // Movimento suave baseado no Python
      const targetRotY = (fx - 0.5) * -1.0
      const targetRotX = (fy - 0.5) * 0.6
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.1)
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.1)
    }

    // Sincronia de fala (Jaw)
    if (headMeshRef.current && headMeshRef.current.morphTargetInfluences) {
      const influences = headMeshRef.current.morphTargetInfluences
      const dict = headMeshRef.current.morphTargetDictionary!
      if (dict['jawOpen'] !== undefined) {
        const targetJaw = isSpeaking ? Math.abs(Math.sin(state.clock.elapsedTime * 12)) * 0.4 : 0
        influences[dict['jawOpen']] = THREE.MathUtils.lerp(influences[dict['jawOpen']], targetJaw, 0.2)
      }
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={2.2} />
    </group>
  )
}