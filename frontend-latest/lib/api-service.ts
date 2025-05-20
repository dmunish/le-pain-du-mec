import type { SimulationParameters, SimulationResponse, StepResponse } from "@/types/api"

// Base URL for API calls
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

/**
 * Initializes a new simulation with the given parameters
 * @param params Simulation parameters
 * @returns Simulation initialization response
 */
export async function initializeSimulation(params: SimulationParameters): Promise<SimulationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/simulation/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || "Failed to initialize simulation")
    }

    return await response.json()
  } catch (error) {
    console.error("Error initializing simulation:", error)
    throw error
  }
}

/**
 * Fetches the next step of the simulation
 * @param simulationId ID of the current simulation
 * @returns Next step data
 */
export async function getNextStep(simulationId: string): Promise<StepResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/simulation/${simulationId}/step`)

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || "Failed to get next step")
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting next step:", error)
    throw error
  }
}
