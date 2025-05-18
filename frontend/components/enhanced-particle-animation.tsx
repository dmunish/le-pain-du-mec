"use client"

import { useEffect, useRef } from "react"

interface EnhancedParticleAnimationProps {
  className?: string
}

export function EnhancedParticleAnimation({ className }: EnhancedParticleAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    const setCanvasDimensions = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      ctx.imageSmoothingEnabled = false
    }

    setCanvasDimensions()
    window.addEventListener("resize", setCanvasDimensions)

    // Animation variables
    let animationFrameId: number
    const particles: Particle[] = []
    const grid: GridSpot[] = []
    let stepCount = 0
    const primaryColor = 24 // Orange accent hue (#F56E0F)
    const secondaryColor = 215 // Blue accent hue (#4b607f)
    const lifespan = 1000 // How long particles live
    const maxPop = 1000 // Maximum number of particles
    const birthFreq = 1 // How often to create new particles (lower = more frequent)
    const gridSize = 8 // Size of the grid cells
    const speedFactor = 1
    let currentPattern = 0
    const patternChangeSpeed = 0.1

    // Build grid
    const gridSteps = Math.floor(1000 / gridSize)
    let i = 0
    for (let xx = -500; xx < 500; xx += gridSize) {
      for (let yy = -500; yy < 500; yy += gridSize) {
        // Initial radial field
        const r = Math.sqrt(xx * xx + yy * yy)
        const field = 255 - Math.min(255, r / 2)

        grid.push({
          x: xx,
          y: yy,
          busyAge: 0,
          spotIndex: i,
          isEdge:
            xx === -500 ||
            xx === -500 + gridSize * (gridSteps - 1) ||
            yy === -500 ||
            yy === -500 + gridSize * (gridSteps - 1),
          field: field,
        })
        i++
      }
    }
    const gridMaxIndex = i

    // Update pattern to create changing behaviors
    const updatePattern = () => {
      // Slowly transition between different patterns
      currentPattern += patternChangeSpeed

      // Apply a new pattern every so often
      if (currentPattern >= 4) currentPattern = 0

      const pattern = Math.floor(currentPattern)
      const t = stepCount * 0.01 // Time factor

      for (let i = 0; i < grid.length; i++) {
        const spot = grid[i]
        const xx = spot.x
        const yy = spot.y

        switch (pattern) {
          case 0: // Flow pattern - like city streets
            spot.field = 100 + 155 * Math.sin(xx / 100 + t) * Math.cos(yy / 100 + t)
            break
          case 1: // Attraction points - like city centers
            const cx1 = 200 * Math.sin(t * 0.3)
            const cy1 = 200 * Math.cos(t * 0.2)
            const cx2 = -200 * Math.sin(t * 0.2)
            const cy2 = -200 * Math.cos(t * 0.4)
            const d1 = Math.sqrt((xx - cx1) * (xx - cx1) + (yy - cy1) * (yy - cy1))
            const d2 = Math.sqrt((xx - cx2) * (xx - cx2) + (yy - cy2) * (yy - cy2))
            spot.field = 255 - Math.min(d1, d2) / 2
            break
          case 2: // Grid pattern - like city blocks
            spot.field = 100 + 155 * (Math.sin(xx / 50 + t) + Math.sin(yy / 50 + t * 0.7))
            break
          case 3: // Spiral pattern - like rotating movements
            const angle = Math.atan2(yy, xx)
            const r = Math.sqrt(xx * xx + yy * yy)
            spot.field = 100 + 155 * Math.sin(3 * angle + r / 50 - t * 2)
            break
        }
      }
    }

    // Helper function to convert data coordinates to canvas coordinates
    const dataXYtoCanvasXY = (x: number, y: number) => {
      const zoom = 1.6
      const xC = canvas.width / 2
      const yC = canvas.height / 2
      const dataToImageRatio = 1

      const xx = xC + x * zoom * dataToImageRatio
      const yy = yC + y * zoom * dataToImageRatio

      return { x: xx, y: yy }
    }

    // Function to create a new particle
    const birth = () => {
      const gridSpotIndex = Math.floor(Math.random() * gridMaxIndex)
      const gridSpot = grid[gridSpotIndex]
      const x = gridSpot.x
      const y = gridSpot.y

      // Choose between primary and secondary colors
      const useSecondaryColor = Math.random() > 0.5
      const hue = useSecondaryColor ? secondaryColor : primaryColor

      // Vary the saturation and luminance for shades
      const sat = useSecondaryColor
        ? 70 + Math.floor(25 * Math.random()) // Blue saturation range
        : 85 + Math.floor(15 * Math.random()) // Orange saturation range

      const lum = useSecondaryColor
        ? 40 + Math.floor(30 * Math.random()) // Blue luminance range
        : 50 + Math.floor(30 * Math.random()) // Orange luminance range

      const particle: Particle = {
        hue,
        sat,
        lum,
        x,
        y,
        xLast: x,
        yLast: y,
        xSpeed: 0,
        ySpeed: 0,
        age: 0,
        ageSinceStuck: 0,
        attractor: {
          oldIndex: gridSpotIndex,
          gridSpotIndex,
        },
        name: "seed-" + Math.ceil(10000000 * Math.random()),
      }

      particles.push(particle)
    }

    // Function to remove a particle
    const kill = (particleName: string) => {
      const index = particles.findIndex((p) => p.name === particleName)
      if (index !== -1) {
        particles.splice(index, 1)
      }
    }

    // Function to move particles
    const move = () => {
      for (let i = 0; i < particles.length; i++) {
        // Get particle
        const p = particles[i]

        // Save last position
        p.xLast = p.x
        p.yLast = p.y

        // Attractor and corresponding grid spot
        const index = p.attractor.gridSpotIndex
        let gridSpot = grid[index]

        // Maybe move attractor with certain constraints\
        if (Math.random() < (speedFactor * 0.5) {
          // Move attractor
          if (!gridSpot.isEdge) {
            // Change particle's attractor grid spot
            const topIndex = index - 1
            const bottomIndex = index + 1
            const leftIndex = index - gridSteps
            const rightIndex = index + gridSteps

            // Make sure indices are valid
            const validIndices = [topIndex, bottomIndex, leftIndex, rightIndex].filter(
              (idx) => idx >= 0 && idx < grid.length && grid[idx] !== undefined,
            )

            if (validIndices.length > 0) {
              // Choose neighbor with highest field value (with some randomness)
              const chaos = 30
              let maxField = Number.NEGATIVE_INFINITY
              let maxFieldIndex = validIndices[0]

              for (const idx of validIndices) {
                const fieldValue = grid[idx].field + chaos * Math.random()
                if (fieldValue > maxField) {
                  maxField = fieldValue
                  maxFieldIndex = idx
                }
              }

              const potentialNewGridSpot = grid[maxFieldIndex]

              if (potentialNewGridSpot.busyAge === 0 || potentialNewGridSpot.busyAge > 15) {
                // Ok it's free let's go there
                p.ageSinceStuck = 0 // Not stuck anymore
                p.attractor.oldIndex = index
                p.attractor.gridSpotIndex = potentialNewGridSpot.spotIndex
                gridSpot = potentialNewGridSpot
                gridSpot.busyAge = 1
              } else {
                p.ageSinceStuck++
              }
            } else {
              p.ageSinceStuck++
            }
          } else {
            p.ageSinceStuck++
          }

          if (p.ageSinceStuck === 10) {
            kill(p.name)
          }
        }

        // Spring attractor to center with viscosity
        const k = 8 * speedFactor
        const visc = Math.pow(0.4, speedFactor)
        //const visc = 0.4
        const dx = p.x - gridSpot.x
        const dy = p.y - gridSpot.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Spring
        const xAcc = -k * dx
        const yAcc = -k * dy

        p.xSpeed += xAcc
        p.ySpeed += yAcc

        // Apply viscosity
        p.xSpeed *= visc
        p.ySpeed *= visc

        // Store stuff in particle
        p.speed = Math.sqrt(p.xSpeed * p.xSpeed + p.ySpeed * p.ySpeed)
        p.dist = dist

        // Update position
        p.x += 0.1 * speedFactor * p.xSpeed
        p.y += 0.1 * speedFactor * p.ySpeed

        // Get older
        p.age++

        // Kill if too old
        if (p.age > lifespan) {
          kill(p.name)
        }
      }
    }

    // Function to draw particles
    const draw = () => {
      if (!ctx) return

      // Semi-transparent black background for trail effect
      ctx.beginPath()
      ctx.rect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "rgba(0, 0, 0, 0.07)"
      ctx.fill()
      ctx.closePath()

      for (const p of particles) {
        // Draw particle
        const h = p.hue
        const s = p.sat
        const l = p.lum
        const a = 1

        const last = dataXYtoCanvasXY(p.xLast, p.yLast)
        const now = dataXYtoCanvasXY(p.x, p.y)
        const attracSpot = grid[p.attractor.gridSpotIndex]
        const attracXY = dataXYtoCanvasXY(attracSpot.x, attracSpot.y)
        const oldAttracSpot = grid[p.attractor.oldIndex]
        const oldAttracXY = dataXYtoCanvasXY(oldAttracSpot.x, oldAttracSpot.y)

        // Particle trail
        ctx.beginPath()
        ctx.strokeStyle = `hsla(${h}, ${s}%, ${l}%, ${a})`
        ctx.moveTo(last.x, last.y)
        ctx.lineTo(now.x, now.y)
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.closePath()

        // Attractor positions (small dots)
        ctx.beginPath()
        ctx.arc(attracXY.x, attracXY.y, 1.5, 0, 2 * Math.PI, false)
        ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, ${a})`
        ctx.fill()
        ctx.closePath()
      }
    }

    // Animation loop
    const animate = () => {
      stepCount++

      // Update pattern
      updatePattern()

      // Increment all grid ages
      grid.forEach((e) => {
        if (e.busyAge > 0) e.busyAge++
      })

      // Create new particles
      if (stepCount % birthFreq === 0 && particles.length < maxPop) {
        birth()
      }

      move()
      draw()

      animationFrameId = requestAnimationFrame(animate)
    }

    // Initialize with black background
    ctx.beginPath()
    ctx.rect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "black"
    ctx.fill()
    ctx.closePath()

    // Start animation
    animate()

    // Cleanup
    return () => {
      window.removeEventListener("resize", setCanvasDimensions)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} />
}

// Types
interface Particle {
  hue: number
  sat: number
  lum: number
  x: number
  y: number
  xLast: number
  yLast: number
  xSpeed: number
  ySpeed: number
  age: number
  ageSinceStuck: number
  attractor: {
    oldIndex: number
    gridSpotIndex: number
  }
  name: string
  speed?: number
  dist?: number
}

interface GridSpot {
  x: number
  y: number
  busyAge: number
  spotIndex: number
  isEdge: boolean
  field: number
}
