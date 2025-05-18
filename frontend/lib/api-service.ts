/**
 * API Service for handling communication with the simulation backend
 */

import type { SimulationParameters, SimulationResponse, SimulationTimeStep } from "@/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

/**
 * Initializes a new simulation with the given parameters
 * @param params Simulation parameters
 * @returns Simulation initialization response
 */
export async function initializeSimulation(params: SimulationParameters): Promise<SimulationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/simulation/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(`Failed to initialize simulation: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error initializing simulation:", error)
    throw error
  }
}

/**
 * Fetches the next time step of the simulation
 * @param simulationId ID of the current simulation
 * @returns Next time step data
 */
export async function getNextTimeStep(simulationId: string): Promise<SimulationTimeStep> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/simulation/${simulationId}/next`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get next time step: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting next time step:", error)
    throw error
  }
}

/**
 * Pauses the current simulation
 * @param simulationId ID of the current simulation
 * @returns Pause response
 */
export async function pauseSimulation(simulationId: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/simulation/${simulationId}/pause`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to pause simulation: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error pausing simulation:", error)
    throw error
  }
}

/**
 * Resumes the current simulation
 * @param simulationId ID of the current simulation
 * @returns Resume response
 */
export async function resumeSimulation(simulationId: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/simulation/${simulationId}/resume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to resume simulation: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error resuming simulation:", error)
    throw error
  }
}

/**
 * Resets the current simulation
 * @param simulationId ID of the current simulation
 * @returns Reset response
 */
export async function resetSimulation(simulationId: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/simulation/${simulationId}/reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to reset simulation: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error resetting simulation:", error)
    throw error
  }
}

/**
 * Gets the current status of the simulation
 * @param simulationId ID of the current simulation
 * @returns Current simulation status
 */
export async function getSimulationStatus(simulationId: string): Promise<SimulationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/simulation/${simulationId}/status`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get simulation status: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting simulation status:", error)
    throw error
  }
}
