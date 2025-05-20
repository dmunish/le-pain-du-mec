// Update or add this file if it doesn't exist
export interface SimulationParameters {
  placeName: string
  coordinates: [number, number]
  numberOfAgents: number
  infectionProbability: number
  distanceThreshold: number
  duration: number
  latentPeriod: number
  recoveryPeriod: number
  deathRate: number
}

export interface SimulationResponse {
  simulationId: string
  status: string
}

export interface StepResponse {
  agents: {
    type: string
    features: Array<{
      type: string
      geometry: {
        type: string
        coordinates: [number, number]
      }
      properties: {
        id: number
        state: string
        age: number
      }
    }>
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
