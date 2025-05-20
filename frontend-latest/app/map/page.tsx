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
import { PollingRateControl } from "@/components/polling-rate-control"

// Define agent marker interface
interface AgentMarker {
  id: number
  status: "healthy" | "infected" | "recovered" | "deceased"
  age: number
  location: [number, number]
  marker?: mapboxgl.Marker
  visible?: boolean
}

// Define a type for agent feature properties
interface AgentProperties {
  id: number
  state?: string
  age?: number
  [key: string]: any
}

// Define a type for agent feature geometry
interface AgentGeometry {
  type: string
  coordinates: [number, number]
}

// Define a type for agent feature
interface AgentFeature {
  type: string
  properties: AgentProperties
  geometry: AgentGeometry
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
  const agentsRef = useRef<Map<number, AgentMarker>>(new Map()) // Changed to Map for efficient lookups
  const mapInitializedRef = useRef<boolean>(false)
  const currentZoomRef = useRef<number>(14)
  const heatmapInitializedRef = useRef<boolean>(false)
  const [mapLoadAttempted, setMapLoadAttempted] = useState(false)

  // Convert agent state to status
  const getStatusFromState = (state: string): "healthy" | "infected" | "recovered" | "deceased" => {
    switch (state) {
      case "I":
        return "infected"
      case "R":
        return "recovered"
      case "D":
        return "deceased"
      case "E":
        return "infected" // Treat exposed as infected for visualization
      case "S":
      default:
        return "healthy"
    }
  }

  // Generate heatmap data from agents
  const generateHeatmapData = useCallback(() => {
    try {
      if (!map.current || !isSimulationActive() || !simulation.currentStepData) {
        return {
          type: "FeatureCollection",
          features: [],
        }
      }

      const features = []
      const agents = simulation.currentStepData.agents?.features || []
      const infectedAgents = agents.filter((agent) => {
        if (!agent?.properties?.state) return false
        const state = agent.properties.state
        return state === "I" || state === "E"
      })

      for (const agent of infectedAgents) {
        if (!agent.geometry?.coordinates) continue

        try {
          const [lng, lat] = agent.geometry.coordinates

          // Validate coordinates
          if (
            typeof lng !== "number" ||
            typeof lat !== "number" ||
            isNaN(lng) ||
            isNaN(lat) ||
            !isFinite(lng) ||
            !isFinite(lat)
          ) {
            continue
          }

          features.push({
            type: "Feature",
            properties: { intensity: 1 },
            geometry: { type: "Point", coordinates: [lng, lat] },
          })

          // Add some random points around infected agents for better heatmap visualization
          for (let i = 0; i < 5; i++) {
            const offsetLng = (Math.random() - 0.5) * 0.01
            const offsetLat = (Math.random() - 0.5) * 0.01
            features.push({
              type: "Feature",
              properties: { intensity: 0.5 },
              geometry: {
                coordinates: [lng + offsetLng, lat + offsetLat],
                type: "Point",
              },
            })
          }
        } catch (error) {
          console.error("Error processing agent for heatmap:", error)
        }
      }

      return { type: "FeatureCollection", features }
    } catch (error) {
      console.error("Error generating heatmap data:", error)
      return {
        type: "FeatureCollection",
        features: [],
      }
    }
  }, [isSimulationActive, simulation.currentStepData])

  // Update agent visibility based on zoom level
  const updateAgentVisibility = useCallback(
    (zoom: number) => {
      try {
        if (!map.current || agentsRef.current.size === 0) return

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

        const totalAgents = agentsRef.current.size
        const agentsToShow = Math.max(5, Math.floor(totalAgents * visibilityPercentage))
        const center = map.current.getCenter()

        // Prioritize infected agents and those closer to the center
        const sortedAgents = Array.from(agentsRef.current.values()).sort((a, b) => {
          if (a.status === "infected" && b.status !== "infected") return -1
          if (a.status !== "infected" && b.status === "infected") return 1
          const distA = Math.pow(a.location[0] - center.lng, 2) + Math.pow(a.location[1] - center.lat, 2)
          const distB = Math.pow(b.location[0] - center.lng, 2) + Math.pow(b.location[1] - center.lat, 2)
          return distA - distB
        })

        sortedAgents.forEach((agent, index) => {
          try {
            const shouldBeVisible = index < agentsToShow
            agent.visible = shouldBeVisible
            if (agent.marker) {
              const el = agent.marker.getElement()
              if (el) {
                el.style.display = shouldBeVisible ? "block" : "none"
              }
            }
          } catch (error) {
            console.error("Error updating agent visibility:", error)
          }
        })

        // Update heatmap if enabled
        if (showHeatmap && heatmapInitializedRef.current) {
          try {
            const newHeatmapData = generateHeatmapData()
            if (map.current && map.current.getSource("infection-heatmap")) {
              ;(map.current.getSource("infection-heatmap") as mapboxgl.GeoJSONSource).setData(newHeatmapData)
            }
          } catch (error) {
            console.error("Error updating heatmap:", error)
          }
        }
      } catch (error) {
        console.error("Error in updateAgentVisibility:", error)
      }
    },
    [generateHeatmapData, showHeatmap],
  )

  // Initialize map only once
  useEffect(() => {
    if (!mapContainer.current || mapInitializedRef.current || mapLoadAttempted) {
      return
    }

    setMapLoadAttempted(true)

    if (!env.MAPBOX_TOKEN) {
      setMapError(true)
      return
    }

    try {
      mapboxgl.accessToken = env.MAPBOX_TOKEN

      const defaultCoordinates: [number, number] = [0, 0]
      const coordinates = simulation.coordinates || defaultCoordinates

      // Validate coordinates
      if (
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        typeof coordinates[0] !== "number" ||
        typeof coordinates[1] !== "number" ||
        isNaN(coordinates[0]) ||
        isNaN(coordinates[1]) ||
        !isFinite(coordinates[0]) ||
        !isFinite(coordinates[1])
      ) {
        console.error("Invalid coordinates:", coordinates)
        setMapError(true)
        return
      }

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: coordinates,
        zoom: 14,
      })

      map.current.on("load", () => {
        if (!map.current) return

        // Add resize handler to ensure map fills container
        const resizeMap = () => {
          if (map.current) {
            try {
              map.current.resize()
            } catch (error) {
              console.error("Error resizing map:", error)
            }
          }
        }

        // Add resize event listener
        window.addEventListener("resize", resizeMap)

        try {
          // Add heatmap source and layer
          map.current.addSource("infection-heatmap", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
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
          heatmapInitializedRef.current = true
        } catch (error) {
          console.error("Error initializing heatmap:", error)
          heatmapInitializedRef.current = false
        }

        if (map.current) {
          map.current.on("zoom", () => {
            if (!map.current) return
            try {
              const zoom = map.current.getZoom()
              if (Math.abs(zoom - currentZoomRef.current) > 0.5) {
                currentZoomRef.current = zoom
                updateAgentVisibility(zoom)
              }
            } catch (error) {
              console.error("Error in zoom handler:", error)
            }
          })
        }

        setMapLoaded(true)
        mapInitializedRef.current = true

        return () => {
          window.removeEventListener("resize", resizeMap)
        }
      })

      map.current.on("error", (e) => {
        console.error("Mapbox error:", e)
        setMapError(true)
      })
    } catch (error) {
      setMapError(true)
      console.error("Map init error:", error)
    }

    return () => {
      // Don't remove the map on component unmount to prevent flickering
      // We'll handle cleanup in a separate effect
    }
  }, [simulation.coordinates, updateAgentVisibility])

  // Cleanup map on final unmount
  useEffect(() => {
    return () => {
      try {
        if (map.current) {
          map.current.remove()
          map.current = null
          mapInitializedRef.current = false
          heatmapInitializedRef.current = false
        }
      } catch (error) {
        console.error("Error cleaning up map:", error)
      }
    }
  }, [])

  // Update agent positions when simulation data changes
  useEffect(() => {
    if (!mapLoaded || !map.current) return
    if (!simulation.currentStepData?.agents?.features) return

    try {
      const currentAgents = simulation.currentStepData.agents.features
      const currentAgentIds = new Set<number>()

      // Update existing markers and create new ones
      currentAgents.forEach((feature: AgentFeature) => {
        try {
          if (!feature.properties || !feature.geometry?.coordinates) return

          const id = feature.properties.id
          if (id === undefined) return

          // Validate coordinates
          const [lng, lat] = feature.geometry.coordinates
          if (
            typeof lng !== "number" ||
            typeof lat !== "number" ||
            isNaN(lng) ||
            isNaN(lat) ||
            !isFinite(lng) ||
            !isFinite(lat)
          ) {
            console.warn("Invalid coordinates for agent:", id, feature.geometry.coordinates)
            return
          }

          currentAgentIds.add(id)
          const state = feature.properties.state || "S"
          const status = getStatusFromState(state)

          // Default age to 30 if not provided
          const age = typeof feature.properties.age === "number" ? feature.properties.age : 30

          if (agentsRef.current.has(id)) {
            // Update existing marker
            const agent = agentsRef.current.get(id)!
            agent.status = status
            agent.location = [lng, lat]
            agent.age = age // Update age in case it changed

            // Update marker position
            if (agent.marker) {
              agent.marker.setLngLat([lng, lat])

              // Update marker style based on status
              try {
                const el = agent.marker.getElement()
                if (el) {
                  el.style.backgroundColor =
                    status === "healthy"
                      ? "#FFFFFF"
                      : status === "infected"
                        ? "#F56E0F"
                        : status === "recovered"
                          ? "#4b607f"
                          : "#878787"

                  el.style.boxShadow = status === "infected" ? "0 0 10px #F56E0F" : "none"
                }
              } catch (styleError) {
                console.error("Error updating marker style:", styleError)
              }
            }
          } else {
            // Create new marker
            try {
              const el = document.createElement("div")
              el.className = "agent-marker"
              el.style.cssText = `
                width: 12px;
                height: 12px;
                border-radius: 50%;
                transition: all 0.5s ease;
                background-color: ${
                  status === "healthy"
                    ? "#FFFFFF"
                    : status === "infected"
                      ? "#F56E0F"
                      : status === "recovered"
                        ? "#4b607f"
                        : "#878787"
                };
                ${status === "infected" ? "box-shadow: 0 0 10px #F56E0F;" : ""}
              `

              const marker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map.current)

              agentsRef.current.set(id, {
                id,
                status,
                age,
                location: [lng, lat],
                marker,
                visible: true,
              })
            } catch (markerError) {
              console.error("Error creating marker:", markerError)
            }
          }
        } catch (agentError) {
          console.error("Error processing agent:", agentError)
        }
      })

      // Remove markers that no longer exist
      for (const [id, agent] of agentsRef.current.entries()) {
        try {
          if (!currentAgentIds.has(id) && agent.marker) {
            agent.marker.remove()
            agentsRef.current.delete(id)
          }
        } catch (removeError) {
          console.error("Error removing marker:", removeError)
        }
      }

      // Update agent visibility based on current zoom
      if (map.current) {
        try {
          updateAgentVisibility(map.current.getZoom())
        } catch (visibilityError) {
          console.error("Error updating agent visibility:", visibilityError)
        }
      }

      // Update heatmap if enabled
      if (showHeatmap && heatmapInitializedRef.current && map.current) {
        try {
          const heatmapData = generateHeatmapData()
          if (map.current.getSource("infection-heatmap")) {
            ;(map.current.getSource("infection-heatmap") as mapboxgl.GeoJSONSource).setData(heatmapData)
          }
        } catch (error) {
          console.error("Error updating heatmap data:", error)
        }
      }

      // Update day and max day
      const currentStep = simulation.currentStepData.step || 0
      setSimulationDay(Math.floor(currentStep / 24) + 1)
      setMaxDay(Math.max(1, Math.ceil((simulation.progress / 100) * 30))) // Assuming 30 days max, minimum 1
    } catch (error) {
      console.error("Error updating agent positions:", error)
    }
  }, [
    mapLoaded,
    simulation.currentStepData,
    updateAgentVisibility,
    generateHeatmapData,
    showHeatmap,
    simulation.progress,
  ])

  // Add a resize observer to handle container size changes
  useEffect(() => {
    if (!mapContainer.current || !map.current) return

    try {
      const resizeObserver = new ResizeObserver(() => {
        if (map.current) {
          try {
            map.current.resize()
          } catch (error) {
            console.error("Error resizing map:", error)
          }
        }
      })

      resizeObserver.observe(mapContainer.current)

      return () => {
        try {
          if (mapContainer.current) {
            resizeObserver.unobserve(mapContainer.current)
          }
        } catch (error) {
          console.error("Error removing resize observer:", error)
        }
      }
    } catch (error) {
      console.error("Error setting up resize observer:", error)
    }
  }, [mapLoaded])

  // Map control functions
  const handleZoomIn = useCallback(() => {
    try {
      if (map.current) {
        map.current.zoomIn()
      }
    } catch (error) {
      console.error("Error zooming in:", error)
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    try {
      if (map.current) {
        map.current.zoomOut()
      }
    } catch (error) {
      console.error("Error zooming out:", error)
    }
  }, [])

  const handleResetNorth = useCallback(() => {
    try {
      if (map.current) {
        map.current.setBearing(0)
      }
    } catch (error) {
      console.error("Error resetting north:", error)
    }
  }, [])

  const handleRecenterMap = useCallback(() => {
    try {
      if (map.current) {
        const coordinates = simulation.coordinates || [0, 0]

        // Validate coordinates
        if (
          !Array.isArray(coordinates) ||
          coordinates.length !== 2 ||
          typeof coordinates[0] !== "number" ||
          typeof coordinates[1] !== "number" ||
          isNaN(coordinates[0]) ||
          isNaN(coordinates[1]) ||
          !isFinite(coordinates[0]) ||
          !isFinite(coordinates[1])
        ) {
          console.error("Invalid coordinates for recentering:", coordinates)
          return
        }

        map.current.flyTo({
          center: coordinates,
          zoom: 14,
          pitch: 0,
          bearing: 0,
          duration: 1500,
        })
      }
    } catch (error) {
      console.error("Error recentering map:", error)
    }
  }, [simulation.coordinates])

  const handleToggleHeatmap = useCallback(() => {
    try {
      if (!map.current) return

      const visibility = !showHeatmap

      if (heatmapInitializedRef.current) {
        try {
          map.current.setLayoutProperty("infection-heat", "visibility", visibility ? "visible" : "none")

          if (visibility) {
            const heatmapData = generateHeatmapData()
            if (map.current.getSource("infection-heatmap")) {
              ;(map.current.getSource("infection-heatmap") as mapboxgl.GeoJSONSource).setData(heatmapData)
            }
          }
        } catch (error) {
          console.error("Error toggling existing heatmap:", error)
          heatmapInitializedRef.current = false
        }
      }

      // If heatmap isn't initialized or failed, try to initialize it
      if (!heatmapInitializedRef.current && visibility) {
        try {
          // Check if the source already exists
          if (!map.current.getSource("infection-heatmap")) {
            map.current.addSource("infection-heatmap", {
              type: "geojson",
              data: generateHeatmapData(),
            })
          }

          // Check if the layer already exists
          if (!map.current.getLayer("infection-heat")) {
            map.current.addLayer(
              {
                id: "infection-heat",
                type: "heatmap",
                source: "infection-heatmap",
                paint: {
                  "heatmap-weight": ["get", "intensity"],
                  "heatmap-intensity": 1,
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
                  "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
                  "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 9, 0.5],
                },
              },
              "waterway-label",
            )
          }

          map.current.setLayoutProperty("infection-heat", "visibility", "visible")
          heatmapInitializedRef.current = true
        } catch (error) {
          console.error("Error initializing heatmap on toggle:", error)
          heatmapInitializedRef.current = false
        }
      }

      setShowHeatmap(visibility)
    } catch (error) {
      console.error("Error toggling heatmap:", error)
    }
  }, [showHeatmap, generateHeatmapData])

  // Toggle globe view
  const toggleGlobeView = useCallback(() => {
    try {
      if (!map.current) return

      if (isGlobeView) {
        // Zoom back to location
        const coordinates = simulation.coordinates || [0, 0]

        // Validate coordinates
        if (
          !Array.isArray(coordinates) ||
          coordinates.length !== 2 ||
          typeof coordinates[0] !== "number" ||
          typeof coordinates[1] !== "number" ||
          isNaN(coordinates[0]) ||
          isNaN(coordinates[1]) ||
          !isFinite(coordinates[0]) ||
          !isFinite(coordinates[1])
        ) {
          console.error("Invalid coordinates for globe view:", coordinates)
          return
        }

        map.current.flyTo({
          center: coordinates,
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
    } catch (error) {
      console.error("Error toggling globe view:", error)
    }
  }, [isGlobeView, simulation.coordinates])

  // Add a function to handle progress bar dragging
  const handleDayChange = useCallback((value: number[]) => {
    try {
      const newDay = value[0]
      setSimulationDay(newDay)
      // Note: We can't actually change the simulation step from here
      // as the backend doesn't support jumping to specific steps
    } catch (error) {
      console.error("Error changing day:", error)
    }
  }, [])

  // Animation logic
  useEffect(() => {
    if (isPlaying && isSimulationActive()) {
      let lastTime = 0
      const frameDuration = 1000 / playSpeed // ms per day

      const animate = (time: number) => {
        try {
          if (time - lastTime >= frameDuration) {
            lastTime = time
            setSimulationDay((prev) => {
              if (prev >= maxDay) {
                setIsPlaying(false)
                return maxDay
              }
              return prev + 1
            })
          }

          // Use latest simulationDay from state
          if (simulationDay < maxDay) {
            animationRef.current = requestAnimationFrame(animate)
          }
        } catch (error) {
          console.error("Error in animation frame:", error)
          setIsPlaying(false)
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
  }, [isPlaying, playSpeed, maxDay, isSimulationActive, simulationDay])

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleReset = useCallback(() => {
    setIsPlaying(false)
    setSimulationDay(1)
  }, [])

  const handleSkipForward = useCallback(() => {
    const newDay = Math.min(simulationDay + 1, maxDay)
    setSimulationDay(newDay)
  }, [simulationDay, maxDay])

  const handleSkipBack = useCallback(() => {
    const newDay = Math.max(simulationDay - 1, 1)
    setSimulationDay(newDay)
  }, [simulationDay])

  const handleStartSimulation = useCallback(() => {
    router.push("/")
  }, [router])

  // Calculate stats based on current simulation data - use the simulation state directly
  const stats = useMemo(() => {
    return {
      day: simulationDay,
      totalAgents: simulation.totalAgents,
      healthyAgents: simulation.healthyAgents,
      infectedAgents: simulation.infectedAgents + simulation.exposedAgents, // Combine exposed and infected
      recoveredAgents: simulation.recoveredAgents,
      deceasedAgents: simulation.deadAgents,
    }
  }, [
    simulationDay,
    simulation.totalAgents,
    simulation.healthyAgents,
    simulation.infectedAgents,
    simulation.exposedAgents,
    simulation.recoveredAgents,
    simulation.deadAgents,
  ])

  // Function to retry map initialization
  const handleRetryMapInit = useCallback(() => {
    try {
      setMapError(false)
      setMapLoadAttempted(false)
      mapInitializedRef.current = false
      heatmapInitializedRef.current = false

      if (map.current) {
        map.current.remove()
        map.current = null
      }
    } catch (error) {
      console.error("Error retrying map initialization:", error)
    }
  }, [])

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
                <div className="flex items-center gap-4">
                  <PollingRateControl />
                  <Button
                    variant="outline"
                    className="bg-transparent border-line-gray text-white hover:bg-accent-blue/20"
                    onClick={toggleGlobeView}
                  >
                    <Globe className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Increased height map container */}
              <GlassCard className="h-[calc(100vh-16rem)] relative" variant="dark">
                {mapError ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <AlertCircle className="h-12 w-12 text-accent-orange mb-4" />
                    <h3 className="text-xl font-medium text-white mb-2">Map Error</h3>
                    <p className="text-line-gray text-center max-w-md mb-6">
                      {!env.MAPBOX_TOKEN ? (
                        <>
                          To use the map feature, please add your Mapbox API key as an environment variable named
                          NEXT_PUBLIC_MAPBOX_TOKEN. You can get one by signing up at{" "}
                          <a href="https://mapbox.com" className="text-accent-orange hover:underline">
                            mapbox.com
                          </a>
                          .
                        </>
                      ) : (
                        "There was an error loading the map. This could be due to invalid coordinates or a network issue."
                      )}
                    </p>
                    <Button
                      className="bg-accent-orange hover:bg-accent-orange/90 text-white"
                      onClick={handleRetryMapInit}
                    >
                      Retry
                    </Button>
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
                    <Slider
                      value={[simulationDay]}
                      min={1}
                      max={Math.max(1, maxDay)}
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
