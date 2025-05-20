"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Sidebar } from "@/components/sidebar"
import { GlassCard } from "@/components/glass-card"
import * as d3 from "d3"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useSimulation } from "@/context/simulation-context"
import { Home, FocusIcon as CenterFocus } from "lucide-react"

interface Agent {
  id: number
  state: string
  age: number
  coordinates: [number, number]
}

interface Node extends d3.SimulationNodeDatum {
  id: number
  age: number
  radius: number
  color: string
  coordinates: [number, number]
  infectedAt?: number // Step when infection was detected
  state?: string      // Current state of the agent
}

interface Link extends d3.SimulationLinkDatum<Node> {
  id: string
  source: Node | number
  target: Node | number
  value: number
  infectionEvent?: boolean
}

// Dummy data for when no simulation data is available
const generateDummyData = () => {
  const nodes: Node[] = []
  const links: Link[] = []

  for (let i = 1; i <= 5; i++) {
    nodes.push({
      id: i,
      age: 20 + i * 10,
      radius: 10 + i * 5,
      color: "#F56E0F",
      coordinates: [1590000 + i * 1000, 6155000 + i * 1000],
      infectedAt: i,
    })
  }

  for (let i = 1; i < nodes.length; i++) {
    links.push({
      id: `${nodes[i - 1].id}-${nodes[i].id}`,
      source: nodes[i - 1].id,
      target: nodes[i].id,
      value: 1,
      infectionEvent: true,
    })
  }

  return { nodes, links }
}

// Calculate distance between two points
const calculateDistance = (coord1: [number, number], coord2: [number, number]): number => {
  const dx = coord1[0] - coord2[0]
  const dy = coord1[1] - coord2[1]
  return Math.sqrt(dx * dx + dy * dy)
}

// Find closest infected node from previous step
const findClosestInfectedNode = (newNode: Node, previousInfectedNodes: Node[]): Node | null => {
  if (previousInfectedNodes.length === 0) return null

  let closestNode = previousInfectedNodes[0]
  let minDistance = calculateDistance(newNode.coordinates, closestNode.coordinates)

  for (let i = 1; i < previousInfectedNodes.length; i++) {
    const distance = calculateDistance(newNode.coordinates, previousInfectedNodes[i].coordinates)
    if (distance < minDistance) {
      minDistance = distance
      closestNode = previousInfectedNodes[i]
    }
  }

  return closestNode
}

export default function ForceDirectedGraph() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const { simulation, isSimulationActive } = useSimulation()
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({ nodes: [], links: [] })
  const [stats, setStats] = useState({
    infectedCurrent: 0,
    infectedMax: 0,
    transmissionsTotal: 0,
    avgTransmissions: 0,
  })

  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null)
  const nodesMapRef = useRef<Map<number, Node>>(new Map())
  const previousInfectedIdsRef = useRef<Set<number>>(new Set())
  const linksMapRef = useRef<Map<string, Link>>(new Map())
  const maxInfectedRef = useRef<number>(0)
  const totalTransmissionsRef = useRef<number>(0)
  const isInitializedRef = useRef<boolean>(false)

  // Process simulation data to include all ever-infected agents
  const processSimulationData = useCallback(() => {
    if (!simulation?.currentStepData) {
      console.log("No current step data available, using dummy data")
      return generateDummyData()
    }

    const currentStep = simulation.currentStepData.step
    console.log(`Processing data for step ${currentStep}`)

    // Include agents that are "I" or "R" (ever infected)
    const everInfectedAgents: Agent[] = simulation.currentStepData.agents.features
      .filter((agent) => agent.properties.state === "I" || agent.properties.state === "R")
      .map((agent) => ({
        id: agent.properties.id,
        state: agent.properties.state,
        age: agent.properties.age,
        coordinates: agent.geometry.coordinates as [number, number],
      }))

    console.log(`Found ${everInfectedAgents.length} ever-infected agents`)

    if (everInfectedAgents.length === 0) {
      console.log("No ever-infected agents found, using dummy data")
      return generateDummyData()
    }

    const currentNodesMap = nodesMapRef.current
    const currentLinksMap = linksMapRef.current
    const newNodesMap = new Map<number, Node>()
    const newLinksMap = new Map<string, Link>()
    const previousInfectedIds = previousInfectedIdsRef.current
    const currentInfectedIds = new Set(everInfectedAgents.filter((agent) => agent.state === "I").map((agent) => agent.id))
    const nodes: Node[] = []
    const links: Link[] = []

    // Create or update nodes for all ever-infected agents
    for (const agent of everInfectedAgents) {
      let node = currentNodesMap.get(agent.id)
      if (!node) {
        node = {
          id: agent.id,
          age: agent.age,
          radius: 10 + agent.age / 10,
          color: agent.state === "I" ? "#F56E0F" : "#AAAAAA", // Orange for "I", gray for "R"
          coordinates: agent.coordinates,
          infectedAt: agent.state === "I" ? currentStep : undefined, // Set for new infections
          state: agent.state,
        }
        newNodesMap.set(agent.id, node)
      } else {
        node.age = agent.age
        node.radius = 10 + agent.age / 10
        node.coordinates = agent.coordinates
        node.state = agent.state
        node.color = agent.state === "I" ? "#F56E0F" : "#AAAAAA"
        if (!node.infectedAt && agent.state === "I") {
          node.infectedAt = currentStep // Set infection time when first seen as "I"
        }
      }
      nodes.push(node)
    }

    // Identify newly infected agents
    const newlyInfectedIds = Array.from(currentInfectedIds).filter((id) => !previousInfectedIds.has(id))
    const newlyInfectedNodes = newlyInfectedIds.map((id) => newNodesMap.get(id)).filter(Boolean) as Node[]

    console.log(`Found ${newlyInfectedNodes.length} newly infected agents`)

    // Retain existing links
    currentLinksMap.forEach((link) => {
      const sourceId = typeof link.source === "object" ? link.source.id : link.source
      const targetId = typeof link.target === "object" ? link.target.id : link.target
      if (newNodesMap.has(sourceId) && newNodesMap.has(targetId)) {
        links.push(link)
        newLinksMap.set(link.id, link)
      }
    })

    // Create links for newly infected agents
    const previousInfectedNodes = Array.from(previousInfectedIds)
      .map((id) => newNodesMap.get(id))
      .filter(Boolean) as Node[]
    for (const newNode of newlyInfectedNodes) {
      const closestNode = findClosestInfectedNode(newNode, previousInfectedNodes)
      if (closestNode) {
        const linkId = `${closestNode.id}-${newNode.id}`
        if (!newLinksMap.has(linkId)) {
          const newLink: Link = {
            id: linkId,
            source: closestNode.id,
            target: newNode.id,
            value: 1,
            infectionEvent: true,
          }
          links.push(newLink)
          newLinksMap.set(linkId, newLink)
          totalTransmissionsRef.current += 1
        }
      }
    }

    // Update refs
    nodesMapRef.current = newNodesMap
    linksMapRef.current = newLinksMap
    previousInfectedIdsRef.current = currentInfectedIds

    // Update stats
    const currentInfectedCount = currentInfectedIds.size
    if (currentInfectedCount > maxInfectedRef.current) {
      maxInfectedRef.current = currentInfectedCount
    }
    const avgTransmissions = nodes.length > 0 ? links.length / nodes.length : 0

    setStats({
      infectedCurrent: currentInfectedCount,
      infectedMax: maxInfectedRef.current,
      transmissionsTotal: totalTransmissionsRef.current,
      avgTransmissions: Number.parseFloat(avgTransmissions.toFixed(2)),
    })

    return { nodes, links }
  }, [simulation])

  // Initialize and update the graph when simulation data changes
  useEffect(() => {
    const data = processSimulationData()
    setGraphData(data)
  }, [processSimulationData, simulation?.currentStepData])

  // Initialize the D3 visualization
  useEffect(() => {
    if (!svgRef.current) return

    console.log("Initializing graph visualization")
    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    svg.selectAll("*").remove()

    const g = svg.append("g")
    gRef.current = g.node()

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString())
      })

    zoomRef.current = zoom
    svg.call(zoom)
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8))

    g.append("g").attr("class", "links")
    g.append("g").attr("class", "nodes")

    const simulation = d3
      .forceSimulation<Node, Link>()
      .force(
        "link",
        d3
          .forceLink<Node, Link>()
          .id((d) => d.id)
          .distance(150)
          .strength(0.7),
      )
      .force("charge", d3.forceManyBody().strength(-300).distanceMax(500))
      .force("center", d3.forceCenter(0, 0).strength(0.1))
      .force(
        "collision",
        d3
          .forceCollide()
          .radius((d) => (d.radius || 10) + 10)
          .strength(0.8),
      )
      .force("x", d3.forceX(0).strength(0.05))
      .force("y", d3.forceY(0).strength(0.05))
      .alphaDecay(0.02)
      .velocityDecay(0.3)

    simulationRef.current = simulation
    isInitializedRef.current = true
    console.log("Graph initialization complete")

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
    }
  }, [])

  // Update the visualization when graph data changes
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !simulationRef.current) return

    console.log(`Updating graph with ${graphData.nodes.length} nodes and ${graphData.links.length} links`)

    const g = d3.select(gRef.current)
    const simulation = simulationRef.current

    const linkGroup = g.select(".links")
    const linkSelection = linkGroup.selectAll<SVGLineElement, Link>("line").data(graphData.links, (d: any) => d.id)
    linkSelection.exit().transition().duration(300).attr("opacity", 0).remove()
    const enterLinks = linkSelection
      .enter()
      .append("line")
      .attr("stroke", "rgba(255, 255, 255, 0.7)")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0)
      .attr("marker-end", "url(#arrow)")
    enterLinks.transition().duration(300).attr("opacity", 0.7)

    const nodeGroup = g.select(".nodes")
    const nodeSelection = nodeGroup.selectAll<SVGCircleElement, Node>("circle").data(graphData.nodes, (d: any) => d.id)
    nodeSelection.exit().transition().duration(300).attr("r", 0).attr("opacity", 0).remove()

    const drag = d3
      .drag<SVGCircleElement, Node>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
        d3.select(event.sourceEvent.currentTarget).style("cursor", "grabbing")
      })
      .on("drag", (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.1).restart()
        d.fx = null
        d.fy = null
        d3.select(event.sourceEvent.currentTarget).style("cursor", "grab")
      })

    const enterNodes = nodeSelection
      .enter()
      .append("circle")
      .attr("r", 0)
      .attr("fill", (d) => d.color)
      .attr("stroke", "#262626")
      .attr("stroke-width", 2)
      .attr("opacity", 0)
      .style("cursor", "grab")
      .call(drag as any)
      .on("mouseover", function () {
        d3.select(this).attr("stroke", "#ffffff").attr("stroke-width", 3)
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke", "#262626").attr("stroke-width", 2)
      })

    enterNodes.append("title").text((d) => `Agent ID: ${d.id}\nAge: ${d.age}\nInfected at step: ${d.infectedAt || "N/A"}`)
    enterNodes.transition().duration(300).attr("r", (d) => d.radius).attr("opacity", 1)
    nodeSelection
      .transition()
      .duration(300)
      .attr("r", (d) => d.radius)
      .select("title")
      .text((d) => `Agent ID: ${d.id}\nAge: ${d.age}\nInfected at step: ${d.infectedAt || "N/A"}`)

    simulation.nodes(graphData.nodes)
    simulation.force<d3.ForceLink<Node, Link>>("link")?.links(graphData.links)

    simulation.on("tick", () => {
      linkGroup
        .selectAll("line")
        .attr("x1", (d) => {
          const source = typeof d.source === "object" ? d.source : graphData.nodes.find((n) => n.id === d.source)
          return source?.x || 0
        })
        .attr("y1", (d) => {
          const source = typeof d.source === "object" ? d.source : graphData.nodes.find((n) => n.id === d.source)
          return source?.y || 0
        })
        .attr("x2", (d) => {
          const target = typeof d.target === "object" ? d.target : graphData.nodes.find((n) => n.id === d.target)
          return target?.x || 0
        })
        .attr("y2", (d) => {
          const target = typeof d.target === "object" ? d.target : graphData.nodes.find((n) => n.id === d.target)
          return target?.y || 0
        })

      nodeGroup.selectAll("circle").attr("cx", (d) => d.x || 0).attr("cy", (d) => d.y || 0)
    })

    simulation.alpha(0.5).restart()
  }, [graphData])

  // Add arrow marker for directed edges
  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.select("defs").remove()
    const defs = svg.append("defs")
    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "rgba(255, 255, 255, 0.7)")
  }, [])

  // Handle recenter
  const handleRecenter = () => {
    if (!svgRef.current || !zoomRef.current) return
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    d3.select(svgRef.current)
      .transition()
      .duration(500)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8))
    if (simulationRef.current) {
      simulationRef.current.alpha(0.3).restart()
    }
  }

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
                  onClick={() => router.push("/")}
                >
                  <Home className="h-5 w-5 mr-2" />
                  Start Simulation
                </Button>
              </GlassCard>
            </div>
          ) : (
            <div className="flex flex-col space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold text-white gradient-text font-serif">Infection Network</h1>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                <GlassCard className="h-[calc(100vh-16rem)]" variant="dark">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-white font-serif">Infection Network Visualization</h3>
                      <p className="text-sm text-line-gray">
                        Visualizing infection transmission chains. Arrows indicate likely infection sources. Drag nodes
                        to rearrange.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent border-line-gray text-white hover:bg-accent-blue/20"
                      onClick={handleRecenter}
                    >
                      <CenterFocus className="h-4 w-4 mr-2" />
                      Center
                    </Button>
                  </div>
                  <div className="w-full h-[calc(100%-3rem)] overflow-hidden relative">
                    <svg ref={svgRef} className="w-full h-full"></svg>
                  </div>
                </GlassCard>

                <GlassCard variant="light">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    <div className="glass p-3 rounded-lg">
                      <p className="text-line-gray text-xs">Infected (Current)</p>
                      <p className="text-accent-orange text-lg font-medium">{stats.infectedCurrent}</p>
                    </div>
                    <div className="glass p-3 rounded-lg">
                      <p className="text-line-gray text-xs">Infected (Max)</p>
                      <p className="text-white text-lg font-medium">{stats.infectedMax}</p>
                    </div>
                    <div className="glass p-3 rounded-lg">
                      <p className="text-line-gray text-xs">Transmission Events</p>
                      <p className="text-accent-blue text-lg font-medium">{stats.transmissionsTotal}</p>
                    </div>
                    <div className="glass p-3 rounded-lg">
                      <p className="text-line-gray text-xs">Avg Transmissions</p>
                      <p className="text-white text-lg font-medium">{stats.avgTransmissions}</p>
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