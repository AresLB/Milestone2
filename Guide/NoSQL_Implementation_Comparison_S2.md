# 2.3.3 NoSQL Use Case and Analytics Report - Summary and Comparison

**Student 2: Lennard Baur (12018378)**

## Summary of NoSQL Implementation

### Use Case: Manage Workshops (NoSQL)

The Workshop use case has been implemented using MongoDB with the following approach:

**Data Structure:**
Workshops are embedded as an array within the `events` collection. Each event document contains a `workshops` array with workshop objects:

```json
{
  "_id": 1,
  "name": "AI Hackathon 2025",
  "venue": {
    "venue_id": 1,
    "name": "Tech Hub Vienna",
    "address": "...",
    "capacity": 500
  },
  "workshops": [
    {
      "workshop_number": 1,
      "title": "Introduction to Machine Learning",
      "description": "...",
      "duration": 90,
      "skill_level": "Beginner",
      "max_attendees": 30
    }
  ]
}
```

**CRUD Operations:**

| Operation | SQL Implementation | NoSQL Implementation |
|-----------|-------------------|---------------------|
| **Create** | `INSERT INTO Workshop (...)` | `$push` to `events.workshops` array |
| **Read** | `SELECT ... FROM Workshop JOIN HackathonEvent JOIN Venue` | `$unwind` and `$project` aggregation pipeline |
| **Update** | `UPDATE Workshop SET ... WHERE event_id=? AND workshop_number=?` | `$set` with positional operator `workshops.$` |
| **Delete** | `DELETE FROM Workshop WHERE ...` | `$pull` from `workshops` array |

### Analytics Report: Workshop Statistics (NoSQL)

The analytics report uses MongoDB's aggregation framework to replicate the SQL query functionality:

**MongoDB Aggregation Pipeline:**
```javascript
[
  { $unwind: { path: '$workshops', preserveNullAndEmptyArrays: false } },
  { $match: { 'workshops.skill_level': filterSkillLevel } },  // Optional filter
  { $project: {
      workshop_number: '$workshops.workshop_number',
      workshop_title: '$workshops.title',
      skill_level: '$workshops.skill_level',
      duration: '$workshops.duration',
      event_name: '$name',
      venue_name: '$venue.name',
      venue_capacity: '$venue.capacity'
      // ... additional fields
  }},
  { $sort: { start_date: 1, workshop_number: 1 } }
]
```

---

## Comparison: SQL vs NoSQL Results

### Functional Equivalence

Both implementations produce **identical results** for the user:

| Aspect | SQL (MariaDB) | NoSQL (MongoDB) |
|--------|---------------|-----------------|
| Workshop list display | Same data, same columns | Same data, same columns |
| Filter by skill_level | Works correctly | Works correctly |
| Summary statistics | Calculated in backend | Calculated in backend |
| CRUD operations | Full support | Full support |

### Key Differences in Implementation

#### 1. Data Access Pattern

**SQL:**
- Requires **3 JOINs** to get complete workshop data:
  ```sql
  SELECT ... FROM Workshop w
  INNER JOIN HackathonEvent e ON w.event_id = e.event_id
  LEFT JOIN Venue v ON e.venue_id = v.venue_id
  ```

**NoSQL:**
- Single collection access with **embedded data**
- No joins needed - venue and event data are already embedded
- Uses `$unwind` to flatten the workshops array

#### 2. Write Operations

**SQL:**
- Workshop creation: Single `INSERT` statement
- Workshop number managed by application logic (MAX + 1)

**NoSQL:**
- Workshop creation: `$push` to update parent event document
- Workshop number calculated from existing array length
- Atomic update within single document

#### 3. Data Consistency

**SQL:**
- Referential integrity enforced by foreign keys
- Workshop cannot exist without valid event_id

**NoSQL:**
- Workshop is physically embedded in event document
- Existence dependency enforced by document structure itself
- Deleting an event automatically removes all its workshops

#### 4. Query Performance Characteristics

**SQL:**
- Filter on `skill_level` requires index on Workshop table
- JOINs have computational overhead

**NoSQL:**
- `$unwind` operation processes embedded array
- Filtering happens after unwinding
- All related data retrieved in single document fetch

### Report Output Comparison

Both implementations return the same report structure:

```json
{
  "success": true,
  "filter": { "skillLevel": "Beginner" },
  "summary": {
    "totalWorkshops": 15,
    "uniqueEvents": 5,
    "averageDuration": 75,
    "skillDistribution": {
      "Beginner": 6,
      "Intermediate": 5,
      "Advanced": 4
    }
  },
  "data": [
    {
      "workshop_number": 1,
      "workshop_title": "Intro to ML",
      "event_name": "AI Hackathon",
      "skill_level": "Beginner",
      "duration": 90,
      "venue_name": "Tech Hub",
      "venue_capacity": 500
    }
    // ... more workshops
  ]
}
```

### Advantages of Each Approach

| SQL Advantages | NoSQL Advantages |
|----------------|------------------|
| Strong referential integrity | No JOINs needed for related data |
| Mature query optimization | Single document contains all data |
| ACID transactions across tables | Atomic operations on embedded arrays |
| Flexible ad-hoc queries | Better read performance for use case |

### Conclusion

The NoSQL implementation successfully replicates all functionality from the SQL version (Task 2.2.2). Both approaches:

1. Support full CRUD operations on workshops
2. Generate identical analytics reports
3. Properly handle the weak entity relationship (workshop depends on event)
4. Filter workshops by skill level

The key architectural difference is that NoSQL **embeds** workshops within events (denormalization), while SQL uses **separate tables with foreign keys** (normalization). This design decision aligns with MongoDB's "Five Rules of Thumb" - specifically favoring embedding for data that is always accessed together with its parent entity.
