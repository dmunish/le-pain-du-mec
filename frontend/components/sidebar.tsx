"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Map, Network, BarChart } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { name: "Home", href: "/", icon: Home },
  { name: "Map View", href: "/map", icon: Map },
  { name: "Force-Directed Graph", href: "/graph", icon: Network },
  { name: "Charts", href: "/charts", icon: BarChart },
]

export function Sidebar() {
  const pathname = usePathname()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  return (
    <div className="glass-dark h-screen w-16 fixed left-0 top-0 flex flex-col items-center py-8 z-10">
      <div className="w-10 h-10 rounded-full bg-accent-orange flex items-center justify-center mb-12 animate-pulse">
        <span className="text-white font-bold text-lg">LP</span>
      </div>
      <nav className="flex flex-col items-center space-y-8">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const IconComponent = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative w-full flex justify-center py-3 transition-all duration-300"
              onMouseEnter={() => setHoveredItem(item.name)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <div className="relative flex items-center justify-center">
                {isActive && (
                  <div
                    className="absolute w-10 h-10 bg-accent-orange/20 rounded-full -z-10"
                    style={{ transform: "translate(-50%, -50%)", left: "50%", top: "50%" }}
                  ></div>
                )}
                <IconComponent
                  className={cn(
                    "h-6 w-6 transition-transform hover:scale-110",
                    isActive ? "text-accent-orange" : "text-line-gray",
                  )}
                />
              </div>
              {hoveredItem === item.name && (
                <div className="absolute left-16 glass text-white px-3 py-1.5 rounded-md text-xs whitespace-nowrap animate-fade-in">
                  {item.name}
                </div>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
