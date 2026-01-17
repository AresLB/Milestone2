# Hackathon Management System

**Group 5 - Information Management and Systems Engineering (2025W)**  
- Student 1: Aziz Iftekher - 12338137  
- Student 2: Baur Lennard - 12018378

## Project Overview

This is a web-based hackathon management system that implements:
- **Student 1 Use Case**: Submit Hackathon Project (IS-A Relationship)
- **Student 2 Use Case**: Register Participant for Event (Weak Entity)

## Tech Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js with Express.js
- **Databases**: 
  - MariaDB (RDBMS)
  - MongoDB (NoSQL)
- **Containerization**: Docker & Docker Compose

## Project Structure

```
hackathon-system/
├── docker-compose.yml      # Docker orchestration
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js           # Main Express server
│   └── routes/
│       ├── dataImport.js   # Data import/generation
│       ├── submissions.js  # Student 1 use case
│       ├── registrations.js # Student 2 use case
│       └── analytics.js    # Analytics reports
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── sql/
    └── init.sql            # Database schema
```

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development without Docker)

## Running with Docker (Recommended)

1. **Start all services:**
   ```bash
   cd hackathon-system
   docker-compose up --build
   ```

2. **Access the application:**
   - Open browser: http://localhost:3001

3. **Stop services:**
   ```bash
   docker-compose down
   ```

4. **Stop and remove data:**
   ```bash
   docker-compose down -v
   ```

## Running Locally (Development)

1. **Start MariaDB and MongoDB:**
   ```bash
   docker-compose up mariadb mongodb
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Set environment variables:**
   ```bash
   export DB_HOST=localhost
   export DB_USER=hackathon_user
   export DB_PASSWORD=hackathon_pass
   export DB_NAME=hackathon_db
   export MONGO_URI=mongodb://root:root123@localhost:27017/hackathon_db?authSource=admin
   ```

4. **Start the backend:**
   ```bash
   npm start
   ```

5. **Access the application:**
   - Open browser: http://localhost:3000

## Features

### Data Management (2.2.1)
- **Import Data Button**: Generates randomized test data
- Replaces existing data with fresh randomized data
- Generates: Persons, Participants, Judges, Venues, Events, Sponsors, Submissions, Registrations

### Submit Hackathon Project (Student 1)
- Create individual or team submissions
- Select team members from registered participants
- Specify project details (name, description, tech stack, repository URL)
- Creates records in `Submission` and `Creates` tables (M:N relationship)

### Register for Event (Student 2)
- Register participants for hackathon events
- Check event capacity before registration
- Track payment status and ticket types
- Creates records in `Registration` table (weak entity with composite key)

### Analytics Reports

**Student 1 Report**: Submission Statistics
- Filter by submission_time
- Shows participant engagement metrics
- Technology stack usage analysis

**Student 2 Report**: Registration Statistics
- Filter by event_type
- Shows capacity utilization
- Payment status breakdown

## API Endpoints

### Data Management
- `POST /api/data/import` - Import randomized data
- `GET /api/data/stats` - Get database statistics

### Submissions (Student 1)
- `GET /api/submissions` - List all submissions
- `GET /api/submissions/participants` - Get available participants
- `POST /api/submissions` - Create new submission
- `DELETE /api/submissions/:id` - Delete submission

### Registrations (Student 2)
- `GET /api/registrations` - List all registrations
- `GET /api/registrations/events` - Get available events
- `POST /api/registrations` - Create new registration
- `DELETE /api/registrations/:personId/:eventId` - Cancel registration

### Analytics
- `GET /api/analytics/submissions` - Submission analytics (Student 1)
- `GET /api/analytics/registrations` - Registration analytics (Student 2)
- `GET /api/analytics/summary` - Overall statistics

## Database Schema

The system uses the ER diagram from Milestone 1 with these main entities:
- Person (superclass)
- Participant (IS-A Person)
- Judge (IS-A Person)
- Venue
- HackathonEvent
- Sponsor
- Submission
- Workshop (weak entity)
- Registration (relationship with attributes)

See `sql/init.sql` for complete schema.
