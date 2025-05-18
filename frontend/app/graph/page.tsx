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
  status: "susceptible" | "infected" | "recovered" | "deceased"
  day: number
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
  value: number
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
  const isInitializedRef = useRef<boolean>(false)
  const graphInitializedRef = useRef<boolean>(false)

  // Stats
  const [stats, setStats] = useState({
    totalNodes: 0,
    susceptibleNodes: 0,
    infectedNodes: 0,
    recoveredNodes: 0,
    deceasedNodes: 0,
    totalLinks: 0,
    r0: 0,
  })

  // Generate data for a specific day - memoized to prevent regeneration on every render
  const generateDataForDay = useCallback((day: number) => {
    // If we already have data, just update it for the current day
    if (nodesRef.current.length > 0) {
      // Simulate disease spread up to the current day
      if (day > 1) {
        const nodes = [...nodesRef.current]
        const links = [
          ...linksRef.current.filter((link) => {
            const linkDay = typeof link.day === "number" ? link.day : 1
            return linkDay < day
          }),
        ]

        // Find infected nodes
        const infectedIndices = nodes
          .map((node, index) => (node.status === "infected" ? index : -1))
          .filter((index) => index !== -1)

        // Each infected node can infect connected susceptible nodes
        for (const infectedIndex of infectedIndices) {
          // Find connections to this infected node
          const connections = links
            .filter((link) => {
              const sourceId = typeof link.source === "number" ? link.source : link.source.id
              const targetId = typeof link.target === "number" ? link.target : link.target.id
              return sourceId === infectedIndex || targetId === infectedIndex
            })
            .map((link) => {
              const sourceId = typeof link.source === "number" ? link.source : link.source.id
              const targetId = typeof link.target === "number" ? link.target : link.target.id
              return sourceId === infectedIndex ? targetId : sourceId
            })

          // Try to infect connected susceptible nodes with consistent probability
          for (const connectedIndex of connections) {
            if (nodes[connectedIndex].status === "susceptible") {
              // Use a deterministic approach based on node IDs and day for consistency
              const infectionSeed = (connectedIndex * 13 + day * 7) % 100
              if (infectionSeed < 30) {
                // 30% chance
                nodes[connectedIndex].status = "infected"
                nodes[connectedIndex].day = day

                // Add a new infection link
                links.push({
                  source: infectedIndex,
                  target: connectedIndex,
                  day: day,
                  value: 2,
                })
              }
            }
          }

          // Infected nodes can recover or die with consistent probability
          if (nodes[infectedIndex].status === "infected") {
            const recoverySeed = (infectedIndex * 11 + day * 5) % 100
            if (recoverySeed < 10) {
              // 10% chance
              const fatalitySeed = (infectedIndex * 7 + day * 3) % 100
              nodes[infectedIndex].status = fatalitySeed < 10 ? "deceased" : "recovered" // 10% fatality rate among recoveries
            }
          }
        }

        // Filter links to only show those up to the current day
        const visibleLinks = links.filter((link) => {
          const linkDay = typeof link.day === "number" ? link.day : 1
          return linkDay <= day
        })

        return { nodes, visibleLinks }
      }

      return {
        nodes: nodesRef.current,
        visibleLinks: linksRef.current.filter((link) => {
          const linkDay = typeof link.day === "number" ? link.day : 1
          return linkDay <= day
        }),
      }
    }

    // Initial data generation with consistent seed
    const nodes: Node[] = []
    const links: Link[] = []

    // Initial infected nodes
    const initialInfected = 5
    for (let i = 0; i < initialInfected; i++) {
      nodes.push({
        id: i,
        status: "infected",
        day: 1,
      })
    }

    // Initial susceptible nodes
    const totalNodes = 50
    for (let i = initialInfected; i < totalNodes; i++) {
      nodes.push({
        id: i,
        status: "susceptible",
        day: 1,
      })
    }

    // Create initial connections with consistent pattern
    for (let i = 0; i < nodes.length; i++) {
      const numConnections = Math.floor((i % 3) + 1) // Consistent pattern based on node ID
      for (let j = 0; j < numConnections; j++) {
        const targetIndex = (i + j * 7) % nodes.length // Consistent pattern for connections
        if (targetIndex !== i) {
          links.push({
            source: i,
            target: targetIndex,
            day: 1,
            value: 1,
          })
        }
      }
    }

    // Simulate disease spread up to the current day with consistent probabilities
    if (day > 1) {
      for (let d = 2; d <= day; d++) {
        // Find infected nodes
        const infectedIndices = nodes
          .map((node, index) => (node.status === "infected" ? index : -1))
          .filter((index) => index !== -1)

        // Each infected node can infect connected susceptible nodes
        for (const infectedIndex of infectedIndices) {
          // Find connections to this infected node
          const connections = links
            .filter((link) => {
              const sourceId = typeof link.source === "number" ? link.source : link.source.id
              const targetId = typeof link.target === "number" ? link.target : link.target.id
              return sourceId === infectedIndex || targetId === infectedIndex
            })
            .map((link) => {
              const sourceId = typeof link.source === "number" ? link.source : link.source.id
              const targetId = typeof link.target === "number" ? link.target : link.target.id
              return sourceId === infectedIndex ? targetId : sourceId
            })

          // Try to infect connected susceptible nodes with consistent probability
          for (const connectedIndex of connections) {
            if (nodes[connectedIndex].status === "susceptible") {
              // Use a deterministic approach based on node IDs and day for consistency
              const infectionSeed = (connectedIndex * 13 + d * 7) % 100
              if (infectionSeed < 30) {
                // 30% chance
                nodes[connectedIndex].status = "infected"
                nodes[connectedIndex].day = d

                // Add a new infection link
                links.push({
                  source: infectedIndex,
                  target: connectedIndex,
                  day: d,
                  value: 2,
                })
              }
            }
          }

          // Infected nodes can recover or die with consistent probability
          if (nodes[infectedIndex].status === "infected") {
            const recoverySeed = (infectedIndex * 11 + d * 5) % 100
            if (recoverySeed < 10) {
              // 10% chance
              const fatalitySeed = (infectedIndex * 7 + d * 3) % 100
              nodes[infectedIndex].status = fatalitySeed < 10 ? "deceased" : "recovered" // 10% fatality rate among recoveries
            }
          }
        }
      }
    }

    // Filter links to only show those up to the current day
    const visibleLinks = links.filter((link) => {
      const linkDay = typeof link.day === "number" ? link.day : 1
      return linkDay <= day
    })

    // Store the full data for future reference
    nodesRef.current = nodes
    linksRef.current = links

    return { nodes, visibleLinks }
  }, [])

  // Render the graph
  useEffect(() => {
    // Check if simulation is active before proceeding
    if (!svgRef.current || !isSimulationActive() || graphInitializedRef.current) return

    // Generate data for the current day
    const { nodes, visibleLinks } = generateDataForDay(currentDay)

    // Update stats
    setStats({
      totalNodes: nodes.length,
      susceptibleNodes: nodes.filter((n) => n.status === "susceptible").length,
      infectedNodes: nodes.filter((n) => n.status === "infected").length,
      recoveredNodes: nodes.filter((n) => n.status === "recovered").length,
      deceasedNodes: nodes.filter((n) => n.status === "deceased").length,
      totalLinks: visibleLinks.length,
      r0: Number.parseFloat(
        (
          visibleLinks.filter((l) => {
            const linkDay = typeof l.day === "number" ? l.day : 1
            return linkDay > 1
          }).length / Math.max(1, nodes.filter((n) => n.status !== "susceptible").length)
        ).toFixed(2),
      ),
    })

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Create SVG and add zoom behavior
    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("style", "max-width: 100%; height: auto; overflow: visible;")

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

    // Create force simulation with higher alpha decay to stabilize faster
    const forceSimulation = d3
      .forceSimulation<Node>(nodes)
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(10))
      .force(
        "link",
        d3
          .forceLink<Node, Link>(visibleLinks)
          .id((d) => d.id)
          .distance(50),
      )
      .alphaDecay(0.1) // Higher alpha decay for faster stabilization
      .on("tick", ticked)
      .on("end", () => {
        // When simulation ends naturally, stop it completely
        forceSimulation.stop()
      })

    simulationRef.current = forceSimulation

    // Create links
    const link = g
      .append("g")
      .attr("class", "links")
      .attr("stroke", "#4b607f")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(visibleLinks)
      .join("line")
      .attr("stroke-width", (d) => Math.sqrt(typeof d.value === "number" ? d.value : 1))

    // Create nodes
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 8)
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
      .call(d3.drag<SVGCircleElement, Node>().on("start", dragstarted).on("drag", dragged).on("end", dragended) as any)

    // Add tooltips
    node.append("title").text((d) => `Node ${d.id} (${d.status})`)

    // Update positions on each tick
    function ticked() {
      link
        .attr("x1", (d) => {
          const source = typeof d.source === "number" ? nodes[d.source] : d.source
          return source.x!
        })
        .attr("y1", (d) => {
          const source = typeof d.source === "number" ? nodes[d.source] : d.source
          return source.y!
        })
        .attr("x2", (d) => {
          const target = typeof d.target === "number" ? nodes[d.target] : d.target
          return target.x!
        })
        .attr("y2", (d) => {
          const target = typeof d.target === "number" ? nodes[d.target] : d.target
          return target.y!
        })

      node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!)
    }

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, Node, Node>, d: Node) {
      if (!event.active) forceSimulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, Node, Node>, d: Node) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: d3.D3DragEvent<SVGCircleElement, Node, Node>, d: Node) {
      if (!event.active) forceSimulation.alphaTarget(0)
      d.fx = null
      d.fy = null
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

    // Run the simulation for a fixed number of ticks and then stop it
    forceSimulation.tick(300)
    setTimeout(() => {
      forceSimulation.stop()
    }, 1000)

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

  // Update the graph when the day changes
  useEffect(() => {
    if (!svgRef.current || !isSimulationActive() || !graphInitializedRef.current) return

    // Generate data for the current day
    const { nodes, visibleLinks } = generateDataForDay(currentDay)

    // Update stats
    setStats({
      totalNodes: nodes.length,
      susceptibleNodes: nodes.filter((n) => n.status === "susceptible").length,
      infectedNodes: nodes.filter((n) => n.status === "infected").length,
      recoveredNodes: nodes.filter((n) => n.status === "recovered").length,
      deceasedNodes: nodes.filter((n) => n.status === "deceased").length,
      totalLinks: visibleLinks.length,
      r0: Number.parseFloat(
        (
          visibleLinks.filter((l) => {
            const linkDay = typeof l.day === "number" ? l.day : 1
            return linkDay > 1
          }).length / Math.max(1, nodes.filter((n) => n.status !== "susceptible").length)
        ).toFixed(2),
      ),
    })

    // Update the visualization
    const svg = d3.select(svgRef.current)

    // Update links
    svg
      .select(".links")
      .selectAll("line")
      .data(visibleLinks)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("stroke-width", (d) => Math.sqrt(typeof d.value === "number" ? d.value : 1))
            .attr("x1", (d) => {
              const source = typeof d.source === "number" ? nodes[d.source] : d.source
              return source.x!
            })
            .attr("y1", (d) => {
              const source = typeof d.source === "number" ? nodes[d.source] : d.source
              return source.y!
            })
            .attr("x2", (d) => {
              const target = typeof d.target === "number" ? nodes[d.target] : d.target
              return target.x!
            })
            .attr("y2", (d) => {
              const target = typeof d.target === "number" ? nodes[d.target] : d.target
              return target.y!
            }),
        (update) => update,
        (exit) => exit.remove(),
      )

    // Update nodes
    svg
      .select(".nodes")
      .selectAll("circle")
      .data(nodes)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("r", 8)
            .attr("cx", (d) => d.x!)
            .attr("cy", (d) => d.y!)
            .attr("stroke", "#262626")
            .attr("stroke-width", 1.5),
        (update) =>
          update
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
            .style("filter", (d) => (d.status === "infected" ? "url(#glow)" : "none")),
        (exit) => exit.remove(),
      )

    // Do NOT restart the simulation - this prevents pulsating
  }, [currentDay, isSimulationActive, generateDataForDay])

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
                  Please start a simulation to view the force-directed graph. Configure your parameters on the home
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
                <h1 className="text-2xl font-bold text-white gradient-text font-serif">Force-Directed Graph</h1>
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
                      <p className="text-sm text-line-gray">Visualizing infection spread through social connections</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-white mr-2"></div>
                        <span className="text-xs text-line-gray">Susceptible</span>
                      </div>
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
                        <p className="text-line-gray text-xs">Total Nodes</p>
                        <p className="text-white text-lg font-medium">{stats.totalNodes}</p>
                      </div>

                      <div className="glass p-3 rounded-lg">
                        <p className="text-line-gray text-xs">Infected</p>
                        <p className="text-accent-orange text-lg font-medium">{stats.infectedNodes}</p>
                      </div>

                      <div className="glass p-3 rounded-lg">
                        <p className="text-line-gray text-xs">Recovered</p>
                        <p className="text-accent-blue text-lg font-medium">{stats.recoveredNodes}</p>
                      </div>

                      <div className="glass p-3 rounded-lg">
                        <p className="text-line-gray text-xs">R0</p>
                        <p className="text-white text-lg font-medium">{stats.r0}</p>
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
