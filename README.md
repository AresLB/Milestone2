# Hackathon Management System

## Project Overview

This project is a **Hackathon Management System** developed as part of the
**Information Management & Systems Engineering (IMSE)** course.

The system provides functionality to:

* manage hackathon events
* register participants
* store project submissions
* view analytics and statistics

The implementation follows the requirements of **Milestone 2**, including:

* containerized infrastructure
* relational database setup
* database initialization with schema
* a modern web-based interface

---

## System Infrastructure

The project uses a **container-based architecture** with Docker.

### Components

* **Backend**

  * Node.js with Express
  * Provides REST API endpoints
  * Connects to the MariaDB database
  * Runs on port 3000

* **Relational Database**

  * MariaDB 10.11
  * Stores events, participants, registrations, submissions, judges, sponsors, and workshops
  * Uses a persistent Docker volume
  * Schema initialized via SQL script on container startup

* **Frontend**

  * React 18 with TypeScript
  * Vite build tool
  * Tailwind CSS for styling
  * shadcn/ui component library
  * Pages: Home, Register Event, Submit Project, Analytics
  * Served via Nginx on port 3000

All components are started and connected using **Docker Compose**.

---

## Project Structure

```text
milestone2/
├── docker-compose.yml      # Defines MariaDB, backend, and frontend services
├── Dockerfile.frontend     # Multi-stage build: Node build + Nginx production
├── index.html              # HTML entry point with root div for React
├── package.json            # Frontend deps: React, TypeScript, Tailwind, shadcn/ui
├── vite.config.ts          # Vite config with React plugin and path aliases
├── tailwind.config.ts      # Tailwind CSS with dark mode and custom colors
├── tsconfig.json           # TypeScript config with path aliases and ESM
│
├── backend/
│   ├── Dockerfile          # Node 20-Alpine image running Express server
│   ├── package.json        # Backend deps: Express, CORS, MySQL2
│   └── server.js           # Express REST API with MariaDB connection pool
│
├── sql/
│   └── create.sql          # Database schema: Person, Events, Submissions, etc.
│
└── src/
    ├── App.tsx             # Root component with React Query, Router, routes
    ├── main.tsx            # Entry point mounting React app into DOM
    ├── components/
    │   ├── Layout.tsx      # Header, nav bar, main content area, footer
    │   ├── NavLink.tsx     # React Router NavLink wrapper with active state
    │   └── ui/             # shadcn/ui components
    ├── pages/
    │   ├── Home.tsx        # Landing page with data import and feature cards
    │   ├── RegisterEvent.tsx   # Event registration form for participants
    │   ├── SubmitProject.tsx   # Project submission form (individual/team)
    │   ├── Analytics.tsx       # Dashboard with Recharts visualizations
    │   └── NotFound.tsx        # 404 error page with home navigation
    ├── lib/
    │   ├── api.ts          # API client with fetch wrapper and interfaces
    │   ├── mockData.ts     # Sample data for demo mode
    │   └── utils.ts        # Utility for className management (clsx + twMerge)
    └── hooks/
        ├── use-mobile.tsx  # Hook detecting mobile viewport (768px breakpoint)
        └── use-toast.ts    # Toast notification system with auto-dismiss
```

---

## Prerequisites

To run this project, you need:

* Docker
* Docker Compose

No local installation of Node.js or MySQL is required, as everything runs inside containers.

---

## How to Run the Project

### Step 1: Clone the repository

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_FOLDER>
```

### Step 2: Build and start the system

```sh
docker compose up --build
```

This command will:

* build the frontend container (React app served via Nginx)
* build the backend container (Node.js/Express API)
* start the MariaDB database container
* initialize the database schema from `sql/create.sql`

### Step 3: Access the application

* Frontend (Web interface): [http://localhost:3000](http://localhost:3000)

---

## Database Schema (Task 2.2.1)

The database schema is defined in `sql/create.sql` and includes the following tables:

* **Person** - Base entity for participants and judges (ISA relationship)
* **Participant** - Extends Person with hackathon-specific attributes
* **Judge** - Extends Person with judging expertise
* **InnovationManager** - Recursive relationship for participant mentorship
* **Venue** - Event locations
* **Sponsor** - Event sponsors with tier levels
* **HackathonEvent** - Main event entity
* **Workshop** - Workshops within events
* **Supports** - M:N relationship between Sponsors and Events
* **Registration** - Participant event registrations
* **Submission** - Project submissions
* **Creates** - M:N relationship between Participants and Submissions
* **Evaluates** - Judge scores and feedback for submissions

The schema is automatically applied when the database container starts for the first time.
This fulfills the **DB Setup / Data Import / Base Function** requirement of Milestone 2.

---

## Notes

* No external authentication providers or third-party services are used.
* The setup is designed to be reproducible on a clean machine using Docker.
* Database credentials are configured in `docker-compose.yml` for development purposes.
