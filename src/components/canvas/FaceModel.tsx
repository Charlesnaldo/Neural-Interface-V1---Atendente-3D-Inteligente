'use client'

import React, { useEffect } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { MeshoptDecoder } from 'meshoptimizer'
import { KTX2Loader } from 'three-stdlib'
import { useThree, useFrame } from '@react-three/fiber'

const MODEL_URL = '/models/facecap.glb'

export default function FaceModel() {
  const gl = useThree((state) => state.gl)

  const { scene, animations } = useGLTF(MODEL_URL, undefined, undefined, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder)
    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/libs/basis/')
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  })

  const { actions } = useAnimations(animations, scene)

  // Lógica de seguir o mouse
  useFrame((state) => {
    if (!scene) return

    // Pegamos a posição do mouse (-1 a +1)
    const { x, y } = state.mouse

    // Rotação Suave (Lerp)
    // Multiplicamos por valores baixos (0.4 e 0.2) para o movimento ser natural e sutil
    scene.rotation.y = THREE.MathUtils.lerp(scene.rotation.y, x * 0.4, 0.1)
    scene.rotation.x = THREE.MathUtils.lerp(scene.rotation.x, -y * 0.2, 0.1)
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
      const firstAction = actions[animations[0].name]
      firstAction?.fadeIn(0.5).play()
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