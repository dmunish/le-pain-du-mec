"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { GlassCard } from "@/components/glass-card"
import { Button } from "@/components/ui/button"
import { Home, ChevronLeft } from "lucide-react"
import { useSimulation } from "@/context/simulation-context"
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Filler,
} from "chart.js"
import { Line, Doughnut, Bar } from "react-chartjs-2"
import { PollingRateControl } from "@/components/polling-rate-control"

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Filler,
)

// Define chart colors
const chartColors = {
  healthy: {
    main: "rgba(75, 96, 127, 1)",
    light: "rgba(75, 96, 127, 0.7)",
    gradient: {
      start: "rgba(75, 96, 127, 0.7)",
      end: "rgba(75, 96, 127, 0.1)",
    },
  },
  infected: {
    main: "rgba(245, 110, 15, 1)",
    light: "rgba(245, 110, 15, 0.7)",
    gradient: {
      start: "rgba(245, 110, 15, 0.7)",
      end: "rgba(245, 110, 15, 0.1)",
    },
  },
  recovered: {
    main: "rgba(120, 200, 120, 1)",
    light: "rgba(120, 200, 120, 0.7)",
    gradient: {
      start: "rgba(120, 200, 120, 0.7)",
      end: "rgba(120, 200, 120, 0.1)",
    },
  },
  deceased: {
    main: "rgba(200, 80, 80, 1)",
    light: "rgba(200, 80, 80, 0.7)",
    gradient: {
      start: "rgba(200, 80, 80, 0.7)",
      end: "rgba(200, 80, 80, 0.1)",
    },
  },
}

// Generate age distribution data based on real counts
const generateAgeDistributionData = (day, totalHealthy, totalInfected, totalRecovered, totalDeceased) => {
  const ageGroups = ["0-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80+"]

  // Distribution patterns that change slightly with time
  const dayFactor = Math.min(day / 30, 1) // Normalize day to a factor between 0-1

  // Generate data based on current simulation numbers
  const healthyData = ageGroups.map((_, i) => {
    // Distribute healthy people with more in middle age groups, decreasing over time for older groups
    const distribution = [
      0.12,
      0.14,
      0.16,
      0.18,
      0.15,
      0.12 - dayFactor * 0.03,
      0.08 - dayFactor * 0.03,
      0.03 - dayFactor * 0.01,
      0.02 - dayFactor * 0.01,
    ]
    return Math.round(totalHealthy * distribution[i])
  })

  const infectedData = ageGroups.map((_, i) => {
    // Distribute infected people with increasing rates in older age groups over time
    const distribution = [
      0.05,
      0.07,
      0.1,
      0.12,
      0.15,
      0.18 + dayFactor * 0.02,
      0.15 + dayFactor * 0.03,
      0.1 + dayFactor * 0.04,
      0.08 + dayFactor * 0.05,
    ]
    return Math.round(totalInfected * distribution[i])
  })

  const recoveredData = ageGroups.map((_, i) => {
    // Distribute recovered people with more in younger age groups
    const distribution = [
      0.15 + dayFactor * 0.02,
      0.18 + dayFactor * 0.01,
      0.15,
      0.12,
      0.1,
      0.1 - dayFactor * 0.01,
      0.08 - dayFactor * 0.01,
      0.07 - dayFactor * 0.01,
      0.05 - dayFactor * 0.01,
    ]
    return Math.round(totalRecovered * distribution[i])
  })

  const deceasedData = ageGroups.map((_, i) => {
    // Distribute deceased people with more in older age groups, increasing over time
    const distribution = [
      0.02,
      0.03,
      0.05,
      0.07,
      0.1,
      0.15 + dayFactor * 0.01,
      0.18 + dayFactor * 0.02,
      0.2 + dayFactor * 0.03,
      0.2 + dayFactor * 0.04,
    ]
    return Math.round(totalDeceased * distribution[i])
  })

  return {
    ageGroups,
    healthyData,
    infectedData,
    recoveredData,
    deceasedData,
  }
}

export default function ChartsPage() {
  const { simulation, isSimulationActive } = useSimulation()
  const router = useRouter()
  const [selectedStatus, setSelectedStatus] = useState("infected")

  // Create time series data from simulation history
  const timeSeriesData = useMemo(() => {
    if (!simulation?.stepHistory?.length) return []

    return simulation.stepHistory.map((step) => ({
      day: step.step,
      healthy: step.seird_counts?.S || 0,
      infected: (step.seird_counts?.E || 0) + (step.seird_counts?.I || 0), // Combine exposed and infected
      recovered: step.seird_counts?.R || 0,
      deceased: step.seird_counts?.D || 0,
    }))
  }, [simulation?.stepHistory])

  // Get current day data
  const currentDayData = useMemo(() => {
    if (!simulation?.currentStepData)
      return {
        day: 0,
        healthy: 0,
        infected: 0,
        recovered: 0,
        deceased: 0,
      }

    const counts = simulation.currentStepData.seird_counts || { S: 0, E: 0, I: 0, R: 0, D: 0 }

    return {
      day: simulation.currentStepData.step || 0,
      healthy: counts.S,
      infected: counts.E + counts.I, // Combine exposed and infected
      recovered: counts.R,
      deceased: counts.D,
    }
  }, [simulation?.currentStepData])

  // Create time series chart data
  const timeSeriesChartData = {
    labels: timeSeriesData.map((d) => `${d.day}`),
    datasets: [
      {
        label: "Healthy",
        data: timeSeriesData.map((d) => d.healthy),
        borderColor: chartColors.healthy.main,
        backgroundColor: (context) => {
          const chart = context.chart
          const { ctx, chartArea } = chart
          if (!chartArea) return chartColors.healthy.light

          // Create gradient fill
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
          gradient.addColorStop(0, chartColors.healthy.gradient.end)
          gradient.addColorStop(1, chartColors.healthy.gradient.start)
          return gradient
        },
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: chartColors.healthy.main,
        pointBorderColor: "#fff",
        pointBorderWidth: 1,
        pointHoverRadius: 5,
      },
      {
        label: "Infected",
        data: timeSeriesData.map((d) => d.infected),
        borderColor: chartColors.infected.main,
        backgroundColor: (context) => {
          const chart = context.chart
          const { ctx, chartArea } = chart
          if (!chartArea) return chartColors.infected.light

          // Create gradient fill
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
          gradient.addColorStop(0, chartColors.infected.gradient.end)
          gradient.addColorStop(1, chartColors.infected.gradient.start)
          return gradient
        },
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: chartColors.infected.main,
        pointBorderColor: "#fff",
        pointBorderWidth: 1,
        pointHoverRadius: 5,
      },
      {
        label: "Recovered",
        data: timeSeriesData.map((d) => d.recovered),
        borderColor: chartColors.recovered.main,
        backgroundColor: (context) => {
          const chart = context.chart
          const { ctx, chartArea } = chart
          if (!chartArea) return chartColors.recovered.light

          // Create gradient fill
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
          gradient.addColorStop(0, chartColors.recovered.gradient.end)
          gradient.addColorStop(1, chartColors.recovered.gradient.start)
          return gradient
        },
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: chartColors.recovered.main,
        pointBorderColor: "#fff",
        pointBorderWidth: 1,
        pointHoverRadius: 5,
      },
      {
        label: "Deceased",
        data: timeSeriesData.map((d) => d.deceased),
        borderColor: chartColors.deceased.main,
        backgroundColor: (context) => {
          const chart = context.chart
          const { ctx, chartArea } = chart
          if (!chartArea) return chartColors.deceased.light

          // Create gradient fill
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
          gradient.addColorStop(0, chartColors.deceased.gradient.end)
          gradient.addColorStop(1, chartColors.deceased.gradient.start)
          return gradient
        },
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: chartColors.deceased.main,
        pointBorderColor: "#fff",
        pointBorderWidth: 1,
        pointHoverRadius: 5,
      },
    ],
  }

  // Create donut chart data for current day
  const donutChartData = {
    labels: ["Healthy", "Infected", "Recovered", "Deceased"],
    datasets: [
      {
        data: [currentDayData.healthy, currentDayData.infected, currentDayData.recovered, currentDayData.deceased],
        backgroundColor: [
          chartColors.healthy.main,
          chartColors.infected.main,
          chartColors.recovered.main,
          chartColors.deceased.main,
        ],
        borderColor: "rgba(30, 30, 30, 0.5)",
        borderWidth: 1,
        hoverOffset: 10,
      },
    ],
  }

  // Get age distribution data for current day
  const ageData = generateAgeDistributionData(
    currentDayData.day,
    currentDayData.healthy,
    currentDayData.infected,
    currentDayData.recovered,
    currentDayData.deceased,
  )

  // Create pyramid chart data based on selected status
  const pyramidChartData = {
    labels: ageData.ageGroups,
    datasets: [
      {
        label: "Male",
        data: ageData[`${selectedStatus}Data`].map((value) => -Math.floor(value * 0.48)), // 48% male
        backgroundColor:
          selectedStatus === "healthy"
            ? chartColors.healthy.light
            : selectedStatus === "infected"
              ? chartColors.infected.light
              : selectedStatus === "recovered"
                ? chartColors.recovered.light
                : chartColors.deceased.light,
        borderColor: "rgba(30, 30, 30, 0.5)",
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: "Female",
        data: ageData[`${selectedStatus}Data`].map((value) => Math.floor(value * 0.52)), // 52% female
        backgroundColor:
          selectedStatus === "healthy"
            ? chartColors.healthy.main
            : selectedStatus === "infected"
              ? chartColors.infected.main
              : selectedStatus === "recovered"
                ? chartColors.recovered.main
                : chartColors.deceased.main,
        borderColor: "rgba(30, 30, 30, 0.5)",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }

  // Chart options
  const timeSeriesOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "rgba(255, 255, 255, 0.8)",
          font: {
            family: "system-ui",
          },
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: "rgba(20, 20, 20, 0.9)",
        titleColor: "rgba(255, 255, 255, 0.9)",
        bodyColor: "rgba(255, 255, 255, 0.9)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        usePointStyle: true,
        boxPadding: 6,
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(255, 255, 255, 0.05)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
        },
      },
      y: {
        grid: {
          color: "rgba(255, 255, 255, 0.05)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
        },
      },
    },
  }

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: {
        position: "right",
        labels: {
          color: "rgba(255, 255, 255, 0.8)",
          font: {
            family: "system-ui",
          },
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: "rgba(20, 20, 20, 0.9)",
        titleColor: "rgba(255, 255, 255, 0.9)",
        bodyColor: "rgba(255, 255, 255, 0.9)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        usePointStyle: true,
        boxPadding: 6,
      },
    },
  }

  const pyramidOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "rgba(255, 255, 255, 0.8)",
          font: {
            family: "system-ui",
          },
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: "rgba(20, 20, 20, 0.9)",
        titleColor: "rgba(255, 255, 255, 0.9)",
        bodyColor: "rgba(255, 255, 255, 0.9)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        usePointStyle: true,
        boxPadding: 6,
        callbacks: {
          label: (context) => {
            const value = context.raw as number
            return `${context.dataset.label}: ${Math.abs(value).toLocaleString()}`
          },
        },
      },
      title: {
        display: true,
        text: `Age Distribution - ${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}`,
        color: "rgba(255, 255, 255, 0.9)",
        font: {
          size: 16,
          family: "system-ui",
        },
        padding: {
          bottom: 20,
        },
      },
    },
    scales: {
      x: {
        stacked: false,
        grid: {
          color: "rgba(255, 255, 255, 0.05)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
          callback: (value) => Math.abs(Number(value)).toLocaleString(),
        },
      },
      y: {
        stacked: false,
        grid: {
          color: "rgba(255, 255, 255, 0.05)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
        },
      },
    },
  }

  const handleStatusChange = (status) => {
    setSelectedStatus(status)
  }

  // Check if simulation is active
  const simulationActive = isSimulationActive()

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-16 h-screen overflow-y-auto bg-bg-dark">
        <div className="fixed inset-0 ml-16 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-bg-dark to-bg-dark"></div>

        <div className="relative z-10 p-4 sm:p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <button
                onClick={() => router.push("/")}
                className="flex items-center text-white hover:text-accent-orange transition-colors"
              >
                <ChevronLeft className="h-5 w-5 mr-1" />
                <span>Back to Setup</span>
              </button>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2 font-serif">Simulation Charts</h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-white text-sm">
                Day: <span className="font-medium">{Math.floor(currentDayData.day / 24)}</span>
              </div>
              <PollingRateControl />
            </div>
          </div>

          {!simulationActive ? (
            <div className="h-[calc(100vh-12rem)] flex items-center justify-center orange-glow">
              <div className="animate-fade-in">
                <GlassCard variant="dark" className="max-w-md text-center p-8">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="rounded-full bg-orange-500/20 p-3">
                      <Home className="h-6 w-6 text-accent-orange" />
                    </div>
                    <h3 className="text-xl font-medium text-white font-serif">Simulation Not Started</h3>
                    <p className="text-line-gray">Return to the home page to start a new simulation.</p>
                    <Button
                      onClick={() => router.push("/")}
                      className="mt-4 bg-accent-orange hover:bg-accent-orange/90 text-white"
                    >
                      <Home className="h-4 w-4 mr-2" />
                      Start Simulation
                    </Button>
                  </div>
                </GlassCard>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Time Series Chart */}
                <GlassCard className="col-span-1 lg:col-span-2" variant="dark">
                  <h3 className="text-lg sm:text-xl font-medium text-white mb-4 font-serif">
                    Disease Progression Over Time
                  </h3>
                  <div className="h-80">
                    <Line data={timeSeriesChartData} options={timeSeriesOptions} />
                  </div>
                </GlassCard>

                {/* Donut Chart */}
                <GlassCard variant="dark">
                  <h3 className="text-lg sm:text-xl font-medium text-white mb-4 font-serif">
                    Current Population Status
                  </h3>
                  <div className="h-80">
                    <Doughnut data={donutChartData} options={donutOptions} />
                  </div>
                </GlassCard>

                {/* Pyramid Chart */}
                <GlassCard variant="dark">
                  <div className="flex flex-col mb-4">
                    <h3 className="text-lg sm:text-xl font-medium text-white font-serif mb-3">
                      Age & Gender Distribution
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`text-sm ${
                          selectedStatus === "healthy"
                            ? "bg-blue-900/30 border-blue-500 text-white"
                            : "border-white/30 text-white/70"
                        }`}
                        onClick={() => handleStatusChange("healthy")}
                      >
                        Healthy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`text-sm ${
                          selectedStatus === "infected"
                            ? "bg-orange-900/30 border-orange-500 text-white"
                            : "border-white/30 text-white/70"
                        }`}
                        onClick={() => handleStatusChange("infected")}
                      >
                        Infected
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`text-sm ${
                          selectedStatus === "recovered"
                            ? "bg-green-900/30 border-green-500 text-white"
                            : "border-white/30 text-white/70"
                        }`}
                        onClick={() => handleStatusChange("recovered")}
                      >
                        Recovered
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`text-sm ${
                          selectedStatus === "deceased"
                            ? "bg-red-900/30 border-red-500 text-white"
                            : "border-white/30 text-white/70"
                        }`}
                        onClick={() => handleStatusChange("deceased")}
                      >
                        Deceased
                      </Button>
                    </div>
                  </div>
                  <div className="h-80">
                    <Bar data={pyramidChartData} options={pyramidOptions} />
                  </div>
                </GlassCard>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
