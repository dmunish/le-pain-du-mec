import type React from "react"
import { cn } from "@/lib/utils"

interface FrostedCardProps {
  children: React.ReactNode
  className?: string
  title?: string
}

export function FrostedCard({ children, className, title }: FrostedCardProps) {
  return (
    <div className={cn("frosted-glass rounded-lg p-4 shadow-lg", className)}>
      {title && <h3 className="text-snow text-lg font-medium mb-4">{title}</h3>}
      {children}
    </div>
  )
}
