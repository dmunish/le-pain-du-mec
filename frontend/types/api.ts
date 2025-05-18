/**
 * Types for API communication between frontend and backend
 */

export interface SimulationParameters {
  // Location parameters
  location: string
  coordinates: [number, number]

  // Population parameters
  populationSize: number
  initialInfected: number

  // Disease parameters
  r0: number
  incubationPeriod: number
  recoveryTime: number
  fatalityRate: number

  // Intervention parameters
  socialDistancing: number
  maskUsage: number
  vaccinationRate: number

  // Simulation parameters
  simulationDays: number
  timeStepSize: number
}

export interface SimulationResponse {
  simulationId: string
  status: "initializing" | "running" | "paused" | "completed" | "error"
  message?: string
  currentDay: number
  totalDays: number
  progress: number
}

export interface AgentData {
  id: number
  status: "susceptible" | "exposed" | "infected" | "recovered" | "deceased"
  x: number
  y: number
  age: number
  gender: "male" | "female"
}

export interface PopulationStats {
  susceptible: number
  exposed: number
  infected: number
  recovered: number
  deceased: number

  // Age distribution
  ageGroups: {
    [key: string]: {
      total: number
      susceptible: number
      exposed: number
      infected: number
      recovered: number
      deceased: number
    }
  }

  // Gender distribution
  genderDistribution: {
    male: {
      total: number
      susceptible: number
      exposed: number
      infected: number
      recovered: number
      deceased: number
    }
    female: {
      total: number
      susceptible: number
      exposed: number
      infected: number
      recovered: number
      deceased: number
    }
  }
}

export interface SimulationTimeStep {
  day: number
  agents: AgentData[]
  stats: PopulationStats
  r0: number
  newInfections: number
  newRecoveries: number
  newDeaths: number
}

export interface SimulationHistoryRequest {
  simulationId: string
  startDay: number
  endDay: number
}

export interface SimulationHistoryResponse {
  timeSteps: SimulationTimeStep[]
}
