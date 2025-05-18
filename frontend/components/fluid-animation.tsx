"use client"

import { useEffect, useRef } from "react"
import { createNoise3D } from "simplex-noise"

interface FluidAnimationProps {
  className?: string
}

export function FluidAnimation({ className }: FluidAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number
    let mouseX = 0
    let mouseY = 0
    let mouseRadius = 0
    let time = 0
    const noise3D = createNoise3D()

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
      mouseRadius = 100 // Radius of influence
    }

    // Reset mouse position when mouse leaves
    const handleMouseLeave = () => {
      mouseRadius = 0
    }

    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mouseleave", handleMouseLeave)

    // Create color palette
    const createGradient = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, "rgba(245, 110, 15, 0.8)")
      gradient.addColorStop(0.5, "rgba(245, 110, 15, 0.5)")
      gradient.addColorStop(1, "rgba(38, 38, 38, 0.9)")
      return gradient
    }

    // Animation function
    const animate = () => {
      time += 0.005
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Background
      ctx.fillStyle = "#262626"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Create gradient
      const gradient = createGradient(ctx, canvas.width, canvas.height)

      // Draw fluid
      const cellSize = 20
      const cols = Math.ceil(canvas.width / cellSize) + 1
      const rows = Math.ceil(canvas.height / cellSize) + 1

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * cellSize
          const y = j * cellSize

          // Calculate distance to mouse
          const dx = x - mouseX
          const dy = y - mouseY
          const dist = Math.sqrt(dx * dx + dy * dy)
          const mouseInfluence = dist < mouseRadius ? (1 - dist / mouseRadius) * 0.8 : 0

          // Generate noise
          const noiseX = x * 0.005
          const noiseY = y * 0.005
          const noiseValue = noise3D(noiseX, noiseY, time) * 0.5 + 0.5

          // Apply mouse influence
          const distortedNoise = noiseValue + mouseInfluence

          // Draw cell
          ctx.fillStyle = gradient
          ctx.globalAlpha = distortedNoise * 0.8 + 0.2
          ctx.beginPath()
          ctx.arc(x, y, cellSize * (distortedNoise * 0.5 + 0.5), 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Add glow effect
      ctx.globalCompositeOperation = "screen"
      ctx.fillStyle = "rgba(245, 110, 15, 0.1)"
      ctx.filter = "blur(30px)"
      ctx.beginPath()
      ctx.arc(mouseX, mouseY, mouseRadius * 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.filter = "none"
      ctx.globalCompositeOperation = "source-over"
      ctx.globalAlpha = 1

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", setCanvasDimensions)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mouseleave", handleMouseLeave)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} />
}
