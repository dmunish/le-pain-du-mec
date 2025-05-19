"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Sidebar } from "@/components/sidebar"
import { GlassCard } from "@/components/glass-card"
import * as d3 from "d3"
import { ZoomIn, ZoomOut, RefreshCw, Play, Pause, SkipForward, SkipBack, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useSimulation } from "@/context/simulation-context"
import { useRouter } from "next/navigation"
import { Slider as SliderPrimitive } from "@/components/ui/slider"

interface Node {
  id: number
  status: "infected" | "recovered" | "deceased"
  day: number
  connections: number
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  vx?: number
  vy?: number
}

interface Link {
  source: number | Node
  target: number | Node
  day: number
  id: string // Unique identifier for the link
}

export default function ForceDirectedGraph() {
  const { simulation, isSimulationActive } = useSimulation()
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const [currentDay, setCurrentDay] = useState(1)
  const [maxDay, setMaxDay] = useState(30)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(1)
  const animationRef = useRef<number | null>(null)
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null)
  const nodesRef = useRef<Node[]>([])
  const linksRef = useRef<Link[]>([])
  const prevNodesRef = useRef<Map<number, Node>>(new Map())
  const isInitializedRef = useRef<boolean>(false)
  const graphInitializedRef = useRef<boolean>(false)

  // Stats
  const [stats, setStats] = useState({
    totalNodes: 0,
    infectedNodes: 0,
    recoveredNodes: 0,
    deceasedNodes: 0,
    totalTransmissions: 0,
    maxConnections: 0,
    avgConnections: 0,
  })

  // Generate data for a specific day - memoized to prevent regeneration on every render
  const generateDataForDay = useCallback(
    (day: number) => {
      // Create a map to track connections for each node
      const connectionCount = new Map<number, number>()

      // If we have simulation data, use it
      if (simulation && simulation.currentTimeStep) {
        const timeStep = simulation.currentTimeStep

        // Get all agents who were infected at some point (currently infected, recovered, or deceased)
        const infectedAgents = timeStep.agents.filter(
          (agent) => agent.status === "infected" || agent.status === "recovered" || agent.status === "deceased",
        )

        // Create nodes for infected agents
        const nodes: Node[] = infectedAgents.map((agent) => {
          // Check if we have previous position data for this node
          const prevNode = prevNodesRef.current.get(agent.id)

          return {
            id: agent.id,
            status: agent.status as "infected" | "recovered" | "deceased",
            day: agent.infectedDay || 1,
            connections: 0, // Will be updated after processing links
            // Preserve position if it existed before
            x: prevNode?.x,
            y: prevNode?.y,
            vx: prevNode?.vx,
            vy: prevNode?.vy,
          }
        })

        // Create links for transmission events up to the current day
        const links: Link[] = []

        // Process infection chains to create links
        timeStep.transmissionEvents.forEach((event) => {
          if (event.day <= day && event.source !== null && event.target !== null) {
            // Only add links if both source and target were infected
            const sourceAgent = infectedAgents.find((a) => a.id === event.source)
            const targetAgent = infectedAgents.find((a) => a.id === event.target)

            if (sourceAgent && targetAgent) {
              links.push({
                source: event.source,
                target: event.target,
                day: event.day,
                id: `${event.source}-${event.target}`, // Unique ID for the link
              })

              // Increment connection count for both nodes
              connectionCount.set(event.source, (connectionCount.get(event.source) || 0) + 1)
              connectionCount.set(event.target, (connectionCount.get(event.target) || 0) + 1)
            }
          }
        })

        // Update connection counts for each node
        nodes.forEach((node) => {
          node.connections = connectionCount.get(node.id) || 0
        })

        // Calculate stats
        const maxConnections = Math.max(...Array.from(connectionCount.values()), 0)
        const avgConnections =
          connectionCount.size > 0
            ? Array.from(connectionCount.values()).reduce((sum, count) => sum + count, 0) / connectionCount.size
            : 0

        setStats({
          totalNodes: nodes.length,
          infectedNodes: nodes.filter((n) => n.status === "infected").length,
          recoveredNodes: nodes.filter((n) => n.status === "recovered").length,
          deceasedNodes: nodes.filter((n) => n.status === "deceased").length,
          totalTransmissions: links.length,
          maxConnections,
          avgConnections: Number.parseFloat(avgConnections.toFixed(2)),
        })

        // Update the previous nodes map for position tracking
        const newNodesMap = new Map<number, Node>()
        nodes.forEach((node) => {
          newNodesMap.set(node.id, node)
        })
        prevNodesRef.current = newNodesMap

        // Store the full data for future reference
        nodesRef.current = nodes
        linksRef.current = links

        return { nodes, links }
      }

      // If no simulation data, generate mock data for development
      // This is a fallback for when the backend isn't connected
      const mockNodes: Node[] = []
      const mockLinks: Link[] = []

      // Generate mock infected nodes
      const totalInfected = Math.min(5 + day * 2, 50) // Grow with day

      for (let i = 0; i < totalInfected; i++) {
        // Determine status based on id and day
        let status: "infected" | "recovered" | "deceased" = "infected"
        if (i < day / 3) {
          status = Math.random() > 0.8 ? "deceased" : "recovered"
        }

        // Check if we have previous position data for this node
        const prevNode = prevNodesRef.current.get(i)

        mockNodes.push({
          id: i,
          status,
          day: Math.min(i + 1, day),
          connections: 0, // Will be updated
          // Preserve position if it existed before
          x: prevNode?.x,
          y: prevNode?.y,
          vx: prevNode?.vx,
          vy: prevNode?.vy,
        })
      }

      // Generate mock transmission links
      for (let i = 0; i < totalInfected - 1; i++) {
        // Each node infects 1-3 others
        const numInfections = Math.floor(Math.random() * 3) + 1

        for (let j = 0; j < numInfections; j++) {
          const target = i + j + 1
          if (target < totalInfected) {
            mockLinks.push({
              source: i,
              target,
              day: Math.min(i + 2, day),
              id: `${i}-${target}`,
            })

            // Update connection counts
            mockNodes[i].connections++
            mockNodes[target].connections++
          }
        }
      }

      // Calculate mock stats
      const maxConnections = Math.max(...mockNodes.map((n) => n.connections), 0)
      const avgConnections =
        mockNodes.length > 0 ? mockNodes.reduce((sum, n) => sum + n.connections, 0) / mockNodes.length : 0

      setStats({
        totalNodes: mockNodes.length,
        infectedNodes: mockNodes.filter((n) => n.status === "infected").length,
        recoveredNodes: mockNodes.filter((n) => n.status === "recovered").length,
        deceasedNodes: mockNodes.filter((n) => n.status === "deceased").length,
        totalTransmissions: mockLinks.length,
        maxConnections,
        avgConnections: Number.parseFloat(avgConnections.toFixed(2)),
      })

      // Update the previous nodes map for position tracking
      const newNodesMap = new Map<number, Node>()
      mockNodes.forEach((node) => {
        newNodesMap.set(node.id, node)
      })
      prevNodesRef.current = newNodesMap

      // Store the full data for future reference
      nodesRef.current = mockNodes
      linksRef.current = mockLinks

      return { nodes: mockNodes, links: mockLinks }
    },
    [simulation],
  )

  // Initialize the graph
  useEffect(() => {
    // Check if simulation is active before proceeding
    if (!svgRef.current || !isSimulationActive()) return

    // Generate data for the current day
    const { nodes, links } = generateDataForDay(currentDay)

    if (nodes.length === 0) return // Don't render if no data

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Create SVG and add zoom behavior
    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("style", "max-width: 100%; height: auto; overflow: visible;")

    // Clear any existing content
    svg.selectAll("*").remove()

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString())
      })

    svg.call(zoom)

    // Create a group for all elements
    const g = svg.append("g")

    // Add a subtle glow filter
    const defs = svg.append("defs")
    const filter = defs
      .append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%")

    filter.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur")

    const feMerge = filter.append("feMerge")
    feMerge.append("feMergeNode").attr("in", "coloredBlur")
    feMerge.append("feMergeNode").attr("in", "SourceGraphic")

    // Create force simulation
    const forceSimulation = d3
      .forceSimulation<Node>(nodes)
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d) => Math.sqrt(d.connections + 1) * 4 + 5),
      )
      .force(
        "link",
        d3
          .forceLink<Node, Link>(links)
          .id((d) => d.id)
          .distance(70),
      )
      .alphaDecay(0.02) // Slower decay for smoother transitions
      .on("tick", ticked)

    simulationRef.current = forceSimulation

    // Create links group
    const linkGroup = g.append("g").attr("class", "links")

    // Create nodes group
    const nodeGroup = g.append("g").attr("class", "nodes")

    // Initial render of links
    updateLinks(linkGroup, links)

    // Initial render of nodes
    updateNodes(nodeGroup, nodes)

    // Update positions on each tick
    function ticked() {
      svg
        .select(".links")
        .selectAll("line")
        .attr("x1", (d) => {
          const source = typeof d.source === "number" ? nodes.find((n) => n.id === d.source) : d.source
          return source?.x || 0
        })
        .attr("y1", (d) => {
          const source = typeof d.source === "number" ? nodes.find((n) => n.id === d.source) : d.source
          return source?.y || 0
        })
        .attr("x2", (d) => {
          const target = typeof d.target === "number" ? nodes.find((n) => n.id === d.target) : d.target
          return target?.x || 0
        })
        .attr("y2", (d) => {
          const target = typeof d.target === "number" ? nodes.find((n) => n.id === d.target) : d.target
          return target?.y || 0
        })

      svg
        .select(".nodes")
        .selectAll("circle")
        .attr("cx", (d) => d.x || 0)
        .attr("cy", (d) => d.y || 0)
    }

    // Set up zoom controls
    const zoomIn = () => {
      svg
        .transition()
        .duration(300)
        .call(zoom.scaleBy as any, 1.3)
    }

    const zoomOut = () => {
      svg
        .transition()
        .duration(300)
        .call(zoom.scaleBy as any, 0.7)
    }

    const resetZoom = () => {
      svg
        .transition()
        .duration(300)
        .call(zoom.transform as any, d3.zoomIdentity)
    }

    // Add event listeners to buttons
    document.getElementById("zoom-in")?.addEventListener("click", zoomIn)
    document.getElementById("zoom-out")?.addEventListener("click", zoomOut)
    document.getElementById("reset-zoom")?.addEventListener("click", resetZoom)

    // Run the simulation for a fixed number of ticks to stabilize initial layout
    forceSimulation.tick(100)

    graphInitializedRef.current = true
    isInitializedRef.current = true

    // Clean up function
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
      document.getElementById("zoom-in")?.removeEventListener("click", zoomIn)
      document.getElementById("zoom-out")?.removeEventListener("click", zoomOut)
      document.getElementById("reset-zoom")?.removeEventListener("click", resetZoom)
    }
  }, [isSimulationActive, generateDataForDay, currentDay])

  // Function to update links with smooth transitions
  const updateLinks = useCallback((selection, links) => {
    selection
      .selectAll("line")
      .data(links, (d: Link) => d.id)
      .join(
        // Enter new links with transition
        (enter) =>
          enter
            .append("line")
            .attr("stroke", "#4b607f")
            .attr("stroke-opacity", 0)
            .attr("stroke-width", 1.5)
            .attr("x1", (d) => {
              const source = typeof d.source === "number" ? nodesRef.current.find((n) => n.id === d.source) : d.source
              return source?.x || 0
            })
            .attr("y1", (d) => {
              const source = typeof d.source === "number" ? nodesRef.current.find((n) => n.id === d.source) : d.source
              return source?.y || 0
            })
            .attr("x2", (d) => {
              const target = typeof d.target === "number" ? nodesRef.current.find((n) => n.id === d.target) : d.target
              return target?.x || 0
            })
            .attr("y2", (d) => {
              const target = typeof d.target === "number" ? nodesRef.current.find((n) => n.id === d.target) : d.target
              return target?.y || 0
            })
            .call((enter) => enter.transition().duration(500).attr("stroke-opacity", 0.6)),
        // Update existing links
        (update) => update,
        // Exit links with transition
        (exit) => exit.transition().duration(500).attr("stroke-opacity", 0).remove(),
      )
  }, [])

  // Function to update nodes with smooth transitions
  const updateNodes = useCallback((selection, nodes) => {
    selection
      .selectAll("circle")
      .data(nodes, (d: Node) => d.id)
      .join(
        // Enter new nodes with transition
        (enter) => {
          const enterSelection = enter
            .append("circle")
            .attr("r", 0) // Start with radius 0
            .attr("cx", (d) => d.x || 0)
            .attr("cy", (d) => d.y || 0)
            .attr("fill", (d) => {
              switch (d.status) {
                case "infected":
                  return "#F56E0F"
                case "recovered":
                  return "#4b607f"
                case "deceased":
                  return "#878787"
                default:
                  return "#FFFFFF"
              }
            })
            .attr("stroke", "#262626")
            .attr("stroke-width", 1.5)
            .style("filter", (d) => (d.status === "infected" ? "url(#glow)" : "none"))
            .style("opacity", 0) // Start transparent

          // Add tooltips
          enterSelection.append("title").text((d) => `Agent ${d.id} (${d.status})\nConnections: ${d.connections}`)

          // Add hover effects
          enterSelection
            .on("mouseover", function (event, d) {
              // Highlight the node
              d3.select(this).attr("stroke", "#F56E0F").attr("stroke-width", 3).style("filter", "url(#glow)")

              // Highlight connected links and nodes
              d3.selectAll("line").each(function (l: any) {
                const source = typeof l.source === "number" ? l.source : l.source.id
                const target = typeof l.target === "number" ? l.target : l.target.id

                if (source === d.id || target === d.id) {
                  d3.select(this).attr("stroke", "#F56E0F").attr("stroke-width", 3).attr("stroke-opacity", 1)

                  // Highlight connected nodes
                  d3.selectAll("circle").each(function (n: any) {
                    if ((source === d.id && target === n.id) || (target === d.id && source === n.id)) {
                      d3.select(this).attr("stroke", "#F56E0F").attr("stroke-width", 2).style("filter", "url(#glow)")
                    }
                  })
                }
              })
            })
            .on("mouseout", () => {
              // Reset node styles
              d3.selectAll("circle")
                .attr("stroke", "#262626")
                .attr("stroke-width", 1.5)
                .style("filter", (d: any) => (d.status === "infected" ? "url(#glow)" : "none"))

              // Reset link styles
              d3.selectAll("line").attr("stroke", "#4b607f").attr("stroke-width", 1.5).attr("stroke-opacity", 0.6)
            })

          // Animate entrance
          return enterSelection
            .transition()
            .duration(500)
            .attr("r", (d) => Math.sqrt(d.connections + 1) * 4 + 5)
            .style("opacity", 1)
        },
        // Update existing nodes with transition
        (update) => {
          // Update tooltips
          update.select("title").text((d) => `Agent ${d.id} (${d.status})\nConnections: ${d.connections}`)

          // Transition to new state
          return update
            .transition()
            .duration(500)
            .attr("r", (d) => Math.sqrt(d.connections + 1) * 4 + 5)
            .attr("fill", (d) => {
              switch (d.status) {
                case "infected":
                  return "#F56E0F"
                case "recovered":
                  return "#4b607f"
                case "deceased":
                  return "#878787"
                default:
                  return "#FFFFFF"
              }
            })
            .style("filter", (d) => (d.status === "infected" ? "url(#glow)" : "none"))
        },
        // Exit nodes with transition
        (exit) => exit.transition().duration(500).attr("r", 0).style("opacity", 0).remove(),
      )
  }, [])

  // Update the graph when the day changes
  useEffect(() => {
    if (!svgRef.current || !isSimulationActive() || !graphInitializedRef.current) return

    // Generate data for the current day
    const { nodes, links } = generateDataForDay(currentDay)

    if (nodes.length === 0) return // Don't update if no data

    // Get the SVG selection
    const svg = d3.select(svgRef.current)

    // Update links with smooth transitions
    updateLinks(svg.select(".links"), links)

    // Update nodes with smooth transitions
    updateNodes(svg.select(".nodes"), nodes)

    // Update the force simulation with new data
    if (simulationRef.current) {
      simulationRef.current
        .nodes(nodes)
        .force(
          "link",
          d3
            .forceLink<Node, Link>(links)
            .id((d) => d.id)
            .distance(70),
        )
        .alpha(0.3) // Restart with a moderate alpha
        .restart()
    }
  }, [currentDay, isSimulationActive, generateDataForDay, updateLinks, updateNodes])

  // Animation logic
  useEffect(() => {
    if (isPlaying && isSimulationActive()) {
      let lastTime = 0
      const frameDuration = 1000 / playSpeed // ms per day

      const animate = (time: number) => {
        if (time - lastTime >= frameDuration) {
          lastTime = time
          setCurrentDay((prev) => {
            if (prev >= maxDay) {
              setIsPlaying(false)
              return maxDay
            }
            return prev + 1
          })
        }

        if (currentDay < maxDay) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, currentDay, maxDay, playSpeed, isSimulationActive])

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleReset = useCallback(() => {
    setIsPlaying(false)
    setCurrentDay(1)
  }, [])

  const handleSkipForward = useCallback(() => {
    if (currentDay < maxDay) {
      setCurrentDay(currentDay + 1)
    }
  }, [currentDay, maxDay])

  const handleSkipBack = useCallback(() => {
    if (currentDay > 1) {
      setCurrentDay(currentDay - 1)
    }
  }, [currentDay])

  const handleStartSimulation = useCallback(() => {
    router.push("/")
  }, [router])

  const handleDayChange = useCallback((value: number[]) => {
    const newDay = value[0]
    setCurrentDay(newDay)
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
                  Please start a simulation to view the transmission network. Configure your parameters on the home
                  page.
                </p>
                <Button
                  className="bg-accent-orange hover:bg-accent-orange/90 text-white"
                  onClick={handleStartSimulation}
                >
                  <Home className="h-4 w-4 mr-2" />
                  Start Simulation
                </Button>
              </GlassCard>
            </div>
          ) : (
            <div className="flex flex-col space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold text-white gradient-text font-serif">Transmission Network</h1>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <Button
                    id="zoom-in"
                    variant="outline"
                    className="bg-transparent border-line-gray text-white hover:bg-accent-blue/20"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    id="zoom-out"
                    variant="outline"
                    className="bg-transparent border-line-gray text-white hover:bg-accent-blue/20"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button id="reset-zoom" className="bg-accent-orange hover:bg-accent-orange/90 text-white">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                <GlassCard className="h-[calc(100vh-16rem)]" variant="dark">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-white font-serif">Disease Transmission Network</h3>
                      <p className="text-sm text-line-gray">Visualizing infection chains between individuals</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-accent-orange mr-2 animate-pulse"></div>
                        <span className="text-xs text-line-gray">Infected</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-accent-blue mr-2"></div>
                        <span className="text-xs text-line-gray">Recovered</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-line-gray mr-2"></div>
                        <span className="text-xs text-line-gray">Deceased</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-[calc(100%-3rem)] overflow-hidden">
                    <svg ref={svgRef} className="w-full h-full"></svg>
                  </div>
                </GlassCard>

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
                          disabled={currentDay <= 1}
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
                          disabled={currentDay >= maxDay}
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
                        <span className="text-white font-medium">{currentDay}</span>
                        <span className="text-line-gray text-xs">of</span>
                        <span className="text-white font-medium">{maxDay}</span>
                      </div>
                    </div>

                    <div className="relative">
                      <SliderPrimitive
                        value={[currentDay]}
                        min={1}
                        max={maxDay}
                        step={1}
                        onValueChange={handleDayChange}
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="glass p-3 rounded-lg">
                        <p className="text-line-gray text-xs">Infected Individuals</p>
                        <p className="text-white text-lg font-medium">{stats.totalNodes}</p>
                      </div>

                      <div className="glass p-3 rounded-lg">
                        <p className="text-line-gray text-xs">Transmission Events</p>
                        <p className="text-accent-orange text-lg font-medium">{stats.totalTransmissions}</p>
                      </div>

                      <div className="glass p-3 rounded-lg">
                        <p className="text-line-gray text-xs">Max Connections</p>
                        <p className="text-accent-blue text-lg font-medium">{stats.maxConnections}</p>
                      </div>

                      <div className="glass p-3 rounded-lg">
                        <p className="text-line-gray text-xs">Avg Connections</p>
                        <p className="text-white text-lg font-medium">{stats.avgConnections}</p>
                      </div>
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
