# Le Pain Du Mec - Disease Simulation Frontend

A modern and aesthetic frontend for an agent-based simulation for modeling disease spread in a city map.

## Project Overview

This project provides a web-based interface for visualizing and interacting with an agent-based disease spread simulation. It includes:

- Interactive city map visualization
- Real-time charts and graphs
- Simulation controls (play, pause, reset)
- Parameter configuration

## Setup Instructions

### Frontend Setup

1. **Clone the repository**

\`\`\`bash
git clone <repository-url>
cd le-pain-du-mec
\`\`\`

2. **Install dependencies**

\`\`\`bash
npm install
\`\`\`

3. **Set up environment variables**

Create a `.env.local` file in the root directory with the following variables:

\`\`\`
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
NEXT_PUBLIC_API_URL=http://localhost:5000
\`\`\`

You can get a Mapbox token by signing up at [Mapbox](https://www.mapbox.com/).

4. **Start the development server**

\`\`\`bash
npm run dev
\`\`\`

5. **Access the application**

Open your browser and navigate to `http://localhost:3000`

### Backend Setup

The project includes a simple Flask backend for the simulation. To set it up:

1. **Navigate to the backend directory**

\`\`\`bash
cd backend
\`\`\`

2. **Create a virtual environment (optional but recommended)**

\`\`\`bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
\`\`\`

3. **Install dependencies**

\`\`\`bash
pip install -r requirements.txt
\`\`\`

4. **Start the backend server**

\`\`\`bash
python app.py
\`\`\`

The backend will run on `http://localhost:5000`.

## Connecting Frontend and Backend

The frontend is configured to communicate with the backend through the API service layer. The connection is established through:

1. **Environment Variables**: The `NEXT_PUBLIC_API_URL` environment variable in the frontend points to the backend URL.

2. **API Service**: The `lib/api-service.ts` file contains all the functions needed to communicate with the backend.

3. **Data Types**: The `types/api.ts` file defines the data structures used for communication between frontend and backend.

## API Endpoints

The backend provides the following API endpoints:

- `POST /api/simulation/initialize`: Initialize a new simulation
- `GET /api/simulation/{id}/next`: Get the next time step
- `POST /api/simulation/{id}/pause`: Pause the simulation
- `POST /api/simulation/{id}/resume`: Resume the simulation
- `POST /api/simulation/{id}/reset`: Reset the simulation
- `GET /api/simulation/{id}/status`: Get the current simulation status

## Project Structure

- `/app`: Next.js app directory with pages and routes
- `/components`: React components
- `/context`: React context providers
- `/hooks`: Custom React hooks
- `/lib`: Utility functions and services
- `/types`: TypeScript type definitions
- `/backend`: Python Flask backend for the simulation

## Technologies Used

- **Frontend**:
  - Next.js
  - React
  - TypeScript
  - Tailwind CSS
  - Recharts
  - Mapbox GL

- **Backend**:
  - Flask
  - Python

## License

[MIT License](LICENSE)
