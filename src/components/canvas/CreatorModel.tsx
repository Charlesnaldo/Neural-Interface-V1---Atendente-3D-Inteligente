'use client'

import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function CreatorModel() {
    const group = useRef<THREE.Group>(null)
    // Carrega o modelo 3D do criador
    const { scene } = useGLTF('/models/facecap1.glb')

    useFrame((state) => {
        if (group.current) {
            // Rotação acelerada e dinâmica
            group.current.rotation.y += 0.035
            // Balanço leve para dar vida
            group.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1
        }
    })

    return (
        <group ref={group}>
            <primitive
                object={scene}
                scale={2.5}
                position={[0, -2.1, 0]}
            />
        </group>
    )
}

useGLTF.preload('/models/facecap1.glb')
