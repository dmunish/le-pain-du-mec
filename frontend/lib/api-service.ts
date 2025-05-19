/**
 * API Service for handling communication with the simulation backend
 */

import type { SimulationParameters, SimulationResponse, SimulationTimeStep } from "@/types/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

/**
 * Initializes a new simulation with the given parameters
 * @param params Simulation parameters
 * @returns Simulation initialization response
 */
export async function initializeSimulation(params: SimulationParameters): Promise<SimulationResponse> {
  try {
    const response = await fetch(`${API_URL}/api/simulation/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(`Failed to initialize simulation: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error initializing simulation:", error)
    // For development without a backend, return a mock response
    return {
      simulationId: "mock-simulation-id",
      status: "running",
      progress: 0,
      currentDay: 1,
    }
  }
}

/**
 * Fetches the next time step of the simulation
 * @param simulationId ID of the current simulation
 * @returns Next time step data
 */
export async function getNextTimeStep(simulationId: string): Promise<SimulationTimeStep> {
  try {
    const response = await fetch(`${API_URL}/api/simulation/${simulationId}/next`)

    if (!response.ok) {
      throw new Error(`Failed to get next time step: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting next time step:", error)
    // For development without a backend, return mock data
    return generateMockTimeStep()
  }
}

/**
 * Pauses the current simulation
 * @param simulationId ID of the current simulation
 * @returns Pause response
 */
export async function pauseSimulation(simulationId: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/simulation/${simulationId}/pause`, {
      method: "POST",
    })

    if (!response.ok) {
      throw new Error(`Failed to pause simulation: ${response.statusText}`)
    }
  } catch (error) {
    console.error("Error pausing simulation:", error)
  }
}

/**
 * Resumes the current simulation
 * @param simulationId ID of the current simulation
 * @returns Resume response
 */
export async function resumeSimulation(simulationId: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/simulation/${simulationId}/resume`, {
      method: "POST",
    })

    if (!response.ok) {
      throw new Error(`Failed to resume simulation: ${response.statusText}`)
    }
  } catch (error) {
    console.error("Error resuming simulation:", error)
  }
}

/**
 * Resets the current simulation
 * @param simulationId ID of the current simulation
 * @returns Reset response
 */
export async function resetSimulation(simulationId: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/simulation/${simulationId}/reset`, {
      method: "POST",
    })

    if (!response.ok) {
      throw new Error(`Failed to reset simulation: ${response.statusText}`)
    }
  } catch (error) {
    console.error("Error resetting simulation:", error)
  }
}

/**
 * Gets the current status of the simulation
 * @param simulationId ID of the current simulation
 * @returns Current simulation status
 */
export async function getSimulationStatus(simulationId: string): Promise<SimulationResponse> {
  try {
    const response = await fetch(`${API_URL}/api/simulation/${simulationId}/status`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get simulation status: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting simulation status:", error)
    throw error
  }
}

/**
 * Generate mock time step data for development without a backend
 */
function generateMockTimeStep(): SimulationTimeStep {
  // Static counter to simulate progression
  if (!generateMockTimeStep.counter) {
    generateMockTimeStep.counter = 1
  } else {
    generateMockTimeStep.counter++
  }

  const day = generateMockTimeStep.counter

  // Generate agents with dynamic status changes
  const agents: any[] = []
  const totalAgents = 100

  // Calculate how many of each type based on day
  const infectedRatio = Math.min(0.05 + day * 0.03, 0.4) // Increases with day, max 40%
  const recoveredRatio = Math.min(day * 0.02, 0.3) // Increases with day, max 30%
  const deceasedRatio = Math.min(day * 0.005, 0.1) // Increases with day, max 10%

  const infectedCount = Math.floor(totalAgents * infectedRatio)
  const recoveredCount = Math.floor(totalAgents * recoveredRatio)
  const deceasedCount = Math.floor(totalAgents * deceasedRatio)
  const susceptibleCount = totalAgents - infectedCount - recoveredCount - deceasedCount

  // Create agents
  let agentId = 0

  // Susceptible agents
  for (let i = 0; i < susceptibleCount; i++) {
    agents.push({
      id: agentId++,
      status: "susceptible",
    })
  }

  // Infected agents
  for (let i = 0; i < infectedCount; i++) {
    agents.push({
      id: agentId++,
      status: "infected",
      infectedDay: Math.max(1, day - Math.floor(Math.random() * 5)),
    })
  }

  // Recovered agents
  for (let i = 0; i < recoveredCount; i++) {
    const infectedDay = Math.max(1, day - Math.floor(Math.random() * 10) - 5)
    agents.push({
      id: agentId++,
      status: "recovered",
      infectedDay,
      recoveredDay: Math.min(day - 1, infectedDay + Math.floor(Math.random() * 5) + 3),
    })
  }

  // Deceased agents
  for (let i = 0; i < deceasedCount; i++) {
    const infectedDay = Math.max(1, day - Math.floor(Math.random() * 10) - 7)
    agents.push({
      id: agentId++,
      status: "deceased",
      infectedDay,
      deceasedDay: Math.min(day - 1, infectedDay + Math.floor(Math.random() * 7) + 5),
    })
  }

  // Generate transmission events
  const transmissionEvents: any[] = []
  const infectedAgents = agents.filter((a) => a.status !== "susceptible")

  // Each infected agent has a chance to infect others
  infectedAgents.forEach((agent) => {
    // Skip agents that were infected today (they haven't had time to infect others)
    if (agent.infectedDay === day) return

    // Each agent infects 0-3 others
    const numInfections = Math.floor(Math.random() * 4)

    for (let i = 0; i < numInfections; i++) {
      // Find a susceptible agent to infect
      const susceptibleAgents = agents.filter((a) => a.status === "susceptible")

      if (susceptibleAgents.length > 0) {
        const targetIndex = Math.floor(Math.random() * susceptibleAgents.length)
        const target = susceptibleAgents[targetIndex]

        transmissionEvents.push({
          source: agent.id,
          target: target.id,
          day,
        })

        // Update the target's status
        target.status = "infected"
        target.infectedDay = day
      }
    }
  })

  return {
    day,
    agents,
    transmissionEvents,
    stats: {
      susceptible: susceptibleCount,
      infected: infectedCount,
      recovered: recoveredCount,
      deceased: deceasedCount,
      r0: 2.5 - day * 0.05, // Decreases slightly over time
    },
  }
}
// Add counter property to the function
;(generateMockTimeStep as any).counter = 0
