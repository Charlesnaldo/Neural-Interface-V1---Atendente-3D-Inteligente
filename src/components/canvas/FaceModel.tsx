'use client'

import React, { useEffect } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { MeshoptDecoder } from 'meshoptimizer'
import { KTX2Loader } from 'three-stdlib'
import { useThree, useFrame } from '@react-three/fiber'

const MODEL_URL = '/models/facecap.glb'

// 1. Definimos a interface para aceitar a prop isSpeaking
interface FaceModelProps {
  isSpeaking: boolean
}

export default function FaceModel({ isSpeaking }: FaceModelProps) {
  const { gl } = useThree()

  const { scene, animations } = useGLTF(MODEL_URL, undefined, undefined, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder)
    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/libs/basis/')
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  })

  const { actions } = useAnimations(animations, scene)

  useFrame((state) => {
    if (!scene) return

    // Movimento do Mouse (Olhar)
    const { x, y } = state.mouse
    scene.rotation.y = THREE.MathUtils.lerp(scene.rotation.y, x * 0.4, 0.1)
    scene.rotation.x = THREE.MathUtils.lerp(scene.rotation.x, -y * 0.2, 0.1)

    // Lógica da Boca (Morph Targets)
    const head = scene.getObjectByName('mesh_2') as THREE.Mesh
    if (head?.morphTargetInfluences && head?.morphTargetDictionary) {
      const jawIndex = head.morphTargetDictionary['jawOpen']
      
      if (isSpeaking) {
        // Se a IA estiver falando, a boca abre e fecha rápido
        head.morphTargetInfluences[jawIndex] = THREE.MathUtils.lerp(
          head.morphTargetInfluences[jawIndex],
          Math.abs(Math.sin(state.clock.elapsedTime * 15)) * 0.4,
          0.2
        )
      } else {
        // Se estiver em silêncio, apenas uma leve respiração
        head.morphTargetInfluences[jawIndex] = THREE.MathUtils.lerp(
          head.morphTargetInfluences[jawIndex],
          Math.abs(Math.sin(state.clock.elapsedTime * 1.5)) * 0.03,
          0.1
        )
      }
    }
  })

  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene)
      const center = box.getCenter(new THREE.Vector3())
      
      scene.position.x += (scene.position.x - center.x)
      scene.position.y += (scene.position.y - center.y)
      scene.position.z += (scene.position.z - center.z)
    }

    if (actions && animations.length > 0) {
      const actionName = animations[0].name
      actions[actionName]?.reset().fadeIn(0.5).play()
    }
  }, [scene, actions, animations])

  return (
    <primitive 
      object={scene} 
      scale={0.7} 
      position={[0, 0.2, 0.5]} 
    />
  )
}