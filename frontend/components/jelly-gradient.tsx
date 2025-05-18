"use client"

import { useEffect, useRef } from "react"

interface JellyGradientProps {
  className?: string
}

export function JellyGradient({ className }: JellyGradientProps) {
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

    // Blob parameters
    const blobs = [
      { x: 0.5, y: 0.5, radius: 0.4, speed: 0.5, offset: 0, color: "#F56E0F" },
      { x: 0.6, y: 0.4, radius: 0.3, speed: 0.7, offset: 2, color: "#4b607f" },
      { x: 0.4, y: 0.6, radius: 0.35, speed: 0.6, offset: 4, color: "#262626" },
    ]

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
      mouseX = (e.clientX - rect.left) / rect.width
      mouseY = (e.clientY - rect.top) / rect.height
    }

    canvas.addEventListener("mousemove", handleMouseMove)

    // Draw a blob with noise
    const drawBlob = (
      centerX: number,
      centerY: number,
      radius: number,
      color: string,
      noiseScale: number,
      noiseOffset: number,
    ) => {
      ctx.fillStyle = color
      ctx.beginPath()

      const points = 20
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2

        // Add noise to radius
        const noise = Math.sin(angle * 3 + time + noiseOffset) * noiseScale
        const distortedRadius = radius * (1 + noise * 0.2)

        // Add mouse influence
        const dx = mouseX - centerX
        const dy = mouseY - centerY
        const distance = Math.sqrt(dx * dx + dy * dy)
        const influence = Math.max(0, 1 - distance * 2) * 0.3

        const x = centerX + Math.cos(angle) * (distortedRadius + influence) * canvas.width
        const y = centerY + Math.sin(angle) * (distortedRadius + influence) * canvas.height

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.closePath()
      ctx.fill()
    }

    // Animation function
    const animate = () => {
      time += 0.01
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Create gradient background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      gradient.addColorStop(0, "rgba(38, 38, 38, 1)")
      gradient.addColorStop(1, "rgba(38, 38, 38, 0.8)")
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw blobs
      blobs.forEach((blob) => {
        // Update position with some movement
        blob.x = 0.5 + Math.sin(time * blob.speed + blob.offset) * 0.1
        blob.y = 0.5 + Math.cos(time * blob.speed + blob.offset) * 0.1

        // Draw with mouse influence
        drawBlob(blob.x, blob.y, blob.radius, blob.color, 0.1, blob.offset)
      })

      // Apply composite operation for blending
      ctx.globalCompositeOperation = "screen"

      // Draw highlight blob that follows mouse
      if (mouseX > 0 && mouseY > 0) {
        const highlightGradient = ctx.createRadialGradient(
          mouseX * canvas.width,
          mouseY * canvas.height,
          0,
          mouseX * canvas.width,
          mouseY * canvas.height,
          canvas.width * 0.3,
        )
        highlightGradient.addColorStop(0, "rgba(245, 110, 15, 0.6)")
        highlightGradient.addColorStop(0.5, "rgba(245, 110, 15, 0.2)")
        highlightGradient.addColorStop(1, "rgba(245, 110, 15, 0)")

        ctx.fillStyle = highlightGradient
        ctx.beginPath()
        ctx.arc(mouseX * canvas.width, mouseY * canvas.height, canvas.width * 0.3, 0, Math.PI * 2)
        ctx.fill()
      }

      // Reset composite operation
      ctx.globalCompositeOperation = "source-over"

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
