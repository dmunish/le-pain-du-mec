"use client"

import { useSimulation } from "@/context/simulation-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export function PollingRateControl() {
  const { simulation, setPollingInterval } = useSimulation()

  const handleRateChange = (value: string) => {
    const rateInMs = Number.parseFloat(value) * 1000
    setPollingInterval(rateInMs)
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="polling-rate" className="text-xs text-white/70">
        Update Rate:
      </Label>
      <Select value={(simulation.pollingInterval / 1000).toString()} onValueChange={handleRateChange}>
        <SelectTrigger id="polling-rate" className="h-8 w-24 bg-transparent border-white/30 text-white text-xs">
          <SelectValue placeholder="Rate" />
        </SelectTrigger>
        <SelectContent className="bg-bg-dark border-white/20 text-white">
          <SelectItem value="0.5">0.5s</SelectItem>
          <SelectItem value="1">1s</SelectItem>
          <SelectItem value="2">2s</SelectItem>
          <SelectItem value="5">5s</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
