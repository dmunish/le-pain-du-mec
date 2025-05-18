"""
Example Flask backend for the disease simulation
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid
import time
import random
import math

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# In-memory storage for simulations
simulations = {}

@app.route('/api/simulation/initialize', methods=['POST'])
def initialize_simulation():
    """Initialize a new simulation with the given parameters"""
    params = request.json
    
    # Generate a unique ID for this simulation
    simulation_id = str(uuid.uuid4())
    
    # Store simulation parameters and initial state
    simulations[simulation_id] = {
        'id': simulation_id,
        'parameters': params,
        'status': 'initializing',
        'current_day': 0,
        'total_days': params.get('simulationDays', 90),
        'progress': 0,
        'agents': generate_initial_agents(params),
        'stats': calculate_initial_stats(params),
        'history': [],
        'last_updated': time.time()
    }
    
    # Simulate initialization delay
    time.sleep(1)
    
    # Update status to running
    simulations[simulation_id]['status'] = 'running'
    
    return jsonify({
        'simulationId': simulation_id,
        'status': 'running',
        'currentDay': 0,
        'totalDays': params.get('simulationDays', 90),
        'progress': 0
    })

@app.route('/api/simulation/<simulation_id>/next', methods=['GET'])
def get_next_time_step(simulation_id):
    """Get the next time step for the simulation"""
    if simulation_id not in simulations:
        return jsonify({'error': 'Simulation not found'}), 404
    
    simulation = simulations[simulation_id]
    
    if simulation['status'] != 'running':
        return jsonify({'error': f'Simulation is {simulation["status"]}, not running'}), 400
    
    # Advance the simulation by one day
    simulation['current_day'] += 1
    simulation['progress'] = (simulation['current_day'] / simulation['total_days']) * 100
    
    # Generate the next time step data
    time_step = generate_time_step(simulation)
    
    # Store in history
    simulation['history'].append(time_step)
    simulation['last_updated'] = time.time()
    
    # Check if simulation is complete
    if simulation['current_day'] >= simulation['total_days']:
        simulation['status'] = 'completed'
    
    return jsonify(time_step)

@app.route('/api/simulation/<simulation_id>/pause', methods=['POST'])
def pause_simulation(simulation_id):
    """Pause the simulation"""
    if simulation_id not in simulations:
        return jsonify({'error': 'Simulation not found'}), 404
    
    simulation = simulations[simulation_id]
    
    if simulation['status'] == 'running':
        simulation['status'] = 'paused'
        simulation['last_updated'] = time.time()
        return jsonify({'success': True})
    else:
        return jsonify({'error': f'Cannot pause simulation in {simulation["status"]} state'}), 400

@app.route('/api/simulation/<simulation_id>/resume', methods=['POST'])
def resume_simulation(simulation_id):
    """Resume the simulation"""
    if simulation_id not in simulations:
        return jsonify({'error': 'Simulation not found'}), 404
    
    simulation = simulations[simulation_id]
    
    if simulation['status'] == 'paused':
        simulation['status'] = 'running'
        simulation['last_updated'] = time.time()
        return jsonify({'success': True})
    else:
        return jsonify({'error': f'Cannot resume simulation in {simulation["status"]} state'}), 400

@app.route('/api/simulation/<simulation_id>/reset', methods=['POST'])
def reset_simulation(simulation_id):
    """Reset the simulation"""
    if simulation_id not in simulations:
        return jsonify({'error': 'Simulation not found'}), 404
    
    params = simulations[simulation_id]['parameters']
    
    # Reset the simulation state
    simulations[simulation_id] = {
        'id': simulation_id,
        'parameters': params,
        'status': 'running',
        'current_day': 0,
        'total_days': params.get('simulationDays', 90),
        'progress': 0,
        'agents': generate_initial_agents(params),
        'stats': calculate_initial_stats(params),
        'history': [],
        'last_updated': time.time()
    }
    
    return jsonify({'success': True})

@app.route('/api/simulation/<simulation_id>/status', methods=['GET'])
def get_simulation_status(simulation_id):
    """Get the current status of the simulation"""
    if simulation_id not in simulations:
        return jsonify({'error': 'Simulation not found'}), 404
    
    simulation = simulations[simulation_id]
    
    return jsonify({
        'simulationId': simulation_id,
        'status': simulation['status'],
        'currentDay': simulation['current_day'],
        'totalDays': simulation['total_days'],
        'progress': simulation['progress']
    })

# Helper functions
def generate_initial_agents(params):
    """Generate the initial agent population"""
    population_size = params.get('populationSize', 10000)
    initial_infected = params.get('initialInfected', 5)
    
    agents = []
    
    for i in range(population_size):
        status = 'infected' if i < initial_infected else 'susceptible'
        
        # Random position in a 1000x1000 grid
        x = random.uniform(0, 1000)
        y = random.uniform(0, 1000)
        
        # Random age between 0 and 90
        age = random.randint(0, 90)
        
        # Random gender
        gender = 'male' if random.random() < 0.5 else 'female'
        
        agents.append({
            'id': i,
            'status': status,
            'x': x,
            'y': y,
            'age': age,
            'gender': gender
        })
    
    return agents

def calculate_initial_stats(params):
    """Calculate initial population statistics"""
    population_size = params.get('populationSize', 10000)
    initial_infected = params.get('initialInfected', 5)
    
    # Initialize age groups
    age_groups = {
        '0-9': {'total': 0, 'susceptible': 0, 'exposed': 0, 'infected': 0, 'recovered': 0, 'deceased': 0},
        '10-19': {'total': 0, 'susceptible': 0, 'exposed': 0, 'infected': 0, 'recovered': 0, 'deceased': 0},
        '20-29': {'total': 0, 'susceptible': 0, 'exposed': 0, 'infected': 0, 'recovered': 0, 'deceased': 0},
        '30-39': {'total': 0, 'susceptible': 0, 'exposed': 0, 'infected': 0, 'recovered': 0, 'deceased': 0},
        '40-49': {'total': 0, 'susceptible': 0, 'exposed': 0, 'infected': 0, 'recovered': 0, 'deceased': 0},
        '50-59': {'total': 0, 'susceptible': 0, 'exposed': 0, 'infected': 0, 'recovered': 0, 'deceased': 0},
        '60-69': {'total': 0, 'susceptible': 0, 'exposed': 0, 'infected': 0, 'recovered': 0, 'deceased': 0},
        '70-79': {'total': 0, 'susceptible': 0, 'exposed': 0, 'infected': 0, 'recovered': 0, 'deceased': 0},
        '80+': {'total': 0, 'susceptible': 0, 'exposed': 0, 'infected': 0, 'recovered': 0, 'deceased': 0},
    }
    
    # Distribute population across age groups
    for i in range(population_size):
        age = random.randint(0, 90)
        gender = 'male' if random.random() < 0.5 else 'female'
        status = 'infected' if i < initial_infected else 'susceptible'
        
        # Determine age group
        age_group = get_age_group(age)
        
        # Update age group stats
        age_groups[age_group]['total'] += 1
        age_groups[age_group][status] += 1
    
    # Gender distribution
    male_count = int(population_size * 0.5)
    female_count = population_size - male_count
    
    # Distribute infected across genders
    male_infected = min(initial_infected // 2, male_count)
    female_infected = min(initial_infected - male_infected, female_count)
    
    gender_distribution = {
        'male': {
            'total': male_count,
            'susceptible': male_count - male_infected,
            'exposed': 0,
            'infected': male_infected,
            'recovered': 0,
            'deceased': 0
        },
        'female': {
            'total': female_count,
            'susceptible': female_count - female_infected,
            'exposed': 0,
            'infected': female_infected,
            'recovered': 0,
            'deceased': 0
        }
    }
    
    return {
        'susceptible': population_size - initial_infected,
        'exposed': 0,
        'infected': initial_infected,
        'recovered': 0,
        'deceased': 0,
        'ageGroups': age_groups,
        'genderDistribution': gender_distribution
    }

def get_age_group(age):
    """Get the age group for a given age"""
    if age < 10:
        return '0-9'
    elif age < 20:
        return '10-19'
    elif age < 30:
        return '20-29'
    elif age < 40:
        return '30-39'
    elif age < 50:
        return '40-49'
    elif age < 60:
        return '50-59'
    elif age < 70:
        return '60-69'
    elif age < 80:
        return '70-79'
    else:
        return '80+'

def generate_time_step(simulation):
    """Generate the next time step data based on the current state"""
    current_day = simulation['current_day']
    agents = simulation['agents']
    stats = simulation['stats']
    params = simulation['parameters']
    
    # Simple SIR model parameters
    r0 = params.get('r0', 2.5)
    recovery_time = params.get('recoveryTime', 14)
    fatality_rate = params.get('fatalityRate', 2.1) / 100
    
    # Calculate transmission probability based on R0
    transmission_prob = r0 / recovery_time / 10  # Simplified model
    
    # Apply interventions
    social_distancing = params.get('socialDistancing', 0) / 100
    mask_usage = params.get('maskUsage', 0) / 100
    vaccination_rate = params.get('vaccinationRate', 0) / 100
    
    # Reduce transmission probability based on interventions
    transmission_prob *= (1 - social_distancing * 0.7)
    transmission_prob *= (1 - mask_usage * 0.5)
    transmission_prob *= (1 - vaccination_rate * 0.8)
    
    # Track changes for this time step
    new_infections = 0
    new_recoveries = 0
    new_deaths = 0
    
    # Update each agent
    for agent in agents:
        if agent['status'] == 'infected':
            # Determine if agent recovers or dies
            days_infected = current_day - agent.get('infection_day', 0)
            
            if days_infected >= recovery_time:
                # Determine if agent dies based on fatality rate and age
                death_prob = fatality_rate
                
                # Adjust death probability based on age
                if agent['age'] > 70:
                    death_prob *= 5
                elif agent['age'] > 60:
                    death_prob *= 3
                elif agent['age'] > 50:
                    death_prob *= 2
                
                if random.random() < death_prob:
                    agent['status'] = 'deceased'
                    agent['deceased_day'] = current_day
                    new_deaths += 1
                else:
                    agent['status'] = 'recovered'
                    agent['recovery_day'] = current_day
                    new_recoveries += 1
        
        elif agent['status'] == 'susceptible':
            # Check for new infections
            infected_nearby = 0
            
            # Simplified infection model - random chance based on number of infected
            infected_count = stats['infected']
            infection_prob = transmission_prob * (infected_count / len(agents))
            
            # Adjust based on vaccination
            if random.random() < vaccination_rate:
                infection_prob *= 0.2  # 80% reduction in infection probability if vaccinated
            
            if random.random() < infection_prob:
                agent['status'] = 'infected'
                agent['infection_day'] = current_day
                new_infections += 1
    
    # Update statistics
    stats['susceptible'] -= new_infections
    stats['infected'] += new_infections - new_recoveries - new_deaths
    stats['recovered'] += new_recoveries
    stats['deceased'] += new_deaths
    
    # Update age and gender statistics
    update_demographic_stats(agents, stats)
    
    # Calculate effective R0 based on new infections
    effective_r0 = r0
    if stats['infected'] > 0:
        effective_r0 = (new_infections / stats['infected']) * recovery_time
    
    return {
        'day': current_day,
        'agents': agents,
        'stats': stats,
        'r0': effective_r0,
        'newInfections': new_infections,
        'newRecoveries': new_recoveries,
        'newDeaths': new_deaths
    }

def update_demographic_stats(agents, stats):
    """Update age and gender statistics based on current agent states"""
    # Reset age group counts
    for age_group in stats['ageGroups']:
        for status in ['susceptible', 'exposed', 'infected', 'recovered', 'deceased']:
            stats['ageGroups'][age_group][status] = 0
    
    # Reset gender counts
    for gender in ['male', 'female']:
        for status in ['susceptible', 'exposed', 'infected', 'recovered', 'deceased']:
            stats['genderDistribution'][gender][status] = 0
    
    # Count agents by age group and gender
    for agent in agents:
        age_group = get_age_group(agent['age'])
        gender = agent['gender']
        status = agent['status']
        
        # Update age group stats
        stats['ageGroups'][age_group][status] += 1
        
        # Update gender stats
        stats['genderDistribution'][gender][status] += 1

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
