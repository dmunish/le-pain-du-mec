from mesa import Model
from mesa_geo import GeoSpace, GeoAgent
from mesa.time import RandomActivation
from scipy.spatial import KDTree
from typing import List, Tuple, Dict, Optional
import random
from data_loader import load_geographic_data
from pathfinding import compute_path

class Person(GeoAgent):
    """Agent representing a person with SEIRD state and age-based routine."""
    def __init__(self, model: Model, geometry, home: int, work: Optional[int], 
                 school: Optional[int], age: float,crs):
        super().__init__(model, geometry,crs)
        self.state: str = 'S'  # S, E, I, R, D
        self.age: float = age
        self.home: int = home
        self.work: Optional[int] = work
        self.school: Optional[int] = school
        self.current_destination: int = home
        self.path: List[int] = []
        self.latent_timer: int = 0
        self.infection_timer: int = 0
        self.current_node: int = home

    def step(self):
        """Update agent position and state."""
        # Update state
        if self.state == 'E':
            self.latent_timer += 1
            if self.latent_timer >= self.model.latent_period:
                self.state = 'I'
                self.latent_timer = 0
                self.infection_timer = 0
        elif self.state == 'I':
            self.infection_timer += 1
            if self.infection_timer >= self.model.recovery_period:
                self.state = 'R' if random.random() > self.model.death_rate else 'D'
        
        # Update position
        if not self.path:
            self.update_destination()
            path_key = (self.current_node, self.current_destination)
            if path_key in self.model.path_cache:
                self.path = self.model.path_cache[path_key]
            else:
                self.path = compute_path(self.model.graph, self.current_node, self.current_destination)
                self.model.path_cache[path_key] = self.path
        if self.path:
            self.current_node = self.path.pop(0)
            self.geometry = self.model.nodes.loc[self.current_node].geometry

    def update_destination(self):
        """Set new destination based on routine, age, and health status."""
        day = self.model.schedule.steps // 24 % 7
        hour = self.model.schedule.steps % 24
        is_weekday = day < 5

        # Infected agents stay home with 50% probability
        if self.state == 'I' and random.random() < 0.5:
            self.current_destination = self.home
            return

        if is_weekday:
            if 5 <= self.age < 18 and 8 <= hour < 15:  # School hours
                self.current_destination = self.school if self.school else self.home
            elif 18 <= self.age < 65 and 8 <= hour < 17:  # Work hours
                self.current_destination = self.work if self.work else self.home
            elif self.age >= 65 or self.age < 5:  # Retirees or young children
                if random.random() < 0.5:  # 50% chance for leisure
                    self.current_destination = random.choice(self.model.leisure_pois) if self.model.leisure_pois else self.home
                else:
                    self.current_destination = self.home
            else:
                self.current_destination = self.home
        else:  # Weekend
            if random.random() < 0.3:  # 30% chance for leisure
                self.current_destination = random.choice(self.model.leisure_pois) if self.model.leisure_pois else self.home
            else:
                self.current_destination = self.home

class DiseaseSpreadModel(Model):
    """Mesa model for SEIRD disease spread simulation."""
    def __init__(self, place: str, infection_prob: float, distance_threshold: float, num_agents: int,
                 latent_period: int = 120, recovery_period: int = 168, death_rate: float = 0.01, crs="EPSG:4326"):
        super().__init__()
        self.graph, self.nodes, pois = load_geographic_data(place)
        self.space = GeoSpace()
        self.schedule = RandomActivation(self)
        self.infection_prob = infection_prob
        self.distance_threshold = distance_threshold
        self.latent_period = latent_period
        self.recovery_period = recovery_period
        self.death_rate = death_rate
        self.infection_events: List[Tuple[int, int, int]] = []
        self.path_cache: Dict[Tuple[int, int], List[int]] = {}

        # Categorize POIs
        self.work_pois = list(set(pois['offices'] + pois['shops']))
        self.education_pois = list(set(pois['schools']))
        self.leisure_pois = list(set(pois['parks'] + pois['restaurants'] + pois['cafes'] + pois['shops']))

        # Initialize agents
        for i in range(num_agents):
            home = random.choice(self.nodes.index)
            age = random.uniform(0, 80)
            if 5 <= age < 18:
                school = random.choice(self.education_pois) if self.education_pois else home
                work = None
            elif 18 <= age < 65:
                school = None
                work = random.choice(self.work_pois) if self.work_pois else home
            else:
                school = None
                work = None
            geometry = self.nodes.loc[home].geometry
            agent = Person(self, geometry, home, work, school, age,crs)
            if i < num_agents * 0.01:  # 1% initially infected
                agent.state = 'I'
            self.schedule.add(agent)
            self.space.add_agents(agent)

    def step(self):
        """Advance simulation by one step."""
        self.schedule.step()
        self.check_infections()
        for agent in self.schedule.agents[:]:
            if agent.state == 'D':
                self.schedule.remove(agent)
                self.space.remove_agent(agent)

    def check_infections(self):
        """Check for infection events."""
        infected = [a for a in self.schedule.agents if a.state == 'I']
        susceptible = [a for a in self.schedule.agents if a.state == 'S']
        if not infected or not susceptible:
            return
        positions = [a.geometry.coords[0] for a in susceptible]
        tree = KDTree(positions)
        for inf in infected:
            indices = tree.query_ball_point(inf.geometry.coords[0], self.distance_threshold)
            for idx in indices:
                sus = susceptible[idx]
                if random.random() < self.infection_prob:
                    sus.state = 'E'
                    sus.latent_timer = 0
                    self.infection_events.append((inf.unique_id, sus.unique_id, self.schedule.steps))

    def get_state(self) -> dict:
        """Return current simulation state."""
        features = [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": a.geometry.coords[0]},
                "properties": {"id": a.unique_id, "state": a.state}
            }
            for a in self.schedule.agents if a.state != 'D'
        ]
        seird_counts = {
            'S': sum(1 for a in self.schedule.agents if a.state == 'S'),
            'E': sum(1 for a in self.schedule.agents if a.state == 'E'),
            'I': sum(1 for a in self.schedule.agents if a.state == 'I'),
            'R': sum(1 for a in self.schedule.agents if a.state == 'R'),
            'D': sum(1 for a in self.schedule.agents if a.state == 'D')
        }
        return {
            "agents": {"type": "FeatureCollection", "features": features},
            "seird_counts": seird_counts,
            "step": self.schedule.steps
        }