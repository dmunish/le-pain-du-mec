"use client"

import { useRef, useEffect } from "react"
import { EnhancedParticleAnimation } from "./enhanced-particle-animation"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface HeroOverlayProps {
  onScroll: () => void
  visible: boolean
}

export function HeroOverlay({ onScroll, visible }: HeroOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Handle scroll animation
  const handleScrollClick = () => {
    if (overlayRef.current) {
      onScroll()
    }
  }

  // Add wheel event listener to detect upward scrolling
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // If scrolling up (negative deltaY), dismiss the hero
      if (e.deltaY > 50 && visible) {
        e.preventDefault()
        onScroll()
      }
    }

    const overlay = overlayRef.current
    if (overlay && visible) {
      overlay.addEventListener("wheel", handleWheel, { passive: false })
    }

    return () => {
      if (overlay) {
        overlay.removeEventListener("wheel", handleWheel)
      }
    }
  }, [onScroll, visible])

  return (
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center transition-all duration-700 ease-in-out",
        visible ? "translate-y-0 shadow-2xl" : "translate-y-[-100%] shadow-none pointer-events-none",
      )}
    >
      <EnhancedParticleAnimation className="absolute inset-0 w-full h-full" />

      <div className="relative z-10 max-w-lg mx-auto text-center px-4">
        <div className="glass-light border border-gray-500/30 rounded-lg p-6 md:p-8 max-w-2xl mx-auto backdrop-blur-md bg-white/5">
          <h1 className="hero-title text-3xl sm:text-4xl mb-3 text-white font-serif">Le Pain du Mec</h1>
          <p className="hero-description text-sm sm:text-base mb-4 text-white/90 max-w-md mx-auto">
            Agent-based simulation tool for modelling epidemilogical disease spread
          </p>
        </div>

        <button
          onClick={handleScrollClick}
          className="mt-8 flex items-center justify-center mx-auto w-10 h-10 rounded-full bg-accent-orange/80 hover:bg-accent-orange transition-colors duration-300 text-white shadow-lg hover:shadow-xl"
          aria-label="Scroll up"
        >
          <ChevronDown className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}
