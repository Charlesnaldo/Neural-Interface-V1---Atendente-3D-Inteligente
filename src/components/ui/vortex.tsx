'use client'

import { cn } from '@/lib/utils'
import { useEffect, useRef } from 'react'

interface VortexProps {
  children?: React.ReactNode
  className?: string
  containerClassName?: string
  particleCount?: number
  rangeY?: number
  baseHue?: number
  baseSpeed?: number
  rangeSpeed?: number
  baseRadius?: number
  rangeRadius?: number
  backgroundColor?: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  ttl: number
  radius: number
  alpha: number
}

export const Vortex = ({
  children,
  className,
  containerClassName,
  particleCount = 300,
  rangeY = 700,
  baseSpeed = 0.2,
  rangeSpeed = 1.2,
  baseRadius = 0.8,
  rangeRadius = 1.8,
  backgroundColor = '#000000',
}: VortexProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const particlesRef = useRef<Particle[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const randomRange = (value: number) => (Math.random() - 0.5) * 2 * value

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      particlesRef.current = Array.from({ length: particleCount }, () => {
        const speed = baseSpeed + Math.random() * rangeSpeed
        return {
          x: Math.random() * canvas.width,
          y: canvas.height * 0.5 + randomRange(rangeY * 0.5),
          vx: randomRange(0.6) * speed,
          vy: randomRange(0.2) * speed,
          life: 0,
          ttl: 60 + Math.random() * 140,
          radius: baseRadius + Math.random() * rangeRadius,
          alpha: 0.2 + Math.random() * 0.35,
        }
      })
    }

    const resetParticle = (particle: Particle) => {
      const speed = baseSpeed + Math.random() * rangeSpeed
      particle.x = Math.random() * canvas.width
      particle.y = canvas.height * 0.5 + randomRange(rangeY * 0.5)
      particle.vx = randomRange(0.6) * speed
      particle.vy = randomRange(0.2) * speed
      particle.life = 0
      particle.ttl = 60 + Math.random() * 140
      particle.radius = baseRadius + Math.random() * rangeRadius
      particle.alpha = 0.2 + Math.random() * 0.35
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      for (const particle of particlesRef.current) {
        particle.life += 1
        particle.x += particle.vx
        particle.y += particle.vy

        const fade = Math.abs(((particle.life + particle.ttl * 0.5) % particle.ttl) - particle.ttl * 0.5) / (particle.ttl * 0.5)
        const alpha = (1 - fade) * particle.alpha

        ctx.beginPath()
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        ctx.fill()

        if (
          particle.life > particle.ttl ||
          particle.x < -20 ||
          particle.x > canvas.width + 20 ||
          particle.y < -20 ||
          particle.y > canvas.height + 20
        ) {
          resetParticle(particle)
        }
      }

      rafRef.current = window.requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [backgroundColor, baseRadius, baseSpeed, particleCount, rangeRadius, rangeSpeed, rangeY])

  return (
    <div className={cn('relative h-full w-full', containerClassName)}>
      <div className="absolute inset-0 z-0 flex h-full w-full items-center justify-center bg-transparent">
        <canvas ref={canvasRef} />
      </div>
      <div className={cn('relative z-10', className)}>{children}</div>
    </div>
  )
}
