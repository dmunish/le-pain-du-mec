"use client"

import { useEffect, useRef } from "react"

interface WaveAnimationProps {
  className?: string
}

export function WaveAnimation({ className }: WaveAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number
    let mouseX = 0
    let mouseY = 0
    let time = 0

    // Set canvas dimensions
    const setCanvasDimensions = () => {
      const { width, height } = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
    }

    // Initialize
    setCanvasDimensions()
    window.addEventListener("resize", setCanvasDimensions)

    // Track mouse position
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseX = e.clientX - rect.left
      mouseY = e.clientY - rect.top
    }

    canvas.addEventListener("mousemove", handleMouseMove)

    // Animation function
    const animate = () => {
      time += 0.01
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      gradient.addColorStop(0, "rgba(245, 110, 15, 0.7)")
      gradient.addColorStop(0.5, "rgba(245, 110, 15, 0.5)")
      gradient.addColorStop(1, "rgba(38, 38, 38, 0.8)")

      // Draw waves
      const drawWave = (amplitude: number, frequency: number, speed: number) => {
        ctx.beginPath()

        // Calculate mouse influence
        const mouseInfluence = Math.sin(time * 2) * 20
        const mouseDistX = Math.min(100, Math.max(-100, mouseX - canvas.width / 2)) / 10
        const mouseDistY = Math.min(100, Math.max(-100, mouseY - canvas.height / 2)) / 10

        for (let x = 0; x <= canvas.width; x += 5) {
          // Calculate wave height with mouse influence
          const distanceToMouse = Math.sqrt(Math.pow(x - mouseX, 2)) / 50
          const mouseFactor = Math.max(0, (100 - distanceToMouse) / 100)

          const y =
            amplitude * Math.sin(x * frequency + time * speed + mouseDistX / 10) +
            canvas.height / 2 +
            mouseInfluence * mouseFactor +
            mouseDistY * mouseFactor

          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }

        // Complete the wave by drawing to the bottom and back to start
        ctx.lineTo(canvas.width, canvas.height)
        ctx.lineTo(0, canvas.height)
        ctx.closePath()

        ctx.fillStyle = gradient
        ctx.fill()
      }

      // Draw multiple waves with different parameters
      drawWave(30, 0.01, 1)
      drawWave(20, 0.02, 1.5)
      drawWave(15, 0.03, 0.8)

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", setCanvasDimensions)
      canvas.removeEventListener("mousemove", handleMouseMove)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} />
}
