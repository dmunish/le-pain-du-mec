/**
 * Types for API communication between frontend and backend
 */

export type SimulationStatus = "not_started" | "initializing" | "running" | "paused" | "completed" | "error"

export interface SimulationParameters {
  // Location parameters
  placeName: string
  coordinates: [number, number]

  // Simulation parameters
  numberOfAgents: number
  infectionProbability: number
  distanceThreshold: number
  duration: number

  // Disease parameters
  latentPeriod: number
  recoveryPeriod: number
  deathRate: number
}

export interface SimulationResponse {
  simulationId: string
  status: string
}

export interface Agent {
  type: "Feature"
  geometry: {
    type: "Point"
    coordinates: [number, number]
  }
  properties: {
    id: number
    state: "S" | "E" | "I" | "R" | "D"
    age: number
  }
}

export interface StepResponse {
  agents: {
    type: "FeatureCollection"
    features: Agent[]
  }
  seird_counts: {
    S: number
    E: number
    I: number
    R: number
    D: number
  }
  step: number
}
