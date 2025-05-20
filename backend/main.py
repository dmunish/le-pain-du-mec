from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
from simulation import DiseaseSpreadModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow requests from any origin (for dev); restrict this in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or specify ["http://localhost:3000"] for local frontend
    allow_credentials=True,
    allow_methods=["*"],  # or ["POST", "GET", "OPTIONS"]
    allow_headers=["*"],
)

class SimulationParams(BaseModel):
    place: str = "Linz, Austria"
    infection_prob: float = 0.2
    distance_threshold: float = 0.5
    num_agents: int = 500
    latent_period: int = 120
    recovery_period: int = 168
    death_rate: float = 0.01
    total_days: int = 90

model = None

@app.post("/api/simulation/initialize")
async def start_simulation(params: SimulationParams):
    """Start a new simulation."""
    global model
    model = DiseaseSpreadModel(params.place, params.infection_prob, params.distance_threshold,
                               params.num_agents, params.latent_period, params.recovery_period, params.death_rate,params.total_days)
    return {
        'status': 'running',
        'currentDay': 0,
        'totalDays': getattr(params,'simulationDays', 90),
        'progress': 0
    }

@app.get("/api/simulation/next")
async def get_state():
    """Get current simulation state."""
    if model is None:
        return {"error": "No simulation running"}
    state = model.get_state()
    model.step()
    return state

@app.get("/api/simulation/status")
async def get_status():
    """Get infection events."""
    if model is None:
        return {"error": "No simulation running"}
    return {
        'status': "running",
        'currentDay': model.progress//24,
        'totalDays': model.total_days,
        'progress': model.progress
    }

def initialize_simulation(place: str, infection_prob: float, distance_threshold: float, num_agents: int,
                         latent_period: int = 120, recovery_period: int = 168, death_rate: float = 0.01) -> DiseaseSpreadModel:
    """Initialize the simulation model."""
    return DiseaseSpreadModel(place, infection_prob, distance_threshold, num_agents, latent_period, recovery_period, death_rate)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)