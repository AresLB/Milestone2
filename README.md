# Hackathon Management System

**Group 5 – Information Management and Systems Engineering (2025W)**

* **Student 1:** Aziz Iftekher (12338137)
* **Student 2:** Baur Lennard (12018378)

---

## Project Overview

This project implements a **web-based Hackathon Management System** developed as part of the IMSE course.
The system supports the core workflows defined in Milestone 1 and fully implemented in Milestone 2, including both relational and NoSQL database backends.

Implemented use cases:

* **Student 1 Use Case:**
  *Submit Hackathon Project*
  Demonstrates an **IS-A relationship**, where `Participant` inherits from `Person`, and supports both individual and team-based project submissions.

* **Student 2 Use Case:**
  *Manage Workshops*
  Implements a **weak entity** design, where `Workshop` depends on `HackathonEvent`.

In addition, the system provides analytics reports for both use cases and supports data migration from MariaDB to MongoDB.

---

## Technology Stack

* **Frontend:** HTML, CSS, Vanilla JavaScript
* **Backend:** Node.js with Express.js
* **Databases:**

  * MariaDB (Relational Database)
  * MongoDB (NoSQL Database)
* **Containerization:** Docker and Docker Compose

---

## Project Structure

```
group05/
├── docker-compose.yml         # Docker orchestration
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js              # Main Express server
│   └── routes/
│       ├── dataImport.js      # Random data generation and import
│       ├── nosqlMigration.js  # MySQL → MongoDB migration
│       ├── submissions.js     # Student 1 use case (project submission)
│       ├── workshops.js       # Student 2 use case (workshop management)
│       └── analytics.js       # Analytics reports for both use cases
├── frontend/
│   ├── index.html             # Main UI
│   ├── styles.css             # Styling
│   └── app.js                 # Client-side logic
└── sql/
    └── init.sql               # Relational database schema
```

---

## Prerequisites

* Docker and Docker Compose installed
* Node.js version 18 or higher (only required if running without Docker)

---

## Running the Application

1. **Start all services:**

   ```bash
   cd group05
   docker compose up --build
   ```

---

2. **Install backend dependencies:**

   ```bash
   cd backend
   npm install
   ```

3. **Start the backend server:**

   ```bash
   npm start
   ```

3. **Access the application:**

   * Open a browser and navigate to:
     [http://localhost:3000](http://localhost:3000)


**Note:**
If a port conflict occurs, you can change the port in `server.js`:

```js
const PORT = process.env.PORT || 3000;
```