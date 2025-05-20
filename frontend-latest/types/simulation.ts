export interface Agent {
  id: number
  x: number
  y: number
  status: "susceptible" | "infected" | "recovered" | "deceased"
  age: number
  gender: "male" | "female"
  infectionDay?: number
  recoveryDay?: number
  deceasedDay?: number
}

export interface SimulationState {
  agents: Agent[]
  day: number
  isRunning: boolean
  infectionRate: number
  recoveryRate: number
  mortalityRate: number
  mobilityFactor: number
  populationDensity: number
  initialInfected: number
  vaccinationRate: number
  quarantineMeasures: boolean
  socialDistancing: boolean
  maskUsage: boolean
  cityLayout: "grid" | "random" | "clustered"
  healthcareCapacity: number
  stats: {
    susceptible: number[]
    infected: number[]
    recovered: number[]
    deceased: number[]
  }
}

export interface SimulationContextType {
  simulation: SimulationState
  startSimulation: () => void
  pauseSimulation: () => void
  resumeSimulation: () => void
  resetSimulation: () => void
  updateSimulationParams: (params: Partial<SimulationState>) => void
  advanceSimulation: () => void
}
