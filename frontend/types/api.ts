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
  recoveryRate: number
  fatalityRate: number

  // Intervention parameters
  interventions?: Intervention[]
}

export interface Intervention {
  type: "lockdown" | "vaccination" | "masking" | "social_distancing"
  startDay: number
  endDay?: number
  effectiveness: number
}

export interface SimulationResponse {
  simulationId: string
  status: string
  progress: number
  currentDay: number
}

export interface Agent {
  id: number
  status: string
  infectedDay?: number
  recoveredDay?: number
  deceasedDay?: number
  location?: [number, number]
  age?: number
  gender?: string
}

export interface TransmissionEvent {
  source: number | null
  target: number | null
  day: number
}

export interface SimulationTimeStep {
  day: number
  agents: Agent[]
  transmissionEvents: TransmissionEvent[]
  stats: {
    susceptible: number
    infected: number
    recovered: number
    deceased: number
    r0: number
  }
  ageDistribution?: {
    [key: string]: {
      susceptible: number
      infected: number
      recovered: number
      deceased: number
    }
  }
  genderDistribution?: {
    male: {
      susceptible: number
      infected: number
      recovered: number
      deceased: number
    }
    female: {
      susceptible: number
      infected: number
      recovered: number
      deceased: number
    }
  }
}

export interface SimulationHistoryRequest {
  simulationId: string
  startDay: number
  endDay: number
}

export interface SimulationHistoryResponse {
  timeSteps: SimulationTimeStep[]
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
