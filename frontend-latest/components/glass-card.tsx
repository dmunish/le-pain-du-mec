import type React from "react"
import { cn } from "@/lib/utils"

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  title?: string
  variant?: "default" | "dark" | "light" | "glow"
}

export function GlassCard({ children, className, title, variant = "default" }: GlassCardProps) {
  const baseClass = variant === "dark" ? "glass-dark" : variant === "light" ? "glass-light" : "glass"

  return (
    <div
      className={cn(
        baseClass,
        "rounded-lg p-5 transition-all duration-300",
        variant === "glow" && "animate-glow",
        className,
      )}
    >
      {title && (
        <div className="mb-4">
          <h3 className="text-white text-lg font-medium">{title}</h3>
          <div className="divider mt-2"></div>
        </div>
      )}
      {children}
    </div>
  )
}
