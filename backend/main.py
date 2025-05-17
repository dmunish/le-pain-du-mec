from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
from simulation import DiseaseSpreadModel

app = FastAPI()

class SimulationParams(BaseModel):
    place: str = "Linz, Austria"
    infection_prob: float = 0.2
    distance_threshold: float = 0.5
    num_agents: int = 50
    latent_period: int = 120
    recovery_period: int = 168
    death_rate: float = 0.01

model = None

@app.get("/start_simulation")
async def start_simulation():
    """Start a new simulation."""
    global model
    simulationparams=SimulationParams()
    model = DiseaseSpreadModel(*simulationparams.dict().values())
    return {"status": "Simulation started"}

@app.get("/get_state")
async def get_state():
    """Get current simulation state."""
    if model is None:
        return {"error": "No simulation running"}
    state = model.get_state()
    model.step()
    return state

@app.get("/get_infections")
async def get_infections():
    """Get infection events."""
    if model is None:
        return {"error": "No simulation running"}
    return [{"transmitter": t, "receiver": r, "timestamp": ts} for t, r, ts in model.infection_events]

def initialize_simulation(place: str, infection_prob: float, distance_threshold: float, num_agents: int,
                         latent_period: int = 120, recovery_period: int = 168, death_rate: float = 0.01) -> DiseaseSpreadModel:
    """Initialize the simulation model."""
    return DiseaseSpreadModel(place, infection_prob, distance_threshold, num_agents, latent_period, recovery_period, death_rate)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)