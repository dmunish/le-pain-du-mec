"use client"

import { useState, useRef, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { GlassCard } from "@/components/glass-card"
import { Button } from "@/components/ui/button"
import { HeroOverlay } from "@/components/hero-overlay"
import { PlaceSearch } from "@/components/place-search"
import { Play, ChevronDown, ChevronUp, AlertCircle } from "lucide-react"
import { useSimulation } from "@/context/simulation-context"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { env } from "@/lib/env"

export default function Home() {
  const { simulation, startSimulation, setLocation } = useSimulation()
  const [showHero, setShowHero] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [simulationParams, setSimulationParams] = useState({
    numberOfAgents: 10000,
    infectionProbability: 0.5,
    duration: 90,
    latentPeriod: 5,
    recoveryPeriod: 14,
    distanceThreshold: 2.0,
    deathRate: 2.1,
  })

  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef<number>(0)

  // Handle scroll events to show/hide hero
  useEffect(() => {
    const handleScroll = () => {
      if (!mainRef.current) return

      const currentScrollY = mainRef.current.scrollTop

      // Show hero when scrolling up at the top of the page
      if (currentScrollY < 50 && lastScrollY.current > currentScrollY) {
        setShowHero(true)
      }

      lastScrollY.current = currentScrollY
    }

    // Handle touch events for mobile devices
    let touchStartY = 0
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (showHero) {
        const touchY = e.touches[0].clientY
        const diff = touchStartY - touchY

        // If swiping up, dismiss the hero
        if (diff > 50) {
          setShowHero(false)
        }
      }
    }

    const mainElement = mainRef.current
    if (mainElement) {
      mainElement.addEventListener("scroll", handleScroll)
      mainElement.addEventListener("touchstart", handleTouchStart)
      mainElement.addEventListener("touchmove", handleTouchMove)

      return () => {
        mainElement.removeEventListener("scroll", handleScroll)
        mainElement.removeEventListener("touchstart", handleTouchStart)
        mainElement.removeEventListener("touchmove", handleTouchMove)
      }
    }
  }, [showHero])

  // Initialize map when hero is dismissed
  useEffect(() => {
    if (!mapContainer.current || showHero) return
    if (map.current) return

    // Check if token exists
    if (!env.MAPBOX_TOKEN) {
      setMapError(true)
      return
    }

    try {
      mapboxgl.accessToken = env.MAPBOX_TOKEN

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: simulation.coordinates,
        zoom: 12,
        interactive: false, // Make map non-interactive
      })
    } catch (error) {
      setMapError(true)
      console.error("Error initializing map:", error)
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [showHero, simulation.coordinates])

  const handleParamChange = (param: string, value: number) => {
    setSimulationParams((prev) => ({
      ...prev,
      [param]: value,
    }))
  }

  const handleStartSimulation = () => {
    startSimulation({
      placeName: simulation.location,
      coordinates: simulation.coordinates,
      ...simulationParams,
    })
  }

  const handlePlaceSelect = (place: { name: string; coordinates: [number, number] }) => {
    setLocation(place.name, place.coordinates)

    // Update map center if map exists
    if (map.current) {
      map.current.setCenter(place.coordinates)
    }
  }

  const handleHeroScroll = () => {
    setShowHero(false)

    // Add a small delay to ensure smooth animation
    setTimeout(() => {
      if (mainRef.current) {
        mainRef.current.scrollTo({
          top: 0,
          behavior: "smooth",
        })
      }
    }, 300)
  }

  return (
    <div className="flex min-h-screen">
      {/* Hero Overlay */}
      <HeroOverlay onScroll={handleHeroScroll} visible={showHero} />

      <Sidebar />
      <main ref={mainRef} className="flex-1 ml-16 h-screen overflow-y-auto">
        {/* Content Section */}
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 font-serif">Simulation Setup</h2>
            <p className="text-line-gray text-sm sm:text-base">
              Configure your disease simulation parameters and location.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-lg sm:text-xl font-medium text-white mb-3 font-serif">Location</h3>
            <PlaceSearch onPlaceSelect={handlePlaceSelect} className="mb-4" />

            <GlassCard className="h-48 sm:h-64" variant="dark">
              {mapError ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 text-accent-orange mb-4" />
                  <h3 className="text-lg sm:text-xl font-medium text-white mb-2">Mapbox API Key Required</h3>
                  <p className="text-line-gray text-center max-w-md text-sm sm:text-base">
                    To use the map feature, please add your Mapbox API key as an environment variable named
                    NEXT_PUBLIC_MAPBOX_TOKEN. You can get one by signing up at{" "}
                    <a href="https://mapbox.com" className="text-accent-orange hover:underline">
                      mapbox.com
                    </a>
                    .
                  </p>
                </div>
              ) : (
                <div ref={mapContainer} className="w-full h-full rounded-lg" />
              )}
            </GlassCard>
          </div>

          <GlassCard className="mb-6" variant="light">
            <h3 className="text-lg sm:text-xl font-medium text-white mb-4 font-serif">Simulation Parameters</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
              <div>
                <label className="text-xs text-line-gray block mb-1">Number of Agents</label>
                <input
                  type="number"
                  className="w-full bg-bg-dark/50 border border-line-gray/30 rounded-md px-3 py-2 text-white text-sm"
                  value={simulationParams.numberOfAgents}
                  onChange={(e) => handleParamChange("numberOfAgents", Number.parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-line-gray block mb-1">Infection Probability</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  className="w-full bg-bg-dark/50 border border-line-gray/30 rounded-md px-3 py-2 text-white text-sm"
                  value={simulationParams.infectionProbability}
                  onChange={(e) => handleParamChange("infectionProbability", Number.parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-line-gray block mb-1">Duration (days)</label>
                <input
                  type="number"
                  className="w-full bg-bg-dark/50 border border-line-gray/30 rounded-md px-3 py-2 text-white text-sm"
                  value={simulationParams.duration}
                  onChange={(e) => handleParamChange("duration", Number.parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="mb-4">
              <button
                className="flex items-center text-accent-orange text-sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                {showAdvanced ? "Hide Advanced Parameters" : "Show Advanced Parameters"}
              </button>
            </div>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                <div>
                  <label className="text-xs text-line-gray block mb-1">Latent Period (days)</label>
                  <input
                    type="number"
                    className="w-full bg-bg-dark/50 border border-line-gray/30 rounded-md px-3 py-2 text-white text-sm"
                    value={simulationParams.latentPeriod}
                    onChange={(e) => handleParamChange("latentPeriod", Number.parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-line-gray block mb-1">Recovery Period (days)</label>
                  <input
                    type="number"
                    className="w-full bg-bg-dark/50 border border-line-gray/30 rounded-md px-3 py-2 text-white text-sm"
                    value={simulationParams.recoveryPeriod}
                    onChange={(e) => handleParamChange("recoveryPeriod", Number.parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-line-gray block mb-1">Distance Threshold</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full bg-bg-dark/50 border border-line-gray/30 rounded-md px-3 py-2 text-white text-sm"
                    value={simulationParams.distanceThreshold}
                    onChange={(e) => handleParamChange("distanceThreshold", Number.parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-line-gray block mb-1">Death Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full bg-bg-dark/50 border border-line-gray/30 rounded-md px-3 py-2 text-white text-sm"
                    value={simulationParams.deathRate}
                    onChange={(e) => handleParamChange("deathRate", Number.parseFloat(e.target.value))}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button className="bg-accent-orange hover:bg-accent-orange/90 text-white" onClick={handleStartSimulation}>
                <Play className="h-4 w-4 mr-2" />
                Start Simulation
              </Button>
            </div>
          </GlassCard>

          {simulation.status !== "not_started" && (
            <GlassCard className="simulation-status-card" variant="dark">
              <div className="flex items-center space-x-3 text-accent-orange mb-3">
                <AlertCircle className="h-5 w-5" />
                <h3 className="text-lg sm:text-xl font-medium font-serif">Simulation Status</h3>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-white capitalize">{simulation.status.replace(/_/g, " ")}</span>
                  <span className="text-sm text-white">{simulation.progress.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-bg-dark/50 rounded-full">
                  <div
                    className="h-2 bg-accent-orange rounded-full transition-all duration-300 ease-in-out"
                    style={{ width: `${simulation.progress}%` }}
                  ></div>
                </div>
              </div>

              {simulation.status === "running" && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
                  <div className="glass p-3 rounded-lg">
                    <p className="text-line-gray text-xs">Total Agents</p>
                    <p className="text-white text-lg font-medium">{simulation.totalAgents.toLocaleString()}</p>
                  </div>
                  <div className="glass p-3 rounded-lg">
                    <p className="text-line-gray text-xs">Healthy</p>
                    <p className="text-white text-lg font-medium">{simulation.healthyAgents.toLocaleString()}</p>
                  </div>
                  <div className="glass p-3 rounded-lg">
                    <p className="text-line-gray text-xs">Exposed</p>
                    <p className="text-yellow-400 text-lg font-medium">{simulation.exposedAgents.toLocaleString()}</p>
                  </div>
                  <div className="glass p-3 rounded-lg">
                    <p className="text-line-gray text-xs">Infected</p>
                    <p className="text-accent-orange text-lg font-medium">
                      {simulation.infectedAgents.toLocaleString()}
                    </p>
                  </div>
                  <div className="glass p-3 rounded-lg">
                    <p className="text-line-gray text-xs">Day</p>
                    <p className="text-white text-lg font-medium">{simulation.day}</p>
                  </div>
                </div>
              )}
            </GlassCard>
          )}
        </div>
      </main>
    </div>
  )
}
