"use client"

import type React from "react"
import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { initializeSimulation, getNextStep, getSimulationStatus } from "@/lib/api-service"
import type { SimulationParameters, StepResponse, SimulationStatus } from "@/types/api"

// Update the SimulationState interface to include pollingInterval
interface SimulationState {
  status: SimulationStatus
  progress: number
  totalAgents: number
  healthyAgents: number
  exposedAgents: number
  infectedAgents: number
  recoveredAgents: number
  deadAgents: number
  step: number
  day: number
  location: string
  coordinates: [number, number]
  currentStepData?: StepResponse
  stepHistory: StepResponse[]
  error?: string
  pollingInterval: number // Added polling interval
}

// Update the SimulationContextType to include setPollingInterval
interface SimulationContextType {
  simulation: SimulationState
  startSimulation: (params: SimulationParameters) => Promise<void>
  pauseSimulation: () => void
  resumeSimulation: () => void
  resetSimulation: () => void
  setLocation: (location: string, coordinates: [number, number]) => void
  isSimulationActive: () => boolean
  fetchNextStep: () => Promise<StepResponse | null>
  setPollingInterval: (interval: number) => void // Added method to set polling interval
}

// Update the initialState to include pollingInterval
const initialState: SimulationState = {
  status: "not_started",
  progress: 0,
  totalAgents: 0,
  healthyAgents: 0,
  exposedAgents: 0,
  infectedAgents: 0,
  recoveredAgents: 0,
  deadAgents: 0,
  step: 0,
  day: 0,
  location: "Linz, Austria", // Updated to match backend default
  coordinates: [14.2858, 48.3069], // Coordinates for Linz, Austria
  stepHistory: [],
  pollingInterval: 1000, // Default polling interval: 1 second
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined)

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [simulation, setSimulation] = useState<SimulationState>(initialState)
  const [duration, setDuration] = useState<number>(90) // Default duration in days
  const router = useRouter()
  const stepInterval = useRef<NodeJS.Timeout | null>(null)
  const statusInterval = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef<boolean>(false)
  const isPausedRef = useRef<boolean>(false)

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (stepInterval.current) {
        clearInterval(stepInterval.current)
      }
      if (statusInterval.current) {
        clearInterval(statusInterval.current)
      }
    }
  }, [])

  const startSimulation = useCallback(
    async (params: SimulationParameters) => {
      try {
        // Clear any existing intervals
        if (stepInterval.current) {
          clearInterval(stepInterval.current)
          stepInterval.current = null
        }
        if (statusInterval.current) {
          clearInterval(statusInterval.current)
          statusInterval.current = null
        }

        // Reset all simulation data
        setSimulation({
          ...initialState,
          status: "initializing",
          location: params.placeName || initialState.location,
          coordinates: params.coordinates || initialState.coordinates,
          pollingInterval: simulation.pollingInterval, // Keep current polling interval
        })

        // Reset refs
        isInitializedRef.current = true
        isPausedRef.current = false

        // Store duration for later use
        setDuration(params.duration)

        // Initialize simulation with backend
        const response = await initializeSimulation({
          placeName: params.placeName || initialState.location,
          coordinates: params.coordinates || initialState.coordinates,
          numberOfAgents: params.numberOfAgents,
          infectionProbability: params.infectionProbability,
          distanceThreshold: params.distanceThreshold,
          duration: params.duration,
          latentPeriod: params.latentPeriod,
          recoveryPeriod: params.recoveryPeriod,
          deathRate: params.deathRate,
        })

        // Update state with initial status
        // Handle both totalDays and simulationDays from backend
        const totalDays = response.totalDays || response.simulationDays || params.duration

        setSimulation((prev) => ({
          ...prev,
          status: response.status as SimulationStatus,
          day: response.currentDay || 0,
          progress: response.progress || 0,
        }))

        // Start fetching steps if simulation is running
        if (response.status === "running") {
          startFetchingSteps()
          startPollingStatus()
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
    [simulation.pollingInterval],
  )

  // Add a new method to poll the simulation status
  const startPollingStatus = useCallback(() => {
    // Clear any existing interval
    if (statusInterval.current) {
      clearInterval(statusInterval.current)
    }

    // Set up interval to fetch status
    statusInterval.current = setInterval(async () => {
      try {
        // If paused, don't fetch new status
        if (isPausedRef.current) {
          return
        }

        const statusData = await getSimulationStatus()

        // Handle both totalDays and simulationDays from backend
        const totalDays = statusData.totalDays || statusData.simulationDays || duration

        setSimulation((prev) => {
          return {
            ...prev,
            status: statusData.status as SimulationStatus,
            day: statusData.currentDay || prev.day,
            progress: ((statusData.progress || 0) / (totalDays * 24)) * 100,
          }
        })

        // If simulation is completed, stop polling
        if (statusData.status === "completed") {
          if (statusInterval.current) {
            clearInterval(statusInterval.current)
            statusInterval.current = null
          }
          if (stepInterval.current) {
            clearInterval(stepInterval.current)
            stepInterval.current = null
          }
        }
      } catch (error) {
        console.error("Error fetching status:", error)
      }
    }, simulation.pollingInterval * 2) // Poll status less frequently than steps
  }, [duration, simulation.pollingInterval])

  // Update the startFetchingSteps method to work with the backend
  const startFetchingSteps = useCallback(() => {
    // Clear any existing interval
    if (stepInterval.current) {
      clearInterval(stepInterval.current)
    }

    // Set up interval to fetch steps
    stepInterval.current = setInterval(async () => {
      try {
        // If paused, don't fetch new steps
        if (isPausedRef.current) {
          return
        }

        const stepData = await getNextStep()

        // Check if there's an error
        if (stepData.error) {
          console.error("Error from backend:", stepData.error)
          return
        }

        // Use the seird_counts directly from the backend response
        const seirdCounts = stepData.seird_counts || {
          S: 0,
          E: 0,
          I: 0,
          R: 0,
          D: 0,
        }

        setSimulation((prev) => {
          // Add step to history
          const updatedHistory = [...prev.stepHistory, stepData]

          return {
            ...prev,
            step: prev.step + 1,
            day: stepData.day !== undefined ? stepData.day : Math.floor(prev.step / 24),
            currentStepData: stepData,
            stepHistory: updatedHistory,
            totalAgents: seirdCounts.S + seirdCounts.E + seirdCounts.I + seirdCounts.R + seirdCounts.D,
            healthyAgents: seirdCounts.S,
            exposedAgents: seirdCounts.E,
            infectedAgents: seirdCounts.I,
            recoveredAgents: seirdCounts.R,
            deadAgents: seirdCounts.D,
          }
        })
      } catch (error) {
        console.error("Error fetching step:", error)
      }
    }, simulation.pollingInterval) // Use the configurable polling interval
  }, [simulation.pollingInterval])

  const fetchNextStep = useCallback(async (): Promise<StepResponse | null> => {
    if (simulation.status !== "running") {
      return null
    }

    try {
      const stepData = await getNextStep()

      // Check if there's an error
      if (stepData.error) {
        console.error("Error from backend:", stepData.error)
        return null
      }

      // Use the seird_counts directly from the backend response
      const seirdCounts = stepData.seird_counts || {
        S: 0,
        E: 0,
        I: 0,
        R: 0,
        D: 0,
      }

      setSimulation((prev) => {
        // Add step to history
        const updatedHistory = [...prev.stepHistory, stepData]

        return {
          ...prev,
          step: prev.step + 1,
          day: stepData.day !== undefined ? stepData.day : Math.floor(prev.step / 24),
          currentStepData: stepData,
          stepHistory: updatedHistory,
          totalAgents: seirdCounts.S + seirdCounts.E + seirdCounts.I + seirdCounts.R + seirdCounts.D,
          healthyAgents: seirdCounts.S,
          exposedAgents: seirdCounts.E,
          infectedAgents: seirdCounts.I,
          recoveredAgents: seirdCounts.R,
          deadAgents: seirdCounts.D,
        }
      })

      return stepData
    } catch (error) {
      console.error("Error fetching next step:", error)
      return null
    }
  }, [simulation.status])

  // Since the backend doesn't have pause/resume endpoints, we'll handle it client-side
  const pauseSimulation = useCallback(() => {
    isPausedRef.current = true
    setSimulation((prev) => ({
      ...prev,
      status: "paused",
    }))
  }, [])

  const resumeSimulation = useCallback(() => {
    isPausedRef.current = false
    setSimulation((prev) => ({
      ...prev,
      status: "running",
    }))
  }, [])

  const resetSimulation = useCallback(() => {
    // Clear intervals
    if (stepInterval.current) {
      clearInterval(stepInterval.current)
      stepInterval.current = null
    }
    if (statusInterval.current) {
      clearInterval(statusInterval.current)
      statusInterval.current = null
    }

    // Reset state
    isInitializedRef.current = false
    isPausedRef.current = false
    setSimulation(initialState)
    router.push("/")
  }, [router])

  const setLocation = useCallback((location: string, coordinates: [number, number]) => {
    setSimulation((prev) => ({
      ...prev,
      location,
      coordinates,
    }))
  }, [])

  // Add the setPollingInterval method to the SimulationProvider
  const setPollingInterval = useCallback(
    (interval: number) => {
      setSimulation((prev) => ({
        ...prev,
        pollingInterval: interval,
      }))

      // If there's an active interval, restart it with the new polling rate
      if (stepInterval.current && !isPausedRef.current) {
        clearInterval(stepInterval.current)
        startFetchingSteps()
      }
      if (statusInterval.current && !isPausedRef.current) {
        clearInterval(statusInterval.current)
        startPollingStatus()
      }
    },
    [startFetchingSteps, startPollingStatus],
  )

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
        fetchNextStep,
        setPollingInterval,
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
