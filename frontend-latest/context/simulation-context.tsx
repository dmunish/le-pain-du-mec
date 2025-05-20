"use client"

import type React from "react"
import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { initializeSimulation, getNextStep } from "@/lib/api-service"
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
  simulationId?: string
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
  location: "New York",
  coordinates: [-74.006, 40.7128],
  stepHistory: [],
  pollingInterval: 1000, // Default polling interval: 1 second
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined)

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [simulation, setSimulation] = useState<SimulationState>(initialState)
  const [duration, setDuration] = useState<number>(90) // Default duration in days
  const router = useRouter()
  const stepInterval = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef<boolean>(false)
  const isPausedRef = useRef<boolean>(false)

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (stepInterval.current) {
        clearInterval(stepInterval.current)
      }
    }
  }, [])

  const startSimulation = useCallback(
    async (params: SimulationParameters) => {
      try {
        // Set initialized flag immediately
        isInitializedRef.current = true
        isPausedRef.current = false

        // Store duration for later use
        setDuration(params.duration)

        // Clear any existing interval
        if (stepInterval.current) {
          clearInterval(stepInterval.current)
          stepInterval.current = null
        }

        // Reset to initial state first
        setSimulation({
          ...initialState,
          status: "initializing",
          location: params.placeName || simulation.location,
          coordinates: params.coordinates || simulation.coordinates,
        })

        // Initialize simulation with backend
        const response = await initializeSimulation({
          placeName: params.placeName || simulation.location,
          coordinates: params.coordinates || simulation.coordinates,
          numberOfAgents: params.numberOfAgents,
          infectionProbability: params.infectionProbability,
          distanceThreshold: params.distanceThreshold,
          duration: params.duration,
          latentPeriod: params.latentPeriod,
          recoveryPeriod: params.recoveryPeriod,
          deathRate: params.deathRate,
        })

        // Update state with simulation ID and initial status
        setSimulation((prev) => ({
          ...prev,
          simulationId: response.simulationId,
          status: response.status as SimulationStatus,
        }))

        // Start fetching steps if simulation is running
        if (response.status === "running") {
          startFetchingSteps(response.simulationId)
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

  // Update the startFetchingSteps method to use the pollingInterval
  const startFetchingSteps = useCallback(
    (simulationId: string) => {
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

          // Check if we've reached the duration (in days)
          // Each day has 24 steps (hours)
          const currentStep = simulation.step
          const maxSteps = duration * 24

          if (currentStep >= maxSteps) {
            // We've reached the end of the simulation
            clearInterval(stepInterval.current!)
            stepInterval.current = null
            setSimulation((prev) => ({
              ...prev,
              status: "completed",
              progress: 100,
            }))
            return
          }

          const stepData = await getNextStep(simulationId)

          setSimulation((prev) => {
            // Add step to history
            const updatedHistory = [...prev.stepHistory, stepData]

            // Calculate day from step (24 steps per day)
            const day = Math.floor(stepData.step / 24)

            return {
              ...prev,
              step: stepData.step,
              day,
              currentStepData: stepData,
              stepHistory: updatedHistory,
              totalAgents:
                stepData.seird_counts.S +
                stepData.seird_counts.E +
                stepData.seird_counts.I +
                stepData.seird_counts.R +
                stepData.seird_counts.D,
              healthyAgents: stepData.seird_counts.S,
              exposedAgents: stepData.seird_counts.E,
              infectedAgents: stepData.seird_counts.I,
              recoveredAgents: stepData.seird_counts.R,
              deadAgents: stepData.seird_counts.D,
              progress: (stepData.step / maxSteps) * 100,
            }
          })
        } catch (error) {
          console.error("Error fetching step:", error)
          clearInterval(stepInterval.current!)
          stepInterval.current = null
          setSimulation((prev) => ({
            ...prev,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error fetching step",
          }))
        }
      }, simulation.pollingInterval) // Use the configurable polling interval
    },
    [duration, simulation.step, simulation.pollingInterval],
  )

  const fetchNextStep = useCallback(async (): Promise<StepResponse | null> => {
    if (!simulation.simulationId || simulation.status !== "running") {
      return null
    }

    try {
      const stepData = await getNextStep(simulation.simulationId)

      // Calculate day from step (24 steps per day)
      const day = Math.floor(stepData.step / 24)
      const maxSteps = duration * 24

      setSimulation((prev) => {
        // Add step to history
        const updatedHistory = [...prev.stepHistory, stepData]

        return {
          ...prev,
          step: stepData.step,
          day,
          currentStepData: stepData,
          stepHistory: updatedHistory,
          totalAgents:
            stepData.seird_counts.S +
            stepData.seird_counts.E +
            stepData.seird_counts.I +
            stepData.seird_counts.R +
            stepData.seird_counts.D,
          healthyAgents: stepData.seird_counts.S,
          exposedAgents: stepData.seird_counts.E,
          infectedAgents: stepData.seird_counts.I,
          recoveredAgents: stepData.seird_counts.R,
          deadAgents: stepData.seird_counts.D,
          progress: (stepData.step / maxSteps) * 100,
        }
      })

      return stepData
    } catch (error) {
      console.error("Error fetching next step:", error)
      return null
    }
  }, [simulation.simulationId, simulation.status, duration])

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
    // Clear interval
    if (stepInterval.current) {
      clearInterval(stepInterval.current)
      stepInterval.current = null
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
  // Add this after the setLocation method
  const setPollingInterval = useCallback(
    (interval: number) => {
      setSimulation((prev) => ({
        ...prev,
        pollingInterval: interval,
      }))

      // If there's an active interval, restart it with the new polling rate
      if (stepInterval.current && simulation.simulationId && !isPausedRef.current) {
        clearInterval(stepInterval.current)
        startFetchingSteps(simulation.simulationId)
      }
    },
    [simulation.simulationId, startFetchingSteps],
  )

  // Simplified check that just uses the ref
  const isSimulationActive = useCallback(() => {
    return isInitializedRef.current
  }, [])

  // Update the SimulationContext.Provider value to include setPollingInterval
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
