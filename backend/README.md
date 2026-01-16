# Backend API - Hackathon Management System

**Student 2:** Baur, Lennard (12018378)

## Architecture

```
src/
├── config/           # Database configuration
│   ├── mariadb.config.js
│   └── mongodb.config.js
├── controllers/      # HTTP request handlers
│   ├── mariadb.controller.js
│   └── mongodb.controller.js
├── services/         # Business logic
│   ├── mariadb.service.js
│   └── mongodb.service.js
├── routes/           # API route definitions
│   ├── mariadb.routes.js
│   └── mongodb.routes.js
└── app.js            # Express application entry point
```

## API Endpoints

### Health Check

```
GET /api/health
```

Returns API status and timestamp.

---

## MariaDB Endpoints

### Get All Events

```
GET /api/mariadb/events
```

Returns all events with registration statistics.

**Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [...]
}
```

### Get All Participants

```
GET /api/mariadb/participants
```

Returns all participants with their registration counts.

### Register Participant for Event (Student 2 Use Case)

```
POST /api/mariadb/register
Content-Type: application/json

{
  "personId": 5,
  "eventId": 1,
  "ticketType": "Standard",
  "paymentStatus": "pending"
}
```

**Valid ticket types:** `Standard`, `VIP`, `Student`
**Valid payment statuses:** `pending`, `completed`

**Success Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "registration": {
    "registration_number": "REG-2025-...",
    "first_name": "Lisa",
    "last_name": "Wagner",
    ...
  }
}
```

**Error Responses:**
- `400` - Missing required fields or invalid ticket type
- `404` - Participant or event not found
- `409` - Already registered or event at full capacity
- `500` - Internal server error

### Get Analytics Report (Student 2 Analytics Report)

```
GET /api/mariadb/report
GET /api/mariadb/report?eventType=Hackathon
```

Returns event registration statistics with optional event type filter.

**Query Parameters:**
- `eventType` (optional) - Filter by event type: `Hackathon`, `Conference`, `Workshop`

**Response:**
```json
{
  "success": true,
  "filter": { "eventType": "Hackathon" },
  "count": 3,
  "data": [
    {
      "event_id": 1,
      "event_name": "AI Innovation Hackathon 2025",
      "event_type": "Hackathon",
      "total_registrations": 8,
      "capacity_percentage": 5.33,
      "paid_registrations": 5,
      "pending_payments": 3,
      "standard_tickets": 4,
      "vip_tickets": 3,
      "student_tickets": 1,
      "registered_participants": "Anna Mueller (Standard); Michael Schmidt (VIP); ...",
      ...
    }
  ]
}
```

### Import/Regenerate Data

```
POST /api/mariadb/import-data
```

Clears existing data and generates randomized test data (MS2 2.2.1).

**Response:**
```json
{
  "success": true,
  "message": "Data imported successfully",
  "statistics": [...]
}
```

### Initialize Database

```
POST /api/mariadb/initialize
```

Creates tables and inserts initial data.

### Get Database Statistics

```
GET /api/mariadb/stats
```

Returns entity counts.

---

## MongoDB Endpoints

All MongoDB endpoints mirror the MariaDB endpoints but operate on the NoSQL database.

### Migrate Data from MariaDB to MongoDB (MS2 2.3.2)

```
POST /api/mongodb/migrate
```

Migrates all data from MariaDB to MongoDB. Clears existing MongoDB data first.

**NoSQL Design:**
- Uses MongoDB's `_id` as primary identifier (no redundant IDs)
- Embedded documents for frequently accessed related data
- Denormalized for read optimization
- References for M:N relationships

**Response:**
```json
{
  "success": true,
  "message": "Data migration completed successfully",
  "statistics": {
    "venues": 6,
    "sponsors": 8,
    "events": 10,
    "workshops": 15,
    "participants": 20,
    "judges": 8,
    "submissions": 10
  }
}
```

### Get All Events (NoSQL)

```
GET /api/mongodb/events
```

Returns events from MongoDB with embedded venue and registration data.

### Get All Participants (NoSQL)

```
GET /api/mongodb/participants
```

Returns participants from MongoDB with event history.

### Register Participant for Event (NoSQL - Student 2 Use Case)

```
POST /api/mongodb/register
Content-Type: application/json

{
  "personId": 5,
  "eventId": 1,
  "ticketType": "Standard",
  "paymentStatus": "pending"
}
```

Same interface as MariaDB version, but operates on MongoDB.

**Implementation Differences:**
- Updates embedded arrays in event documents
- Updates participant's event history array
- Uses MongoDB's array operators (`$push`, `$inc`, `$set`)

### Get Analytics Report (NoSQL - Student 2 Analytics Report)

```
GET /api/mongodb/report
GET /api/mongodb/report?eventType=Hackathon
```

Uses MongoDB aggregation pipeline to generate the same report.

**Aggregation Pipeline:**
- `$match` - Filter by event type
- `$project` - Calculate statistics, ticket breakdowns
- `$sort` - Order by date and registration count

### Get Database Statistics (NoSQL)

```
GET /api/mongodb/stats
```

Returns MongoDB collection counts.

---

## Development

### Install Dependencies

```bash
npm install
```

### Run in Development Mode

```bash
npm run dev
```

Uses `nodemon` for auto-reload on file changes.

### Run in Production Mode

```bash
npm start
```

### Environment Variables

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

## Testing

### Test MariaDB Endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Get events
curl http://localhost:3000/api/mariadb/events

# Register participant
curl -X POST http://localhost:3000/api/mariadb/register \
  -H "Content-Type: application/json" \
  -d '{
    "personId": 5,
    "eventId": 1,
    "ticketType": "Standard"
  }'

# Get analytics report
curl http://localhost:3000/api/mariadb/report?eventType=Hackathon

# Import random data
curl -X POST http://localhost:3000/api/mariadb/import-data
```

### Test MongoDB Endpoints

```bash
# Migrate data
curl -X POST http://localhost:3000/api/mongodb/migrate

# Get events (NoSQL)
curl http://localhost:3000/api/mongodb/events

# Register participant (NoSQL)
curl -X POST http://localhost:3000/api/mongodb/register \
  -H "Content-Type: application/json" \
  -d '{
    "personId": 5,
    "eventId": 1,
    "ticketType": "VIP"
  }'

# Get analytics report (NoSQL)
curl http://localhost:3000/api/mongodb/report?eventType=Hackathon
```

## Database Connections

### MariaDB Connection Pool

- Located in: `src/config/mariadb.config.js`
- Uses `mysql2/promise` with connection pooling
- Auto-reconnects on connection loss
- Connection limits: 10 concurrent connections

### MongoDB Connection

- Located in: `src/config/mongodb.config.js`
- Uses native MongoDB driver
- Connection pool: 2-10 connections
- Idle timeout: 30 seconds

## Error Handling

The API uses consistent error response format:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created (registration successful)
- `400` - Bad Request (validation errors)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (already registered, capacity full)
- `500` - Internal Server Error

## Student 2 Implementation

### Use Case: Register Participant for Event

**Files:**
- Service: `src/services/mariadb.service.js` - `registerParticipantForEvent()`
- NoSQL: `src/services/mongodb.service.js` - `registerParticipantForEvent()`
- Controller: `src/controllers/mariadb.controller.js` - `registerParticipant()`
- NoSQL: `src/controllers/mongodb.controller.js` - `registerParticipant()`

**Workflow:**
1. Validate participant exists
2. Validate event exists
3. Check if already registered
4. Check event capacity
5. Generate unique registration number
6. Create registration record (SQL) or update embedded arrays (NoSQL)

**Entities Involved:**
- Person (IS-A superclass)
- Participant (IS-A subclass)
- HackathonEvent
- Venue (via hosts relationship)
- Registration (relationship with attributes)

### Analytics Report: Event Registration Statistics

**Files:**
- Service: `src/services/mariadb.service.js` - `getAnalyticsReport()`
- NoSQL: `src/services/mongodb.service.js` - `getAnalyticsReport()`
- Controller: `src/controllers/mariadb.controller.js` - `getAnalyticsReport()`
- NoSQL: `src/controllers/mongodb.controller.js` - `getAnalyticsReport()`

**Query Requirements:**
- Involves 5 entities: Person, Participant, HackathonEvent, Venue, Registration
- Filter field: `event_type`
- Shows: registration counts, capacity %, payment status, ticket types, participant list
- Results change after use case execution

**SQL Implementation:**
- Uses JOINs and GROUP BY
- GROUP_CONCAT for participant list
- CASE statements for ticket/payment breakdowns

**NoSQL Implementation:**
- Uses MongoDB aggregation pipeline
- `$size` operator for counts
- `$filter` operator for conditional counts
- `$reduce` operator for string concatenation

---

**Last Updated:** January 2026
