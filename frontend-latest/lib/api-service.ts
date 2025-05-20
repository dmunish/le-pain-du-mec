import type { SimulationParameters, BackendSimulationParameters, SimulationResponse, StepResponse } from "@/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// Transform frontend parameters to backend format
function transformToBackendParams(params: SimulationParameters): BackendSimulationParameters {
  return {
    place: params.placeName,
    // Removed coordinates as they're not expected by the backend
    num_agents: params.numberOfAgents,
    infection_prob: params.infectionProbability,
    distance_threshold: params.distanceThreshold,
    total_days: params.duration,
    latent_period: params.latentPeriod,
    recovery_period: params.recoveryPeriod,
    death_rate: params.deathRate,
  }
}

export async function initializeSimulation(params: SimulationParameters): Promise<SimulationResponse> {
  try {
    // Transform parameters to backend format
    const backendParams = transformToBackendParams(params)

    const response = await fetch(`${API_BASE_URL}/api/simulation/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendParams),
    })

    if (!response.ok) {
      throw new Error(`Failed to initialize simulation: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error initializing simulation:", error)
    throw error
  }
}

export async function getNextStep(): Promise<StepResponse> {
  try {
    // Changed from /step to /next as per the backend API
    const response = await fetch(`${API_BASE_URL}/api/simulation/next`, {
      method: "GET", // Changed to GET as per the backend API
    })

    if (!response.ok) {
      throw new Error(`Failed to get next step: ${response.statusText}`)
    }

    const data = await response.json()

    // Log the SEIR counts to help with debugging
    console.log("Backend SEIR counts:", data.seird_counts)

    // Ensure we have a properly formatted response with consistent SEIR counts
    return {
      agents: data.agents || { type: "FeatureCollection", features: [] },
      seird_counts: data.seird_counts || { S: 0, E: 0, I: 0, R: 0, D: 0 },
      step: data.step || 0,
      day: data.day || 0,
      agent_positions: data.agent_positions || [],
    }
  } catch (error) {
    console.error("Error getting next step:", error)
    throw error
  }
}

export async function getSimulationStatus(): Promise<SimulationResponse> {
  try {
    // Added new function to get simulation status
    const response = await fetch(`${API_BASE_URL}/api/simulation/status`, {
      method: "GET",
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
