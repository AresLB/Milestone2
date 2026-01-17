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


## Running with Docker


1. **Start all services:**
   ```bash
   cd group05
   docker-compose up --build
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Start the backend:**
   ```bash
   npm start
   ```

4. **Access the application:**
   - Open browser: http://localhost:3002

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

## Implementation Details

### Architecture Overview

The system follows a three-tier architecture:

1. **Frontend Layer**: HTML5, CSS3, and Vanilla JavaScript
2. **Backend Layer**: Express.js REST API with dual database support
3. **Data Layer**: MariaDB (RDBMS) and MongoDB (NoSQL)

### Backend Implementation

#### Server Setup (`server.js`)
- Express.js application running on port 3000 (or configurable PORT)
- CORS enabled for cross-origin requests
- Static file serving for frontend assets
- Database connection pooling for both MySQL and MongoDB
- Retry mechanism (5 attempts) for database connections with 3-second delays
- Health check endpoint (`/api/health`) for monitoring database connectivity

#### Database Connections
- **MySQL**: Connection pool with 10 max connections and 10-second timeout
- **MongoDB**: Client with 5-second server selection timeout
- Both databases initialized asynchronously on server startup
- Environment variable support for production deployments

### Data Import Module (`dataImport.js`)

#### Features
- **Randomized Data Generation**: Creates realistic test data for all database tables
- **Transactional Operations**: Uses MySQL transactions to ensure data consistency
- **Cascade Deletion**: Clears all tables in dependency order before import
- **Auto-Increment Reset**: Resets primary key sequences for clean IDs

#### Generated Data Statistics
- **Persons**: 25 people with random names, emails (5 domains), and phone numbers
- **Participants**: 20 persons with registration dates, t-shirt sizes, and dietary restrictions
- **Judges**: 5 persons with expertise areas (8 categories), years of experience (2-20), and organizations
- **Venues**: 5 locations with addresses, capacities (50-500), and facility descriptions
- **Hackathon Events**: 10 events spanning 2025-2026 with date ranges and 50-200 participant limits
- **Sponsors**: 5 companies from various industries with contribution amounts ($5K-$50K)
- **Submissions**: 7 project submissions with titles, descriptions, and technology stacks
- **Workshops**: 2-3 per event with skill levels (Beginner/Intermediate/Advanced)
- **Registrations**: Each participant registers for 1-2 events with payment tracking
- **Team Assignments**: 1-3 participants per submission via the `Creates` relationship
- **Evaluations**: Each judge evaluates 2-4 submissions with scores and feedback

#### Data Integrity
- Prevents duplicate team members and evaluations using `Set` data structures
- Maintains referential integrity through explicit FK relationships
- Ensures participants and judges are disjoint sets (0 overlap)

### Submissions Module (`submissions.js`) - Student 1 Use Case

#### Endpoints
- `GET /api/submissions` - Returns all submissions with team members aggregated via GROUP_CONCAT
- `GET /api/submissions/participants` - Lists available participants for team selection
- `GET /api/submissions/:id` - Retrieves single submission with full team details
- `POST /api/submissions` - Creates new submission and links team members via `Creates` table
- `DELETE /api/submissions/:id` - Removes submission and cascades to `Creates` entries

#### Implementation Highlights
- **M:N Relationship**: Uses `Creates` junction table to link multiple participants to submissions
- **Team Management**: Allows 1+ participants per submission (team project support)
- **Aggregate Functions**: Uses SQL GROUP_CONCAT to combine team member names in single query
- **Data Validation**: Validates required fields (project_name, team_members, technology_stack)
- **Timestamp Tracking**: Records submission_time for compliance with deadline tracking

#### IS-A Relationship Handling
- Submission is related to Participant (IS-A Person) through the `Creates` table
- Leverages Person table for name/email information while maintaining Participant-specific attributes

### Registrations Module (`registrations.js`) - Student 2 Use Case

#### Endpoints
- `GET /api/registrations` - Lists all registrations with person and event details joined
- `GET /api/registrations/events` - Shows available events with venue and capacity information
- `GET /api/registrations/available-participants/:eventId` - Gets participants not yet registered
- `POST /api/registrations` - Creates new registration record with capacity validation
- `DELETE /api/registrations/:personId/:eventId` - Cancels registration using composite key

#### Implementation Highlights
- **Weak Entity Handling**: Registration has composite primary key (person_id, event_id)
- **Capacity Management**: Checks event max_participants before allowing registration
- **Payment Tracking**: Supports multiple payment statuses (completed, pending, cancelled)
- **Ticket Types**: Differentiates Early Bird, Regular, VIP, and Student registrations
- **Timestamp Recording**: Captures registration_timestamp for audit trails

#### Registration Attributes
- `registration_number`: Unique sequential identifier (format: REG-2025-###)
- `payment_status`: Tracks transaction state
- `ticket_type`: Enables tiered event access

### Analytics Module (`analytics.js`)

#### Student 1 Report (Submissions)
- **Aggregate Queries**: Counts submissions, team sizes, technology stack usage
- **Time-based Filtering**: Filter by submission time range
- **Statistics**: Participation rate, average team size, popular tech stacks
- **Performance Metrics**: Engagement per participant

#### Student 2 Report (Registrations)
- **Capacity Utilization**: Current vs max participants per event
- **Payment Breakdown**: Counts by payment_status (completed/pending/cancelled)
- **Event Statistics**: Registration counts per event_type
- **Timeline Analysis**: Registrations over time relative to event dates

#### Summary Reports
- Overall statistics across all entities
- Database health metrics
- Entity count snapshots

### NoSQL Migration Module (`nosqlMigration.js`)

#### Purpose
- Mirrors SQL data to MongoDB for alternative data access patterns
- Enables document-based queries complementary to relational structure
- Supports future NoSQL-only features

#### Data Structure
- Flattened document structure for submissions and registrations
- Denormalized participant data for performance
- Maintains referential IDs for consistency

### Frontend Implementation

#### Main Interface (`index.html`)
- Single-page application (SPA) structure
- Semantic HTML5 markup
- Tab-based navigation between features

#### Styling (`styles.css`)
- Responsive design supporting mobile to desktop
- Color scheme: Blue (#007bff) for primary actions
- Clean form layouts with proper spacing
- Accessible contrast ratios

#### Application Logic (`app.js`)
- Fetch API for HTTP requests to backend
- DOM manipulation for dynamic content rendering
- Form validation before submission
- Event listeners for user interactions
- Error handling with user-friendly messages
- Loading states for async operations

#### Features
1. **Data Import**: One-click button to populate all test data
2. **Submission Management**: Create teams, submit projects, view all submissions
3. **Registration Management**: Register for events, check availability, cancel registrations
4. **Analytics Dashboard**: View reports for both use cases with filtering options

### Database Schema Design

#### Key Design Patterns

**IS-A Inheritance (Single Table)**: 
- Person table with type indicators for Participant vs Judge
- Specialized attributes in separate Participant/Judge tables
- Allows polymorphic queries

**M:N Relationships**:
- `Creates`: Links Participants to Submissions (team projects)
- `Supports`: Links Sponsors to Events (multiple sponsors per event)
- `Evaluates`: Links Judges to Submissions (peer review)

**Weak Entity**:
- `Registration`: Depends on Person + HackathonEvent
- Composite key: (person_id, event_id)
- Contains descriptive attributes (payment_status, ticket_type)

**Relationship with Attributes**:
- All M:N relationships include metadata (timestamps, scores, feedback)

### Error Handling

#### Backend
- Try-catch blocks on all database operations
- Transaction rollback on partial failures
- Meaningful HTTP status codes (400, 404, 500)
- Detailed error messages in JSON responses

#### Frontend
- Input validation on forms
- User feedback for failed operations
- Network error handling
- Loading spinners for long operations

### Performance Considerations

1. **Database Indexing**: Primary and foreign keys indexed automatically
2. **Connection Pooling**: Reuses MySQL connections (10 max)
3. **Aggregate Queries**: Uses GROUP_CONCAT and JOINs for single-trip data retrieval
4. **Query Optimization**: Selective field retrieval, LEFT JOINs for optional data
5. **Pagination Ready**: Structure supports addition of LIMIT/OFFSET

### Deployment

#### Docker Containerization
- Multi-container setup: Backend, MySQL, MongoDB
- Environment variable configuration
- Volume mounting for persistent data
- Network isolation between containers

#### Environment Variables
```
DB_HOST=mysql
DB_USER=hackathon_user
DB_PASSWORD=hackathon_pass
DB_NAME=hackathon_db
MONGO_URI=mongodb://root:root123@mongo:27017/hackathon_db?authSource=admin
PORT=3000
```

### Future Enhancement Opportunities

1. **Authentication**: JWT-based user authentication
2. **Authorization**: Role-based access control (Admin, Judge, Participant)
3. **Real-time Updates**: WebSocket integration for live collaboration
4. **File Uploads**: Support for project documentation and proof-of-concept videos
5. **Email Notifications**: Confirmation and reminder emails
6. **Advanced Analytics**: Machine learning insights for event optimization
7. **API Documentation**: Swagger/OpenAPI specification
8. **Testing**: Unit tests, integration tests, E2E test suites
