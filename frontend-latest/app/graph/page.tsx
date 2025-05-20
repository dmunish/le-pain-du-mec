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

  // Create 5 dummy nodes with coordinates
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

  // Create infection chain links
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

// Find closest infected node
const findClosestInfectedNode = (newNode: Node, existingNodes: Node[], currentStep: number): Node | null => {
  if (existingNodes.length === 0) return null

  // Filter nodes that were infected before the current step
  const possibleInfectors = existingNodes.filter(
    (node) => node.id !== newNode.id && node.infectedAt !== undefined && node.infectedAt < currentStep,
  )

  if (possibleInfectors.length === 0) return null

  // Find the closest node by coordinates
  let closestNode = possibleInfectors[0]
  let minDistance = calculateDistance(newNode.coordinates, closestNode.coordinates)

  for (let i = 1; i < possibleInfectors.length; i++) {
    const distance = calculateDistance(newNode.coordinates, possibleInfectors[i].coordinates)
    if (distance < minDistance) {
      minDistance = distance
      closestNode = possibleInfectors[i]
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

  // Create a reference to the D3 simulation
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null)
  const nodesMapRef = useRef<Map<number, Node>>(new Map())
  const previousInfectedIdsRef = useRef<Set<number>>(new Set())
  const linksMapRef = useRef<Map<string, Link>>(new Map())
  const maxInfectedRef = useRef<number>(0)
  const totalTransmissionsRef = useRef<number>(0)
  const isInitializedRef = useRef<boolean>(false)

  // Process simulation data to extract infected agents and create graph data
  const processSimulationData = useCallback(() => {
    if (!simulation?.currentStepData) {
      console.log("No current step data available, using dummy data")
      return generateDummyData()
    }

    const currentStep = simulation.currentStepData.step
    console.log(`Processing data for step ${currentStep}`)

    // Extract infected agents from the current step data
    const infectedAgents: Agent[] = simulation.currentStepData.agents.features
      .filter((agent) => agent.properties.state === "I")
      .map((agent) => ({
        id: agent.properties.id,
        state: agent.properties.state,
        age: agent.properties.age,
        coordinates: agent.geometry.coordinates as [number, number],
      }))

    console.log(`Found ${infectedAgents.length} infected agents`)

    // If no infected agents, use dummy data
    if (infectedAgents.length === 0) {
      console.log("No infected agents found, using dummy data")
      return generateDummyData()
    }

    // Get current nodes map and links map
    const currentNodesMap = nodesMapRef.current
    const currentLinksMap = linksMapRef.current
    const newNodesMap = new Map<number, Node>()
    const newLinksMap = new Map<string, Link>()

    // Get the set of previously infected agent IDs
    const previousInfectedIds = previousInfectedIdsRef.current
    const currentInfectedIds = new Set<number>()

    // Create or update nodes for each infected agent
    const nodes: Node[] = []

    for (const agent of infectedAgents) {
      currentInfectedIds.add(agent.id)

      // Check if node already exists
      const existingNode = currentNodesMap.get(agent.id)

      if (existingNode) {
        // Update existing node
        existingNode.age = agent.age
        existingNode.radius = 10 + agent.age / 10
        existingNode.coordinates = agent.coordinates
        nodes.push(existingNode)
        newNodesMap.set(agent.id, existingNode)
      } else {
        // Create new node - this is a newly infected agent
        const newNode: Node = {
          id: agent.id,
          age: agent.age,
          radius: 10 + agent.age / 10,
          color: "#F56E0F",
          coordinates: agent.coordinates,
          infectedAt: currentStep,
        }
        nodes.push(newNode)
        newNodesMap.set(agent.id, newNode)
      }
    }

    // Find newly infected agents
    const newlyInfectedNodes: Node[] = []
    for (const nodeId of currentInfectedIds) {
      if (!previousInfectedIds.has(nodeId)) {
        const node = newNodesMap.get(nodeId)
        if (node) {
          newlyInfectedNodes.push(node)
        }
      }
    }

    console.log(`Found ${newlyInfectedNodes.length} newly infected agents`)

    // Create links for infection events
    const links: Link[] = []

    // First, keep existing links
    currentLinksMap.forEach((link) => {
      // Only keep links where both source and target are still in the graph
      const sourceId = typeof link.source === "object" ? link.source.id : link.source
      const targetId = typeof link.target === "object" ? link.target.id : link.target

      if (newNodesMap.has(sourceId) && newNodesMap.has(targetId)) {
        links.push(link)
        newLinksMap.set(link.id, link)
      }
    })

    // Then add new links for newly infected agents
    for (const newNode of newlyInfectedNodes) {
      const closestNode = findClosestInfectedNode(newNode, nodes, currentStep)

      if (closestNode) {
        const linkId = `${closestNode.id}-${newNode.id}`

        // Create a new link representing the infection event
        const newLink: Link = {
          id: linkId,
          source: closestNode.id,
          target: newNode.id,
          value: 1,
          infectionEvent: true,
        }

        links.push(newLink)
        newLinksMap.set(linkId, newLink)

        // Increment total transmissions counter
        totalTransmissionsRef.current += 1
      }
    }

    // Update refs for next time
    nodesMapRef.current = newNodesMap
    linksMapRef.current = newLinksMap
    previousInfectedIdsRef.current = currentInfectedIds

    // Update max infected count
    const currentInfectedCount = nodes.length
    if (currentInfectedCount > maxInfectedRef.current) {
      maxInfectedRef.current = currentInfectedCount
    }

    // Calculate statistics
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

    // Clear any existing content
    svg.selectAll("*").remove()

    // Create a group for the graph
    const g = svg.append("g")
    gRef.current = g.node()

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString())
      })

    zoomRef.current = zoom
    svg.call(zoom)

    // Center the graph initially
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8))

    // Create groups for links and nodes
    g.append("g").attr("class", "links")
    g.append("g").attr("class", "nodes")

    // Create the simulation with optimized parameters for better organization
    const simulation = d3
      .forceSimulation<Node, Link>()
      .force(
        "link",
        d3
          .forceLink<Node, Link>()
          .id((d) => d.id)
          .distance(150) // Increased for better spacing
          .strength(0.7), // Stronger links to maintain structure
      )
      .force("charge", d3.forceManyBody().strength(-300).distanceMax(500)) // Stronger repulsion with distance limit
      .force("center", d3.forceCenter(0, 0).strength(0.1)) // Gentle centering force
      .force(
        "collision",
        d3
          .forceCollide()
          .radius((d) => (d.radius || 10) + 10)
          .strength(0.8), // Stronger collision avoidance
      )
      .force("x", d3.forceX(0).strength(0.05)) // Gentle force toward center x
      .force("y", d3.forceY(0).strength(0.05)) // Gentle force toward center y
      .alphaDecay(0.02) // Slower cooling for better settling
      .velocityDecay(0.3) // Less damping for more responsive movement

    // Store the simulation reference
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
    if (!svgRef.current || !gRef.current) {
      console.log("SVG or G element not available")
      return
    }

    if (!simulationRef.current) {
      console.log("Simulation not initialized")
      return
    }

    console.log(`Updating graph with ${graphData.nodes.length} nodes and ${graphData.links.length} links`)

    const g = d3.select(gRef.current)
    const simulation = simulationRef.current

    // Update links with enter/update/exit pattern
    const linkGroup = g.select(".links")
    const linkSelection = linkGroup.selectAll<SVGLineElement, Link>("line").data(graphData.links, (d: any) => d.id)

    // Remove old links with transition
    linkSelection.exit().transition().duration(300).attr("opacity", 0).remove()

    // Add new links with transition
    const enterLinks = linkSelection
      .enter()
      .append("line")
      .attr("stroke", "rgba(255, 255, 255, 0.7)")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0)
      .attr("marker-end", "url(#arrow)") // Add arrow marker

    enterLinks.transition().duration(300).attr("opacity", 0.7)

    // Update nodes with enter/update/exit pattern
    const nodeGroup = g.select(".nodes")
    const nodeSelection = nodeGroup.selectAll<SVGCircleElement, Node>("circle").data(graphData.nodes, (d: any) => d.id)

    // Remove old nodes with transition
    nodeSelection.exit().transition().duration(300).attr("r", 0).attr("opacity", 0).remove()

    // Enhanced drag behavior that doesn't fix node positions
    const drag = d3
      .drag<SVGCircleElement, Node>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        // Temporarily fix position during drag
        d.fx = d.x
        d.fy = d.y
        // Change cursor to grabbing
        d3.select(event.sourceEvent.currentTarget).style("cursor", "grabbing")
      })
      .on("drag", (event, d) => {
        // Update fixed position during drag
        d.fx = event.x
        d.fy = event.y
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.1).restart()
        // Release fixed position after drag to allow forces to act
        d.fx = null
        d.fy = null
        // Change cursor back to grab
        d3.select(event.sourceEvent.currentTarget).style("cursor", "grab")
      })

    // Add new nodes with transition
    const enterNodes = nodeSelection
      .enter()
      .append("circle")
      .attr("r", 0)
      .attr("fill", (d) => d.color)
      .attr("stroke", "#262626")
      .attr("stroke-width", 2)
      .attr("opacity", 0)
      .style("cursor", "grab") // Set cursor to grab to indicate draggable
      .call(drag as any)
      .on("mouseover", function () {
        d3.select(this).attr("stroke", "#ffffff").attr("stroke-width", 3)
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke", "#262626").attr("stroke-width", 2)
      })

    // Add tooltips
    enterNodes.append("title").text((d) => `Agent ID: ${d.id}\nAge: ${d.age}\nInfected at step: ${d.infectedAt}`)

    // Transition new nodes in
    enterNodes
      .transition()
      .duration(300)
      .attr("r", (d) => d.radius)
      .attr("opacity", 1)

    // Update existing nodes
    nodeSelection
      .transition()
      .duration(300)
      .attr("r", (d) => d.radius)
      .select("title")
      .text((d) => `Agent ID: ${d.id}\nAge: ${d.age}\nInfected at step: ${d.infectedAt}`)

    // Update the simulation
    simulation.nodes(graphData.nodes)
    simulation.force<d3.ForceLink<Node, Link>>("link")?.links(graphData.links)

    // Update positions on each tick
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

      nodeGroup
        .selectAll("circle")
        .attr("cx", (d) => d.x || 0)
        .attr("cy", (d) => d.y || 0)
    })

    // Restart the simulation with a gentle alpha
    simulation.alpha(0.5).restart()
  }, [graphData])

  // Add arrow marker for directed edges
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    // Remove any existing markers
    svg.select("defs").remove()

    // Add arrow marker definition
    const defs = svg.append("defs")

    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20) // Position the arrow away from the end of the line
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

    // Also restart the simulation with the center force
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
