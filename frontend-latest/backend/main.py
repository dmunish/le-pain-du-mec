from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Tuple
import uuid
import random
import math
import time
from enum import Enum

app = FastAPI(title="Disease Simulation API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class SimulationStatus(str, Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"

class SimulationParameters(BaseModel):
    placeName: str
    coordinates: Tuple[float, float]
    numberOfAgents: int
    infectionProbability: float
    distanceThreshold: float
    duration: int
    latentPeriod: int
    recoveryPeriod: int
    deathRate: float

class SimulationResponse(BaseModel):
    simulationId: str
    status: SimulationStatus

class StepResponse(BaseModel):
    agents: Dict
    seird_counts: Dict[str, int]
    step: int

# In-memory storage for simulations
simulations = {}

@app.post("/api/simulation/initialize", response_model=SimulationResponse)
async def initialize_simulation(params: SimulationParameters):
    """Initialize a new disease simulation with the given parameters"""
    simulation_id = str(uuid.uuid4())
    
    # Store simulation parameters
    simulations[simulation_id] = {
        "params": params.dict(),
        "status": SimulationStatus.RUNNING,
        "current_step": 0,
        "agents": initialize_agents(params),
        "history": []
    }
    
    return SimulationResponse(
        simulationId=simulation_id,
        status=SimulationStatus.RUNNING
    )

@app.get("/api/simulation/{simulation_id}/step", response_model=StepResponse)
async def get_next_step(simulation_id: str):
    """Get the next step of the simulation"""
    if simulation_id not in simulations:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    simulation = simulations[simulation_id]
    
    # Increment step
    simulation["current_step"] += 1
    
    # Run simulation step
    step_data = run_simulation_step(simulation)
    
    # Store step in history
    simulation["history"].append(step_data)
    
    # Check if simulation is complete
    if simulation["current_step"] >= simulation["params"]["duration"] * 24:  # 24 steps per day
        simulation["status"] = SimulationStatus.COMPLETED
    
    return step_data

def initialize_agents(params: SimulationParameters):
    """Initialize agents for the simulation"""
    agents = []
    center_x, center_y = params.coordinates
    
    for i in range(params.numberOfAgents):
        # Random position around center
        angle = random.random() * 2 * math.pi
        distance = random.random() * 5000  # 5km radius
        x = center_x + distance * math.cos(angle)
        y = center_y + distance * math.sin(angle)
        
        # Random age between 0 and 90
        age = random.random() * 90
        
        # Initial state (start with a few infected)
        state = "I" if i < params.numberOfAgents * 0.01 else "S"
        
        agents.append({
            "id": i,
            "state": state,
            "age": age,
            "coordinates": [x, y]
        })
    
    return agents

def run_simulation_step(simulation):
    """Run a single step of the simulation"""
    agents = simulation["agents"]
    params = simulation["params"]
    step = simulation["current_step"]
    
    # Apply disease model rules
    for agent in agents:
        if agent["state"] == "S":
            # Check for infection
            for other in agents:
                if other["state"] == "I":
                    distance = math.sqrt(
                        (agent["coordinates"][0] - other["coordinates"][0])**2 +
                        (agent["coordinates"][1] - other["coordinates"][1])**2
                    )
                    if distance < params["distanceThreshold"] * 100:  # Convert to meters
                        if random.random() < params["infectionProbability"]:
                            agent["state"] = "E"  # Exposed
                            break
        
        elif agent["state"] == "E":
            # Check for progression to infected
            days_exposed = step / 24  # 24 steps per day
            if days_exposed >= params["latentPeriod"]:
                agent["state"] = "I"
        
        elif agent["state"] == "I":
            # Check for recovery or death
            days_infected = step / 24  # 24 steps per day
            if days_infected >= params["recoveryPeriod"]:
                # Determine if agent dies or recovers
                death_probability = params["deathRate"] / 100  # Convert from percentage
                # Adjust by age (older = higher risk)
                age_factor = agent["age"] / 90  # Normalize age to 0-1
                adjusted_death_prob = death_probability * (1 + age_factor)
                
                if random.random() < adjusted_death_prob:
                    agent["state"] = "D"
                else:
                    agent["state"] = "R"
        
        # Move agents slightly
        move_distance = random.random() * 50  # Up to 50 meters
        move_angle = random.random() * 2 * math.pi
        agent["coordinates"][0] += move_distance * math.cos(move_angle)
        agent["coordinates"][1] += move_distance * math.sin(move_angle)
    
    # Count agents in each state
    counts = {"S": 0, "E": 0, "I": 0, "R": 0, "D": 0}
    for agent in agents:
        counts[agent["state"]] += 1
    
    # Format response
    features = []
    for agent in agents:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": agent["coordinates"]
            },
            "properties": {
                "id": agent["id"],
                "state": agent["state"],
                "age": agent["age"]
            }
        })
    
    return {
        "agents": {
            "type": "FeatureCollection",
            "features": features
        },
        "seird_counts": counts,
        "step": step
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
