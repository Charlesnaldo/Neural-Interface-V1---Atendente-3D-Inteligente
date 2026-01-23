'use client'

import React, { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { MeshoptDecoder } from 'meshoptimizer'
import { KTX2Loader } from 'three-stdlib'
import { useThree, useFrame } from '@react-three/fiber'

const MODEL_URL = '/models/facecap.glb'

export default function FaceModel() {
  const { gl } = useThree()

  // 1. Carregamento do modelo com configuração segura do Loader
  const { scene, animations } = useGLTF(MODEL_URL, undefined, undefined, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder)
    
    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/libs/basis/')
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  })

  const { actions } = useAnimations(animations, scene)

  // 2. Movimento suave (Mouse Tracking)
  useFrame((state) => {
    if (!scene) return

    const { x, y } = state.mouse

    // Rotação sutil da cabeça
    scene.rotation.y = THREE.MathUtils.lerp(scene.rotation.y, x * 0.4, 0.1)
    scene.rotation.x = THREE.MathUtils.lerp(scene.rotation.x, -y * 0.2, 0.1)

    // Acessando Morph Targets para micro-movimentos
    const head = scene.getObjectByName('mesh_2') as THREE.Mesh
    if (head?.morphTargetInfluences && head?.morphTargetDictionary) {
      const jawIndex = head.morphTargetDictionary['jawOpen']
      // Micro-oscilação para dar vida (respiração)
      head.morphTargetInfluences[jawIndex] = THREE.MathUtils.lerp(
        head.morphTargetInfluences[jawIndex],
        Math.abs(Math.sin(state.clock.elapsedTime * 1.5)) * 0.03,
        0.1
      )
    }
  })

  // 3. Centralização e Inicialização
  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene)
      const center = box.getCenter(new THREE.Vector3())
      
      // Reseta a posição para o centro calculado
      scene.position.x += (scene.position.x - center.x)
      scene.position.y += (scene.position.y - center.y)
      scene.position.z += (scene.position.z - center.z)
    }

    if (actions && animations.length > 0) {
      const actionName = animations[0].name
      actions[actionName]?.reset().fadeIn(0.5).play()
    }
  }, [scene, actions, animations])

  // 4. Retorno do objeto com suas proporções salvas
  return (
    <primitive 
      object={scene} 
      scale={0.7} 
      position={[0, 0.2, 0.5]} 
    />
  )
}