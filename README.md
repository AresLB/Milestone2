# Hackathon Management System - Milestone 2

**Course:** 052400-1 VU Information Management and Systems Engineering (2025W)
**Group:** 5
**Student 1:** Aziz, Iftekher (12338137)
**Student 2:** Baur, Lennard (12018378)

## Project Overview

A web-based Hackathon Management System implementing both relational (MariaDB) and NoSQL (MongoDB) database designs. The system allows participants to register for hackathon events and provides analytics reports on event registrations.

## Architecture

```
┌─────────────┐
│   Frontend  │ (Nginx + HTML/CSS/JS)
│   Port: 443 │
└──────┬──────┘
       │
       │ HTTPS
       │
┌──────▼──────┐
│   Backend   │ (Node.js + Express)
│   Port:3000 │
└──┬────────┬─┘
   │        │
   │        │
   ▼        ▼
┌────────┐ ┌──────────┐
│MariaDB │ │ MongoDB  │
│Pt:3306 │ │ Pt:27017 │
└────────┘ └──────────┘
```

## Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Node.js v20, Express.js
- **Databases:**
  - MariaDB 11.2 (Relational)
  - MongoDB 7.0 (NoSQL)
- **Infrastructure:** Docker, Docker Compose, Nginx
- **Security:** HTTPS with self-signed SSL certificates

## Prerequisites

Before running this application, ensure you have the following installed:

- **Docker:** Version 24.0 or higher
- **Docker Compose:** Version 2.20 or higher
- **unzip:** For extracting the submission

You can verify your installations:
```bash
docker --version
docker compose version
```

## Quick Start

### 1. Extract the ZIP file
```bash
unzip submission.zip
cd Milestone2
```

### 2. Start all services
```bash
docker compose up --build
```

This command will:
- Build the backend and frontend containers
- Start MariaDB and MongoDB containers
- Initialize the databases
- Start the web server

### 3. Access the application

- **Frontend (HTTPS):** https://localhost
- **Frontend (HTTP):** http://localhost (redirects to HTTPS)
- **Backend API:** https://localhost/api/
- **Health Check:** https://localhost/api/health

**Note:** Your browser will show a security warning because of the self-signed SSL certificate. This is expected - click "Advanced" and proceed to the site.

## Project Structure

```
Milestone2/
├── backend/
│   ├── src/
│   │   ├── config/          # Database configurations
│   │   │   ├── mariadb.config.js
│   │   │   └── mongodb.config.js
│   │   ├── controllers/     # Request handlers
│   │   ├── models/          # Data models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Custom middleware
│   │   └── app.js           # Application entry point
│   ├── sql/                 # SQL scripts
│   │   ├── create_tables.sql      # Table definitions
│   │   ├── insert_data.sql        # Sample data
│   │   └── queries.sql            # Analytics queries
│   ├── package.json         # Node.js dependencies
│   └── Dockerfile           # Backend container config
│
├── frontend/
│   ├── public/
│   │   ├── css/             # Stylesheets
│   │   ├── js/              # JavaScript files
│   │   ├── images/          # Images and assets
│   │   └── index.html       # Main HTML page
│   ├── nginx/
│   │   └── nginx.conf       # Nginx configuration
│   └── Dockerfile           # Frontend container config
│
├── docker-compose.yml       # Docker orchestration
├── .gitignore
└── README.md                # This file
```

## Features

### Student 2 Use Case: Register Participant for Event

**Description:** Allows a participant to register for a hackathon event by selecting ticket type and providing necessary information.

**Entities Involved:**
- Person (superclass)
- Participant (IS-A Person)
- HackathonEvent
- Venue (related to HackathonEvent)
- Registration (relationship with attributes)

**Workflow:**
1. Select participant from list
2. Choose hackathon event
3. Select ticket type (Standard/VIP/Student)
4. Confirm registration
5. System validates and creates registration record

### Student 2 Analytics Report: Event Registration Statistics

**Description:** Provides comprehensive statistics on event registrations including capacity utilization, payment status, and participant details.

**Query Involves:**
- Person
- Participant
- HackathonEvent
- Venue
- Registration (relationship table)

**Filter Field:** event_type (e.g., "Hackathon")

## API Endpoints

### Health Check
```
GET /api/health
```

### MariaDB Operations
```
GET    /api/mariadb/events           # List all events
GET    /api/mariadb/participants     # List all participants
POST   /api/mariadb/register         # Register participant for event
GET    /api/mariadb/report           # Get analytics report
POST   /api/mariadb/import-data      # Import/regenerate sample data
```

### MongoDB Operations
```
GET    /api/mongodb/events           # List all events (NoSQL)
GET    /api/mongodb/participants     # List all participants (NoSQL)
POST   /api/mongodb/register         # Register participant (NoSQL)
GET    /api/mongodb/report           # Get analytics report (NoSQL)
POST   /api/mongodb/migrate          # Migrate data from MariaDB to MongoDB
```

## Development

### Running in Development Mode

1. Install dependencies:
```bash
cd backend
npm install
```

2. Start databases only:
```bash
docker compose up mariadb mongodb
```

3. Run backend in development mode:
```bash
cd backend
npm run dev
```

### Stopping the Application

```bash
# Stop all services
docker compose down

# Stop and remove volumes (deletes all data)
docker compose down -v
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f mariadb
docker compose logs -f mongodb
```

### Accessing Databases Directly

**MariaDB:**
```bash
docker exec -it hackathon_mariadb mariadb -u hackathon_user -phackathon_pass hackathon_db
```

**MongoDB:**
```bash
docker exec -it hackathon_mongodb mongosh -u admin -p adminpass --authenticationDatabase admin
```

## Troubleshooting

### Port Already in Use
If ports 80, 443, 3000, 3306, or 27017 are already in use:
```bash
# Check what's using the port
sudo lsof -i :PORT_NUMBER

# Stop the conflicting service or change ports in docker-compose.yml
```

### SSL Certificate Warnings
The application uses self-signed SSL certificates. This is normal and expected. In your browser:
- Chrome/Edge: Click "Advanced" → "Proceed to localhost (unsafe)"
- Firefox: Click "Advanced" → "Accept the Risk and Continue"

### Database Connection Errors
If you see database connection errors:
```bash
# Restart the services
docker compose restart

# Check database health
docker compose ps
```
