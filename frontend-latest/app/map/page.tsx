"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { GlassCard } from "@/components/glass-card"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import {
  Thermometer,
  AlertCircle,
  MapPin,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RefreshCw,
  Globe,
  ZoomIn,
  ZoomOut,
  Compass,
  Home,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { env } from "@/lib/env"
import { useSimulation } from "@/context/simulation-context"
import { useRouter } from "next/navigation"
import { Slider } from "@/components/ui/slider"
import { Slider as SliderPrimitive } from "@/components/ui/slider"

interface Agent {
  id: string
  name: string
  age: number
  status: "healthy" | "infected" | "recovered" | "deceased"
  location: [number, number]
  destination: [number, number]
  path: [number, number][]
  destinationName: string
  infectedDay?: number
  marker?: mapboxgl.Marker
  visible?: boolean
}

export default function MapView() {
  const { simulation, isSimulationActive } = useSimulation()
  const router = useRouter()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [simulationDay, setSimulationDay] = useState(1)
  const [maxDay, setMaxDay] = useState(30)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(1)
  const [isGlobeView, setIsGlobeView] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const animationRef = useRef<number | null>(null)
  const agentsRef = useRef<Agent[]>([])
  const isInitializedRef = useRef<boolean>(false)
  const mapInitializedRef = useRef<boolean>(false)
  const currentZoomRef = useRef<number>(14)

  const generateHeatmapData = useCallback(() => {
    if (!map.current || !isSimulationActive() || agentsRef.current.length === 0) return null

    const features = []
    for (const agent of agentsRef.current) {
      if (agent.status === "infected" && agent.visible !== false) {
        features.push({
          type: "Feature",
          properties: { intensity: 1 },
          geometry: { type: "Point", coordinates: agent.location },
        })

        for (let i = 0; i < 5; i++) {
          const offsetLng = (Math.random() - 0.5) * 0.01
          const offsetLat = (Math.random() - 0.5) * 0.01
          features.push({
            type: "Feature",
            properties: { intensity: 0.5 },
            geometry: {
              coordinates: [agent.location[0] + offsetLng, agent.location[1] + offsetLat],
              type: "Point",
            },
          })
        }
      }
    }

    return { type: "FeatureCollection", features }
  }, [isSimulationActive])

  const updateAgentVisibility = useCallback(
    (zoom: number) => {
      if (!map.current || agentsRef.current.length === 0) return

      const cityZoom = 10
      const regionZoom = 6
      const countryZoom = 4
      let visibilityPercentage = 1.0

      if (zoom < cityZoom && zoom >= regionZoom) {
        visibilityPercentage = 0.5 + ((zoom - regionZoom) / (cityZoom - regionZoom)) * 0.5
      } else if (zoom < regionZoom && zoom >= countryZoom) {
        visibilityPercentage = 0.1 + ((zoom - countryZoom) / (regionZoom - countryZoom)) * 0.4
      } else if (zoom < countryZoom) {
        visibilityPercentage = Math.max(0.05, (zoom / countryZoom) * 0.1)
      }

      const totalAgents = agentsRef.current.length
      const agentsToShow = Math.max(5, Math.floor(totalAgents * visibilityPercentage))
      const center = map.current.getCenter()

      const sortedAgents = [...agentsRef.current].sort((a, b) => {
        if (a.status === "infected" && b.status !== "infected") return -1
        if (a.status !== "infected" && b.status === "infected") return 1
        const distA = Math.pow(a.location[0] - center.lng, 2) + Math.pow(a.location[1] - center.lat, 2)
        const distB = Math.pow(b.location[0] - center.lng, 2) + Math.pow(b.location[1] - center.lat, 2)
        return distA - distB
      })

      agentsRef.current.forEach((agent, index) => {
        const shouldBeVisible = index < agentsToShow
        agent.visible = shouldBeVisible
        if (agent.marker) {
          agent.marker.getElement().style.display = shouldBeVisible ? "block" : "none"
        }
      })

      const newHeatmapData = generateHeatmapData()
      if (newHeatmapData && map.current.getSource("infection-heatmap")) {
        ;(map.current.getSource("infection-heatmap") as mapboxgl.GeoJSONSource).setData(newHeatmapData)
      }
    },
    [generateHeatmapData],
  )

  const updateAgentPositions = useCallback(
    (day: number) => {
      if (!map.current || agentsRef.current.length === 0) return

      agentsRef.current.forEach((agent, index) => {
        if (!agent.marker) return
        const pathIndex = Math.min(day - 1, agent.path.length - 1)
        const position = agent.path[pathIndex]
        agent.marker.setLngLat(position)

        const el = agent.marker.getElement()

        // Use deterministic approach based on agent ID and day for consistency
        if (agent.status === "healthy") {
          const infectionSeed = (index * 13 + day * 7) % 100
          if (infectionSeed < (5 * day) / maxDay && infectionSeed < 30) {
            agent.status = "infected"
            agent.infectedDay = day
            el.style.backgroundColor = "#F56E0F"
            el.style.boxShadow = "0 0 10px #F56E0F"
          }
        } else if (agent.status === "infected") {
          const recoverySeed = (index * 11 + day * 5) % 100
          const daysSinceInfection = day - (agent.infectedDay || 0)
          if (daysSinceInfection > 7 && recoverySeed < 20) {
            const fatalitySeed = (index * 7 + day * 3) % 100
            if (fatalitySeed < 15) {
              agent.status = "deceased"
              el.style.backgroundColor = "#878787"
              el.style.boxShadow = "none"
            } else {
              agent.status = "recovered"
              el.style.backgroundColor = "#4b607f"
              el.style.boxShadow = "none"
            }
          }
        }
      })

      const newHeatmapData = generateHeatmapData()
      if (newHeatmapData && map.current.getSource("infection-heatmap")) {
        ;(map.current.getSource("infection-heatmap") as mapboxgl.GeoJSONSource).setData(newHeatmapData)
      }
    },
    [generateHeatmapData, maxDay],
  )

  const addAgentsToMap = useCallback(() => {
    if (!map.current || agentsRef.current.length === 0) return

    agentsRef.current.forEach((agent) => {
      if (agent.marker) return

      const el = document.createElement("div")
      el.className = "agent-marker"
      el.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        transition: all 0.5s ease;
        background-color: ${
          agent.status === "healthy"
            ? "#FFFFFF"
            : agent.status === "infected"
              ? "#F56E0F"
              : agent.status === "recovered"
                ? "#4b607f"
                : "#878787"
        };
        ${agent.status === "infected" ? "box-shadow: 0 0 10px #F56E0F;" : ""}
      `

      // No click event listener - agents are not clickable anymore

      agent.marker = new mapboxgl.Marker(el).setLngLat(agent.location).addTo(map.current)
    })

    if (map.current) {
      updateAgentVisibility(map.current.getZoom())
    }
  }, [updateAgentVisibility])

  useEffect(() => {
    if (!isSimulationActive() || agentsRef.current.length > 0) return

    // Generate random coordinates around the center
    const generateRandomCoordinate = (center: [number, number], radius: number): [number, number] => {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * radius
      const lat = center[1] + distance * Math.cos(angle) * 0.01
      const lng = center[0] + distance * Math.sin(angle) * 0.01
      return [lng, lat]
    }

    // Generate random path between two points
    const generatePath = (start: [number, number], end: [number, number], points: number): [number, number][] => {
      const path: [number, number][] = [start]

      for (let i = 1; i < points; i++) {
        const ratio = i / points
        const lat = start[1] + (end[1] - start[1]) * ratio + (Math.random() - 0.5) * 0.002
        const lng = start[0] + (end[0] - start[0]) * ratio + (Math.random() - 0.5) * 0.002
        path.push([lng, lat])
      }

      path.push(end)
      return path
    }

    const names = [
      "John Doe",
      "Jane Smith",
      "Bob Johnson",
      "Alice Brown",
      "Charlie Davis",
      "Diana Evans",
      "Edward Foster",
      "Fiona Grant",
      "George Harris",
      "Hannah Irving",
    ]

    const destinations = [
      "Work",
      "Grocery Store",
      "Home",
      "Hospital",
      "School",
      "Park",
      "Restaurant",
      "Gym",
      "Mall",
      "Library",
    ]

    const agents: Agent[] = []
    const center = simulation.coordinates

    for (let i = 0; i < 20; i++) {
      const status = i < 3 ? "infected" : i < 15 ? "healthy" : i < 18 ? "recovered" : "deceased"
      const location = generateRandomCoordinate(center, 5)
      const destination = generateRandomCoordinate(center, 5)
      const path = generatePath(location, destination, 10)

      agents.push({
        id: `agent-${i}`,
        name: names[i % names.length],
        age: 20 + Math.floor(Math.random() * 60),
        status,
        location,
        destination,
        path,
        destinationName: destinations[i % destinations.length],
        infectedDay: status === "infected" ? Math.floor(Math.random() * 5) + 1 : undefined,
        visible: true,
      })
    }

    agentsRef.current = agents
    isInitializedRef.current = true
  }, [isSimulationActive, simulation.coordinates])

  // Fixed map initialization useEffect
  useEffect(() => {
    if (!mapContainer.current || !isSimulationActive() || mapInitializedRef.current) return

    if (!env.MAPBOX_TOKEN) {
      setMapError(true)
      return
    }

    try {
      mapboxgl.accessToken = env.MAPBOX_TOKEN || "pk.dummy.token"

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: simulation.coordinates,
        zoom: 14,
      })

      map.current.on("load", () => {
        // Add resize handler to ensure map fills container
        const resizeMap = () => {
          if (map.current) {
            map.current.resize()
          }
        }

        // Add resize event listener
        window.addEventListener("resize", resizeMap)

        setMapLoaded(true)
        mapInitializedRef.current = true

        if (map.current) {
          // Generate initial heatmap data
          const initialHeatmapData = generateHeatmapData() || {
            type: "FeatureCollection",
            features: [],
          }

          // Add heatmap source
          map.current.addSource("infection-heatmap", {
            type: "geojson",
            data: initialHeatmapData,
          })

          // Add heatmap layer
          map.current.addLayer(
            {
              id: "infection-heat",
              type: "heatmap",
              source: "infection-heatmap",
              paint: {
                // Increase weight as diameter increases
                "heatmap-weight": ["get", "intensity"],
                // Increase intensity as zoom level increases
                "heatmap-intensity": 1,
                // Assign color values be applied to points depending on their density
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0,
                  "rgba(0, 0, 255, 0)",
                  0.2,
                  "rgba(0, 0, 255, 0.5)",
                  0.4,
                  "rgba(0, 255, 255, 0.7)",
                  0.6,
                  "rgba(255, 255, 0, 0.8)",
                  0.8,
                  "rgba(255, 0, 0, 0.9)",
                  1,
                  "rgba(255, 0, 0, 1)",
                ],
                // Adjust the heatmap radius with zoom level
                "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
                // Transition from heatmap to circle layer by zoom level
                "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 9, 0.5],
              },
            },
            "waterway-label",
          )
          map.current.setLayoutProperty("infection-heat", "visibility", "none")

          // Add agents to the map
          addAgentsToMap()

          // Update agent positions for day 1
          updateAgentPositions(1)

          map.current.on("zoom", () => {
            if (!map.current) return
            const zoom = map.current.getZoom()
            if (Math.abs(zoom - currentZoomRef.current) > 0.5) {
              currentZoomRef.current = zoom
              updateAgentVisibility(zoom)
            }
          })
        }

        // Add to cleanup function
        return () => {
          window.removeEventListener("resize", resizeMap)
          if (map.current) {
            map.current.remove()
            map.current = null
            mapInitializedRef.current = false
          }
        }
      })
    } catch (error) {
      setMapError(true)
      console.error("Map init error:", error)
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
        mapInitializedRef.current = false
      }
    }
  }, [
    isSimulationActive,
    simulation.coordinates,
    addAgentsToMap,
    updateAgentPositions,
    updateAgentVisibility,
    generateHeatmapData,
  ])

  // Add a resize observer to handle container size changes
  useEffect(() => {
    if (!mapContainer.current || !map.current) return

    const resizeObserver = new ResizeObserver(() => {
      if (map.current) {
        map.current.resize()
      }
    })

    resizeObserver.observe(mapContainer.current)

    return () => {
      if (mapContainer.current) {
        resizeObserver.unobserve(mapContainer.current)
      }
    }
  }, [mapLoaded])

  // Map control functions
  const handleZoomIn = useCallback(() => {
    if (map.current) {
      map.current.zoomIn()
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    if (map.current) {
      map.current.zoomOut()
    }
  }, [])

  const handleResetNorth = useCallback(() => {
    if (map.current) {
      map.current.setBearing(0)
    }
  }, [])

  const handleRecenterMap = useCallback(() => {
    if (map.current) {
      map.current.flyTo({
        center: simulation.coordinates,
        zoom: 14,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      })
    }
  }, [simulation.coordinates])

  const handleToggleHeatmap = useCallback(() => {
    if (map.current) {
      const visibility = !showHeatmap
      map.current.setLayoutProperty("infection-heat", "visibility", visibility ? "visible" : "none")
      setShowHeatmap(visibility)
    }
  }, [showHeatmap])

  // Toggle globe view
  const toggleGlobeView = useCallback(() => {
    if (!map.current) return

    if (isGlobeView) {
      // Zoom back to location
      map.current.flyTo({
        center: simulation.coordinates,
        zoom: 14,
        duration: 2000,
      })
    } else {
      // Zoom out to globe view
      map.current.flyTo({
        center: [0, 20], // Center on equator
        zoom: 1,
        duration: 2000,
      })
    }

    setIsGlobeView(!isGlobeView)
  }, [isGlobeView, simulation.coordinates])

  // Add a function to handle progress bar dragging
  const handleDayChange = useCallback(
    (value: number[]) => {
      const newDay = value[0]
      setSimulationDay(newDay)
      updateAgentPositions(newDay)
    },
    [updateAgentPositions],
  )

  // Animation logic
  useEffect(() => {
    if (isPlaying && isSimulationActive()) {
      let lastTime = 0
      const frameDuration = 1000 / playSpeed // ms per day

      const animate = (time: number) => {
        if (time - lastTime >= frameDuration) {
          lastTime = time
          setSimulationDay((prev) => {
            if (prev >= maxDay) {
              setIsPlaying(false)
              return maxDay
            }
            const newDay = prev + 1
            updateAgentPositions(newDay)
            return newDay
          })
        }

        if (simulationDay < maxDay) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [isPlaying, simulationDay, maxDay, playSpeed, isSimulationActive, updateAgentPositions])

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleReset = useCallback(() => {
    setIsPlaying(false)
    setSimulationDay(1)
    updateAgentPositions(1)
  }, [updateAgentPositions])

  const handleSkipForward = useCallback(() => {
    const newDay = Math.min(simulationDay + 1, maxDay)
    setSimulationDay(newDay)
    updateAgentPositions(newDay)
  }, [simulationDay, maxDay, updateAgentPositions])

  const handleSkipBack = useCallback(() => {
    const newDay = Math.max(simulationDay - 1, 1)
    setSimulationDay(newDay)
    updateAgentPositions(newDay)
  }, [simulationDay, updateAgentPositions])

  const handleStartSimulation = useCallback(() => {
    router.push("/")
  }, [router])

  // Calculate stats based on agents
  const stats = useMemo(
    () => ({
      day: simulationDay,
      totalAgents: agentsRef.current.length,
      healthyAgents: agentsRef.current.filter((a) => a.status === "healthy").length,
      infectedAgents: agentsRef.current.filter((a) => a.status === "infected").length,
      recoveredAgents: agentsRef.current.filter((a) => a.status === "recovered").length,
      deceasedAgents: agentsRef.current.filter((a) => a.status === "deceased").length,
    }),
    [simulationDay],
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-16 p-4 sm:p-6 orange-glow">
        <div className="max-w-7xl mx-auto animate-fade-in">
          {!isSimulationActive() ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)]">
              <GlassCard className="max-w-md text-center p-8" variant="dark">
                <h2 className="text-2xl font-bold text-white mb-4 font-serif">Simulation Not Started</h2>
                <p className="text-line-gray mb-6">
                  Please start a simulation to view the map data. Configure your parameters on the home page.
                </p>
                <Button
                  className="bg-accent-orange hover:bg-accent-orange/90 text-white"
                  onClick={handleStartSimulation}
                >
                  <Home className="h-5 w-5" />
                </Button>
              </GlassCard>
            </div>
          ) : (
            <div className="flex flex-col space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold text-white gradient-text font-serif">Map View</h1>
                <Button
                  variant="outline"
                  className="bg-transparent border-line-gray text-white hover:bg-accent-blue/20"
                  onClick={toggleGlobeView}
                >
                  <Globe className="h-5 w-5" />
                </Button>
              </div>

              {/* Increased height map container */}
              <GlassCard className="h-[calc(100vh-16rem)] relative" variant="dark">
                {mapError ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <AlertCircle className="h-12 w-12 text-accent-orange mb-4" />
                    <h3 className="text-xl font-medium text-white mb-2">Mapbox API Key Required</h3>
                    <p className="text-line-gray text-center max-w-md">
                      To use the map feature, please add your Mapbox API key as an environment variable named
                      NEXT_PUBLIC_MAPBOX_TOKEN. You can get one by signing up at{" "}
                      <a href="https://mapbox.com" className="text-accent-orange hover:underline">
                        mapbox.com
                      </a>
                      .
                    </p>
                  </div>
                ) : (
                  <div className="w-full h-full overflow-hidden relative">
                    <div ref={mapContainer} className="map-container w-full h-full absolute inset-0" />

                    {/* Map controls in the top-right corner - now properly contained */}
                    <div className="absolute top-4 right-4 z-10">
                      <div className="glass-dark p-2 rounded-lg flex flex-col gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white hover:bg-accent-blue/20"
                          onClick={handleZoomIn}
                          title="Zoom In"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white hover:bg-accent-blue/20"
                          onClick={handleZoomOut}
                          title="Zoom Out"
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <div className="h-px bg-line-gray/30 my-1"></div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white hover:bg-accent-blue/20"
                          onClick={handleResetNorth}
                          title="Reset North"
                        >
                          <Compass className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white hover:bg-accent-blue/20"
                          onClick={handleRecenterMap}
                          title="Recenter Map"
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                        <div className="h-px bg-line-gray/30 my-1"></div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 text-white hover:bg-accent-blue/20 ${
                            showHeatmap ? "bg-accent-orange/20" : ""
                          }`}
                          onClick={handleToggleHeatmap}
                          title="Toggle Heatmap"
                        >
                          <Thermometer className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* Simulation Controls */}
              <GlassCard variant="light">
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-transparent border-line-gray text-white hover:bg-accent-blue/20"
                        onClick={handleReset}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-transparent border-line-gray text-white hover:bg-accent-blue/20"
                        onClick={handleSkipBack}
                        disabled={simulationDay <= 1}
                      >
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      <Button
                        className="h-8 w-8 bg-accent-orange hover:bg-accent-orange/90 text-white"
                        onClick={handlePlayPause}
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-transparent border-line-gray text-white hover:bg-accent-blue/20"
                        onClick={handleSkipForward}
                        disabled={simulationDay >= maxDay}
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-line-gray text-xs">Speed:</span>
                      <Slider
                        value={[playSpeed]}
                        min={0.5}
                        max={5}
                        step={0.5}
                        onValueChange={(value) => setPlaySpeed(value[0])}
                        className="w-32"
                      />
                      <span className="text-white text-xs">{playSpeed}x</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-line-gray text-xs">Day:</span>
                      <span className="text-white font-medium">{simulationDay}</span>
                      <span className="text-line-gray text-xs">of</span>
                      <span className="text-white font-medium">{maxDay}</span>
                    </div>
                  </div>

                  <div className="relative">
                    <SliderPrimitive
                      value={[simulationDay]}
                      min={1}
                      max={maxDay}
                      step={1}
                      onValueChange={handleDayChange}
                      className="w-full"
                    />
                  </div>
                </div>
              </GlassCard>

              {/* Legend and Agent Statistics in a grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <GlassCard title="Agent Legend" variant="light">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass p-3 rounded-lg flex items-center">
                      <div className="w-3 h-3 rounded-full bg-white mr-2"></div>
                      <span className="text-white text-sm">Healthy</span>
                    </div>
                    <div className="glass p-3 rounded-lg flex items-center">
                      <div
                        className="w-3 h-3 rounded-full bg-accent-orange mr-2"
                        style={{ boxShadow: "0 0 5px #F56E0F" }}
                      ></div>
                      <span className="text-white text-sm">Infected</span>
                    </div>
                    <div className="glass p-3 rounded-lg flex items-center">
                      <div className="w-3 h-3 rounded-full bg-accent-blue mr-2"></div>
                      <span className="text-white text-sm">Recovered</span>
                    </div>
                    <div className="glass p-3 rounded-lg flex items-center">
                      <div className="w-3 h-3 rounded-full bg-line-gray mr-2"></div>
                      <span className="text-white text-sm">Deceased</span>
                    </div>
                    {showHeatmap && (
                      <div className="glass p-3 rounded-lg flex items-center col-span-2">
                        <div
                          className="w-24 h-3 mr-2 rounded-sm"
                          style={{
                            background:
                              "linear-gradient(90deg, rgba(0,0,255,0.5) 0%, rgba(0,255,255,0.7) 40%, rgba(255,255,0,0.8) 60%, rgba(255,0,0,0.9) 80%, rgba(255,0,0,1) 100%)",
                          }}
                        ></div>
                        <span className="text-white text-sm">Infection Density</span>
                      </div>
                    )}
                  </div>
                </GlassCard>

                <GlassCard title="Agent Statistics" variant="light">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass p-3 rounded-lg">
                      <p className="text-line-gray text-xs">Healthy</p>
                      <p className="text-white text-lg font-medium">{stats.healthyAgents.toLocaleString()}</p>
                    </div>
                    <div className="glass p-3 rounded-lg">
                      <p className="text-line-gray text-xs">Infected</p>
                      <p className="text-accent-orange text-lg font-medium">{stats.infectedAgents.toLocaleString()}</p>
                    </div>
                    <div className="glass p-3 rounded-lg">
                      <p className="text-line-gray text-xs">Recovered</p>
                      <p className="text-accent-blue text-lg font-medium">{stats.recoveredAgents.toLocaleString()}</p>
                    </div>
                    <div className="glass p-3 rounded-lg">
                      <p className="text-line-gray text-xs">Deceased</p>
                      <p className="text-line-gray text-lg font-medium">{stats.deceasedAgents.toLocaleString()}</p>
                    </div>
                  </div>
                </GlassCard>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
