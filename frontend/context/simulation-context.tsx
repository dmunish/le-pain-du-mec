"use client"

import type React from "react"
import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  initializeSimulation,
  getNextTimeStep,
  pauseSimulation as pauseSimulationApi,
  resumeSimulation as resumeSimulationApi,
  resetSimulation as resetSimulationApi,
} from "@/lib/api-service"
import type { SimulationParameters, SimulationTimeStep } from "@/types/api"

type SimulationStatus = "not_started" | "initializing" | "running" | "paused" | "completed" | "error"

interface SimulationState {
  status: SimulationStatus
  progress: number
  totalAgents: number
  healthyAgents: number
  infectedAgents: number
  recoveredAgents: number
  deadAgents: number
  day: number
  location: string
  coordinates: [number, number]
  simulationId?: string
  currentTimeStep?: SimulationTimeStep
  timeStepHistory: SimulationTimeStep[]
  error?: string
}

interface SimulationContextType {
  simulation: SimulationState
  startSimulation: (params: SimulationParameters) => Promise<void>
  pauseSimulation: () => Promise<void>
  resumeSimulation: () => Promise<void>
  resetSimulation: () => Promise<void>
  setLocation: (location: string, coordinates: [number, number]) => void
  isSimulationActive: () => boolean
  fetchNextTimeStep: () => Promise<SimulationTimeStep | null>
}

const initialState: SimulationState = {
  status: "not_started",
  progress: 0,
  totalAgents: 0,
  healthyAgents: 0,
  infectedAgents: 0,
  recoveredAgents: 0,
  deadAgents: 0,
  day: 0,
  location: "New York",
  coordinates: [-74.006, 40.7128],
  timeStepHistory: [],
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined)

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [simulation, setSimulation] = useState<SimulationState>(initialState)
  const router = useRouter()
  const timeStepInterval = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef<boolean>(false)

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (timeStepInterval.current) {
        clearInterval(timeStepInterval.current)
      }
    }
  }, [])

  const startSimulation = useCallback(
    async (params: SimulationParameters) => {
      try {
        // Set initialized flag immediately
        isInitializedRef.current = true

        // Clear any existing interval
        if (timeStepInterval.current) {
          clearInterval(timeStepInterval.current)
          timeStepInterval.current = null
        }

        // Reset to initial state first
        setSimulation({
          ...initialState,
          status: "initializing",
          location: params.location || simulation.location,
          coordinates: params.coordinates || simulation.coordinates,
        })

        // Initialize simulation with backend
        const response = await initializeSimulation(params)

        // Update state with simulation ID and initial status
        setSimulation((prev) => ({
          ...prev,
          simulationId: response.simulationId,
          status: response.status as SimulationStatus,
          progress: response.progress,
          day: response.currentDay,
        }))

        // Start fetching time steps if simulation is running
        if (response.status === "running") {
          startFetchingTimeSteps(response.simulationId)
        }
      } catch (error) {
        console.error("Error starting simulation:", error)
        setSimulation((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error starting simulation",
        }))
      }
    },
    [simulation.location, simulation.coordinates],
  )

  const startFetchingTimeSteps = useCallback((simulationId: string) => {
    // Clear any existing interval
    if (timeStepInterval.current) {
      clearInterval(timeStepInterval.current)
    }

    // Set up interval to fetch time steps
    timeStepInterval.current = setInterval(async () => {
      try {
        const timeStep = await getNextTimeStep(simulationId)

        setSimulation((prev) => {
          // Add time step to history
          const updatedHistory = [...prev.timeStepHistory, timeStep]

          return {
            ...prev,
            day: timeStep.day,
            currentTimeStep: timeStep,
            timeStepHistory: updatedHistory,
            totalAgents:
              timeStep.stats.susceptible + timeStep.stats.infected + timeStep.stats.recovered + timeStep.stats.deceased,
            healthyAgents: timeStep.stats.susceptible,
            infectedAgents: timeStep.stats.infected,
            recoveredAgents: timeStep.stats.recovered,
            deadAgents: timeStep.stats.deceased,
            progress: (timeStep.day / (prev.simulationId ? 90 : 1)) * 100, // Assuming 90 days total
          }
        })

        // Check if simulation is complete
        if (timeStep.day >= 90) {
          // Assuming 90 days total
          clearInterval(timeStepInterval.current!)
          timeStepInterval.current = null
          setSimulation((prev) => ({
            ...prev,
            status: "completed",
          }))
        }
      } catch (error) {
        console.error("Error fetching time step:", error)
        clearInterval(timeStepInterval.current!)
        timeStepInterval.current = null
        setSimulation((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error fetching time step",
        }))
      }
    }, 1000) // Fetch every second
  }, [])

  const fetchNextTimeStep = useCallback(async (): Promise<SimulationTimeStep | null> => {
    if (!simulation.simulationId || simulation.status !== "running") {
      return null
    }

    try {
      const timeStep = await getNextTimeStep(simulation.simulationId)

      setSimulation((prev) => {
        // Add time step to history
        const updatedHistory = [...prev.timeStepHistory, timeStep]

        return {
          ...prev,
          day: timeStep.day,
          currentTimeStep: timeStep,
          timeStepHistory: updatedHistory,
          totalAgents:
            timeStep.stats.susceptible + timeStep.stats.infected + timeStep.stats.recovered + timeStep.stats.deceased,
          healthyAgents: timeStep.stats.susceptible,
          infectedAgents: timeStep.stats.infected,
          recoveredAgents: timeStep.stats.recovered,
          deadAgents: timeStep.stats.deceased,
          progress: (timeStep.day / 90) * 100, // Assuming 90 days total
        }
      })

      return timeStep
    } catch (error) {
      console.error("Error fetching next time step:", error)
      return null
    }
  }, [simulation.simulationId, simulation.status])

  const pauseSimulation = useCallback(async () => {
    if (!simulation.simulationId) {
      return
    }

    try {
      // Clear interval
      if (timeStepInterval.current) {
        clearInterval(timeStepInterval.current)
        timeStepInterval.current = null
      }

      // Call API to pause simulation
      await pauseSimulationApi(simulation.simulationId)

      // Update state
      setSimulation((prev) => ({
        ...prev,
        status: "paused",
      }))
    } catch (error) {
      console.error("Error pausing simulation:", error)
      setSimulation((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Unknown error pausing simulation",
      }))
    }
  }, [simulation.simulationId])

  const resumeSimulation = useCallback(async () => {
    if (!simulation.simulationId) {
      return
    }

    try {
      // Call API to resume simulation
      await resumeSimulationApi(simulation.simulationId)

      // Update state
      setSimulation((prev) => ({
        ...prev,
        status: "running",
      }))

      // Restart fetching time steps
      startFetchingTimeSteps(simulation.simulationId)
    } catch (error) {
      console.error("Error resuming simulation:", error)
      setSimulation((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Unknown error resuming simulation",
      }))
    }
  }, [simulation.simulationId, startFetchingTimeSteps])

  const resetSimulation = useCallback(async () => {
    if (!simulation.simulationId) {
      isInitializedRef.current = false
      setSimulation(initialState)
      router.push("/")
      return
    }

    try {
      // Clear interval
      if (timeStepInterval.current) {
        clearInterval(timeStepInterval.current)
        timeStepInterval.current = null
      }

      // Call API to reset simulation
      await resetSimulationApi(simulation.simulationId)

      // Reset state
      isInitializedRef.current = false
      setSimulation(initialState)
      router.push("/")
    } catch (error) {
      console.error("Error resetting simulation:", error)
      setSimulation((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Unknown error resetting simulation",
      }))
    }
  }, [simulation.simulationId, router])

  const setLocation = useCallback((location: string, coordinates: [number, number]) => {
    setSimulation((prev) => ({
      ...prev,
      location,
      coordinates,
    }))
  }, [])

  // Simplified check that just uses the ref
  const isSimulationActive = useCallback(() => {
    return isInitializedRef.current
  }, [])

  return (
    <SimulationContext.Provider
      value={{
        simulation,
        startSimulation,
        pauseSimulation,
        resumeSimulation,
        resetSimulation,
        setLocation,
        isSimulationActive,
        fetchNextTimeStep,
      }}
    >
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulation() {
  const context = useContext(SimulationContext)
  if (context === undefined) {
    throw new Error("useSimulation must be used within a SimulationProvider")
  }
  return context
}
