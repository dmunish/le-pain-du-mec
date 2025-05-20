export type SimulationStatus = "not_started" | "initializing" | "running" | "paused" | "completed" | "error"

export interface SimulationParameters {
  placeName: string
  coordinates: [number, number] // Keep for frontend use
  numberOfAgents: number
  infectionProbability: number
  distanceThreshold: number
  duration: number
  latentPeriod: number
  recoveryPeriod: number
  deathRate: number
}

export interface BackendSimulationParameters {
  place: string
  // Removed coordinates as they're not expected by the backend
  num_agents: number
  infection_prob: number
  distance_threshold: number
  total_days: number
  latent_period: number
  recovery_period: number
  death_rate: number
}

export interface SimulationResponse {
  status: string
  currentDay?: number
  totalDays?: number
  simulationDays?: number // Added to match backend response
  progress?: number
  error?: string
}

// Agent feature from GeoJSON response
export interface AgentFeature {
  type: string
  geometry: {
    type: string
    coordinates: [number, number]
  }
  properties: {
    id: number
    state: "S" | "E" | "I" | "R" | "D"
    age?: number // Make age optional since it might not be present
  }
}

// Updated to match the backend response format
export interface StepResponse {
  agents?: {
    type: string
    features: AgentFeature[]
  }
  seird_counts?: {
    S: number // Susceptible (healthy)
    E: number // Exposed
    I: number // Infected
    R: number // Recovered
    D: number // Dead
  }
  step?: number
  day?: number
  error?: string
  // Fields from the backend response
  agent_positions?: Array<{
    id: number
    x: number
    y: number
    state: "S" | "E" | "I" | "R" | "D"
    age?: number
  }>
}
