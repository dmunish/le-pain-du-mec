"use client"

import { useState, useEffect, useRef } from "react"
import { Search } from "lucide-react"
import { env } from "@/lib/env"

interface PlaceSearchProps {
  onPlaceSelect: (place: { name: string; coordinates: [number, number] }) => void
  className?: string
}

interface PlaceSuggestion {
  id: string
  place_name: string
  center: [number, number]
}

export function PlaceSearch({ onPlaceSelect, className }: PlaceSearchProps) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query || query.length < 2 || !env.MAPBOX_TOKEN) {
        setSuggestions([])
        return
      }

      setLoading(true)
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query,
          )}.json?access_token=${env.MAPBOX_TOKEN}&types=place,locality,neighborhood&limit=5`,
        )

        if (!response.ok) throw new Error("Failed to fetch suggestions")

        const data = await response.json()
        setSuggestions(data.features || [])
        setShowSuggestions(data.features && data.features.length > 0)
      } catch (error) {
        console.error("Error fetching place suggestions:", error)
        // If API fails, provide mock suggestions for demo purposes
        const mockSuggestions = [
          { id: "1", place_name: "New York, USA", center: [-74.006, 40.7128] },
          { id: "2", place_name: "London, UK", center: [-0.1278, 51.5074] },
          { id: "3", place_name: "Paris, France", center: [2.3522, 48.8566] },
          { id: "4", place_name: "Tokyo, Japan", center: [139.6917, 35.6895] },
          { id: "5", place_name: "Sydney, Australia", center: [151.2093, -33.8688] },
        ].filter((place) => place.place_name.toLowerCase().includes(query.toLowerCase()))

        setSuggestions(mockSuggestions)
        setShowSuggestions(mockSuggestions.length > 0)
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(() => {
      fetchSuggestions()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSuggestionClick = (suggestion: PlaceSuggestion) => {
    setQuery(suggestion.place_name)
    setShowSuggestions(false)
    onPlaceSelect({
      name: suggestion.place_name,
      coordinates: suggestion.center,
    })
  }

  return (
    <div className={`relative ${className}`}>
      <div className="glass p-4 rounded-lg flex items-center">
        <Search className="h-4 w-4 text-line-gray mr-2" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search location..."
          className="bg-transparent border-none outline-none text-white w-full text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
        />
        {loading && (
          <div className="animate-spin h-4 w-4 border-2 border-accent-orange border-t-transparent rounded-full"></div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="absolute z-10 mt-1 w-full glass-dark rounded-lg overflow-hidden shadow-lg">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="p-3 hover:bg-accent-orange/20 cursor-pointer transition-colors duration-150 text-sm text-white"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion.place_name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
