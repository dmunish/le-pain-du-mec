"use client"

import { useState, useRef, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { GlassCard } from "@/components/glass-card"
import { Button } from "@/components/ui/button"
import { HeroOverlay } from "@/components/hero-overlay"
import { PlaceSearch } from "@/components/place-search"
import { Play, ChevronDown, ChevronUp, AlertCircle, RefreshCw, Pause, PlayIcon } from "lucide-react"
import { useSimulation } from "@/context/simulation-context"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { env } from "@/lib/env"
import { PollingRateControl } from "@/components/polling-rate-control"
import type { SimulationParameters } from "@/types/api"

export default function Home() {
  const { simulation, startSimulation, pauseSimulation, resumeSimulation, resetSimulation, setLocation } =
    useSimulation()
  const [showHero, setShowHero] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [simulationParams, setSimulationParams] = useState<SimulationParameters>({
    placeName: "Linz, Austria", // Default from backend
    coordinates: [14.2858, 48.3069], // Coordinates for Linz, Austria
    numberOfAgents: 500, // Default from backend
    infectionProbability: 0.2, // Default from backend
    duration: 90,
    latentPeriod: 120, // Default from backend
    recoveryPeriod: 168, // Default from backend
    distanceThreshold: 0.5, // Default from backend
    deathRate: 0.01, // Default from backend
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

  const handleParamChange = (param: keyof SimulationParameters, value: number) => {
    // Ensure value is a valid number
    if (!isNaN(value)) {
      setSimulationParams((prev) => ({
        ...prev,
        [param]: value,
      }))
    }
  }

  // Update the handleStartSimulation function to ensure all parameters are valid
  const handleStartSimulation = () => {
    // Ensure all numeric parameters are valid numbers
    const validParams: SimulationParameters = {
      ...simulationParams,
      placeName: simulation.location,
      coordinates: simulation.coordinates,
      numberOfAgents: Math.max(1, Number.parseInt(String(simulationParams.numberOfAgents)) || 500),
      infectionProbability: Math.min(
        1,
        Math.max(0, Number.parseFloat(String(simulationParams.infectionProbability)) || 0.2),
      ),
      duration: Math.max(1, Number.parseInt(String(simulationParams.duration)) || 90),
      latentPeriod: Math.max(0, Number.parseInt(String(simulationParams.latentPeriod)) || 120),
      recoveryPeriod: Math.max(1, Number.parseInt(String(simulationParams.recoveryPeriod)) || 168),
      distanceThreshold: Math.max(0.1, Number.parseFloat(String(simulationParams.distanceThreshold)) || 0.5),
      deathRate: Math.max(0, Number.parseFloat(String(simulationParams.deathRate)) || 0.01),
    }

    // Check if a location has been selected
    if (!simulation.location) {
      alert("Please select a location before starting the simulation")
      return
    }

    // Start a new simulation - this will discard any previous simulation data
    startSimulation(validParams)
  }

  const handleResetSimulation = () => {
    // Reset the simulation completely
    resetSimulation()
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

  const handleTogglePause = () => {
    if (simulation.status === "running") {
      pauseSimulation()
    } else if (simulation.status === "paused") {
      resumeSimulation()
    }
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
                  <label className="text-xs text-line-gray block mb-1">Latent Period (hours)</label>
                  <input
                    type="number"
                    className="w-full bg-bg-dark/50 border border-line-gray/30 rounded-md px-3 py-2 text-white text-sm"
                    value={simulationParams.latentPeriod}
                    onChange={(e) => handleParamChange("latentPeriod", Number.parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-line-gray block mb-1">Recovery Period (hours)</label>
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
                  <label className="text-xs text-line-gray block mb-1">Death Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-bg-dark/50 border border-line-gray/30 rounded-md px-3 py-2 text-white text-sm"
                    value={simulationParams.deathRate}
                    onChange={(e) => handleParamChange("deathRate", Number.parseFloat(e.target.value))}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <PollingRateControl />
              </div>
              <div className="flex gap-2">
                {simulation.status !== "not_started" && (
                  <>
                    {(simulation.status === "running" || simulation.status === "paused") && (
                      <Button
                        variant="outline"
                        className="border-accent-orange text-accent-orange hover:bg-accent-orange/10"
                        onClick={handleTogglePause}
                      >
                        {simulation.status === "running" ? (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </>
                        ) : (
                          <>
                            <PlayIcon className="h-4 w-4 mr-2" />
                            Resume
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="border-accent-orange text-accent-orange hover:bg-accent-orange/10"
                      onClick={handleResetSimulation}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  </>
                )}
                <Button
                  className="bg-accent-orange hover:bg-accent-orange/90 text-white"
                  onClick={handleStartSimulation}
                  disabled={simulation.status === "running" || simulation.status === "initializing"}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Simulation
                </Button>
              </div>
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

              {(simulation.status === "running" || simulation.status === "paused") && (
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
                    <p className="text-white text-lg font-medium">{Math.floor(simulation.day / 24)}</p>
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
