const express = require('express');
const router = express.Router();

// Helper function to generate random data
const randomData = {
    firstNames: ['Anna', 'Michael', 'Sarah', 'David', 'Lisa', 'Thomas', 'Emma', 'Lukas', 'Sophie', 'Felix', 'Aziz', 'Lennard', 'Maria', 'Johannes', 'Laura', 'Nina', 'Max', 'Julia', 'Stefan', 'Laura'],
    lastNames: ['Mueller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Koch', 'Richter', 'Iftekher', 'Baur', 'Huber', 'Mayer', 'Gruber', 'Steiner'],
    domains: ['gmail.com', 'outlook.com', 'univie.ac.at', 'student.tuwien.ac.at', 'email.com'],
    tShirtSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    dietaryRestrictions: ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Halal', 'Kosher', null],
    expertiseAreas: ['Machine Learning', 'Web Development', 'Mobile Apps', 'Blockchain', 'IoT', 'Cloud Computing', 'Cybersecurity', 'Data Science'],
    organizations: ['TU Vienna', 'University of Vienna', 'Google', 'Microsoft', 'AWS', 'SAP', 'Siemens', 'Red Bull'],
    venueNames: ['Tech Hub Vienna', 'Innovation Center', 'Startup Campus', 'Digital Factory', 'Code Space'],
    venueAddresses: ['Mariahilfer Straße 123, 1060 Vienna', 'Karlsplatz 13, 1040 Vienna', 'Prater 45, 1020 Vienna', 'Donaustadt 78, 1220 Vienna'],
    facilities: ['WiFi, Projectors, Catering', 'WiFi, Whiteboard, Coffee', 'WiFi, Stage, Sound System', 'WiFi, Labs, Mentors'],
    eventTypes: ['Hackathon'],
    eventNames: ['AI Innovation Hackathon', 'Green Tech Challenge', 'Web Dev Summit', 'Blockchain Bootcamp', 'IoT Makers Fest', 'Cloud Computing Day'],
    industries: ['Technology', 'Finance', 'Healthcare', 'Education', 'Energy', 'Retail'],
    companyNames: ['TechCorp', 'InnovateTech', 'DataDriven', 'CloudFirst', 'AIVentures', 'GreenTech Solutions', 'Bitpanda', 'GoStudent'],
    projectNames: ['Smart Home IoT Platform', 'AI-Powered Chatbot', 'Blockchain Voting System', 'Healthcare Analytics Dashboard', 'EcoTrack App', 'E-Commerce Platform', 'Task Manager App', 'Weather Forecast API', 'Social Media Dashboard', 'Fitness Tracker'],
    techStacks: ['Python, Flask, PostgreSQL', 'React, Node.js, MongoDB', 'Solidity, Web3.js, React', 'HTML, CSS, Tailwind, JavaScript, ReactJS', 'Vue.js, Express, MySQL', 'Django, Redis, Docker'],
    ticketTypes: ['Early Bird', 'Regular', 'VIP', 'Student'],
    paymentStatuses: ['completed', 'pending']
};

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatDateTime(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Initialize database schema
async function initializeSchema(pool) {
    const conn = await pool.getConnection();
    try {
        // Drop tables in reverse order of dependencies
        const tables = ['Evaluates', 'Creates', 'Supports', 'Registration', 'Workshop', 'Submission', 'Sponsor', 'HackathonEvent', 'Venue', 'Judge', 'Participant', 'Person'];
        for (const table of tables) {
            await conn.query(`DROP TABLE IF EXISTS ${table}`);
        }

        // Create Person table (superclass in IS-A hierarchy)
        await conn.query(`
            CREATE TABLE Person (
                person_id INT PRIMARY KEY AUTO_INCREMENT,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                phone VARCHAR(50)
            )
        `);

        // Create Participant table
        await conn.query(`
            CREATE TABLE Participant (
                person_id INT PRIMARY KEY,
                registration_date DATE NOT NULL,
                t_shirt_size VARCHAR(10),
                dietary_restrictions VARCHAR(255),
                manager_id INT,
                FOREIGN KEY (person_id) REFERENCES Person(person_id) ON DELETE CASCADE,
                FOREIGN KEY (manager_id) REFERENCES Participant(person_id) ON DELETE SET NULL
            )
        `);

        // Create Judge table
        await conn.query(`
            CREATE TABLE Judge (
                person_id INT PRIMARY KEY,
                expertise_area VARCHAR(255),
                years_experience INT,
                organization VARCHAR(255),
                FOREIGN KEY (person_id) REFERENCES Person(person_id) ON DELETE CASCADE
            )
        `);

        // Create Venue table
        await conn.query(`
            CREATE TABLE Venue (
                venue_id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                address VARCHAR(500) NOT NULL,
                capacity INT NOT NULL,
                facilities TEXT
            )
        `);

        // Create HackathonEvent table
        await conn.query(`
            CREATE TABLE HackathonEvent (
                event_id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                event_type VARCHAR(100),
                max_participants INT,
                venue_id INT,
                FOREIGN KEY (venue_id) REFERENCES Venue(venue_id) ON DELETE SET NULL
            )
        `);

        // Create Sponsor table
        await conn.query(`
            CREATE TABLE Sponsor (
                sponsor_id INT PRIMARY KEY AUTO_INCREMENT,
                company_name VARCHAR(255) NOT NULL,
                industry VARCHAR(100),
                website VARCHAR(255),
                contribution_amount DECIMAL(12, 2)
            )
        `);

        // Create Submission table
        await conn.query(`
            CREATE TABLE Submission (
                submission_id INT PRIMARY KEY AUTO_INCREMENT,
                event_id INT,
                project_name VARCHAR(255) NOT NULL,
                description TEXT,
                submission_time DATETIME NOT NULL,
                technology_stack VARCHAR(500),
                repository_url VARCHAR(500),
                submission_type VARCHAR(50),
                FOREIGN KEY (event_id) REFERENCES HackathonEvent(event_id) ON DELETE CASCADE
            )
        `);

        // Create Workshop table
        await conn.query(`
            CREATE TABLE Workshop (
                workshop_number INT,
                event_id INT,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                duration INT,
                skill_level VARCHAR(50),
                max_attendees INT,
                PRIMARY KEY (workshop_number, event_id),
                FOREIGN KEY (event_id) REFERENCES HackathonEvent(event_id) ON DELETE CASCADE
            )
        `);

        // Create Registration table
        await conn.query(`
            CREATE TABLE Registration (
                person_id INT,
                event_id INT,
                registration_number VARCHAR(50) NOT NULL,
                registration_timestamp DATETIME NOT NULL,
                payment_status VARCHAR(50),
                ticket_type VARCHAR(50),
                PRIMARY KEY (person_id, event_id),
                FOREIGN KEY (person_id) REFERENCES Participant(person_id) ON DELETE CASCADE,
                FOREIGN KEY (event_id) REFERENCES HackathonEvent(event_id) ON DELETE CASCADE
            )
        `);

        // Create Supports table
        await conn.query(`
            CREATE TABLE Supports (
                sponsor_id INT,
                event_id INT,
                PRIMARY KEY (sponsor_id, event_id),
                FOREIGN KEY (sponsor_id) REFERENCES Sponsor(sponsor_id) ON DELETE CASCADE,
                FOREIGN KEY (event_id) REFERENCES HackathonEvent(event_id) ON DELETE CASCADE
            )
        `);

        // Create Creates table
        await conn.query(`
            CREATE TABLE Creates (
                person_id INT,
                submission_id INT,
                PRIMARY KEY (person_id, submission_id),
                FOREIGN KEY (person_id) REFERENCES Participant(person_id) ON DELETE CASCADE,
                FOREIGN KEY (submission_id) REFERENCES Submission(submission_id) ON DELETE CASCADE
            )
        `);

        // Create Evaluates table
        await conn.query(`
            CREATE TABLE Evaluates (
                person_id INT,
                submission_id INT,
                score DECIMAL(5, 2),
                feedback TEXT,
                PRIMARY KEY (person_id, submission_id),
                FOREIGN KEY (person_id) REFERENCES Judge(person_id) ON DELETE CASCADE,
                FOREIGN KEY (submission_id) REFERENCES Submission(submission_id) ON DELETE CASCADE
            )
        `);

        console.log('Database schema initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize schema:', error);
        throw error;
    } finally {
        conn.release();
    }
}

// Generate randomized data for MySQL
async function generateMySQLData(pool) {
    const conn = await pool.getConnection();
    
    try {
        // Initialize schema first
        await initializeSchema(pool);
        
        await conn.beginTransaction();

        // Clear existing data (in reverse order of dependencies)
        await conn.query('DELETE FROM Evaluates');
        await conn.query('DELETE FROM Creates');
        await conn.query('DELETE FROM Supports');
        await conn.query('DELETE FROM Registration');
        await conn.query('DELETE FROM Workshop');
        await conn.query('DELETE FROM Submission');
        await conn.query('DELETE FROM Sponsor');
        await conn.query('DELETE FROM HackathonEvent');
        await conn.query('DELETE FROM Venue');
        await conn.query('DELETE FROM Judge');
        await conn.query('DELETE FROM Participant');
        await conn.query('DELETE FROM Person');

        // Reset auto-increment
        await conn.query('ALTER TABLE Person AUTO_INCREMENT = 1');
        await conn.query('ALTER TABLE Venue AUTO_INCREMENT = 1');
        await conn.query('ALTER TABLE HackathonEvent AUTO_INCREMENT = 1');
        await conn.query('ALTER TABLE Sponsor AUTO_INCREMENT = 1');
        await conn.query('ALTER TABLE Submission AUTO_INCREMENT = 1');

        // ========================================
        // PERSON - Superclass (IS-A: total, overlapping)
        // Total: Every person must be Participant OR Judge (or both)
        // Overlapping: A person CAN be both (schema allows it)
        // For realistic data: Judges don't participate (disjoint in practice)
        // ========================================
        const persons = [];
        const numParticipants = 15;  // Persons 1-15 will be Participants
        const numJudges = 5;         // Persons 16-20 will be Judges
        const totalPersons = numParticipants + numJudges;  // 20 total
        
        for (let i = 0; i < totalPersons; i++) {
            const firstName = randomData.firstNames[i % randomData.firstNames.length];
            const lastName = randomData.lastNames[i % randomData.lastNames.length];
            const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${randomElement(randomData.domains)}`;
            const phone = `+43-${randomInt(660, 699)}-${randomInt(1000000, 9999999)}`;
            
            const [result] = await conn.query(
                'INSERT INTO Person (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)',
                [firstName, lastName, email, phone]
            );
            persons.push({ id: result.insertId, firstName, lastName, email });
        }

        // ========================================
        // PARTICIPANT (IS-A Person)
        // Attributes: person_id (PK/FK), registration_date, t_shirt_size, dietary_restrictions
        // Relationship: manages (1:M recursive) - manager_id references Participant
        // ========================================
        const participants = [];
        for (let i = 0; i < numParticipants; i++) {
            const regDate = randomDate(new Date('2025-01-01'), new Date('2025-10-01'));
            // manages relationship: first 3 participants have no manager, rest have one of the first 3 as manager
            const managerId = i > 2 ? participants[randomInt(0, 2)].id : null;
            
            await conn.query(
                'INSERT INTO Participant (person_id, registration_date, t_shirt_size, dietary_restrictions, manager_id) VALUES (?, ?, ?, ?, ?)',
                [persons[i].id, formatDate(regDate), randomElement(randomData.tShirtSizes), randomElement(randomData.dietaryRestrictions), managerId]
            );
            participants.push({ ...persons[i] });
        }

        // ========================================
        // JUDGE (IS-A Person)
        // Attributes: person_id (PK/FK), expertise_area, years_experience, organization
        // Disjoint from Participants in test data (realistic: judges don't compete)
        // ========================================
        const judges = [];
        for (let i = numParticipants; i < totalPersons; i++) {
            await conn.query(
                'INSERT INTO Judge (person_id, expertise_area, years_experience, organization) VALUES (?, ?, ?, ?)',
                [persons[i].id, randomElement(randomData.expertiseAreas), randomInt(3, 15), randomElement(randomData.organizations)]
            );
            judges.push({ ...persons[i] });
        }

        // ========================================
        // VENUE
        // Attributes: venue_id (PK), name, address, capacity, facilities
        // Relationship: hosts (1:M with HackathonEvent)
        // ========================================
        const venues = [];
        for (let i = 0; i < 5; i++) {
            const [result] = await conn.query(
                'INSERT INTO Venue (name, address, capacity, facilities) VALUES (?, ?, ?, ?)',
                [randomData.venueNames[i], randomData.venueAddresses[i % randomData.venueAddresses.length], randomInt(100, 300), randomElement(randomData.facilities)]
            );
            venues.push({ id: result.insertId, name: randomData.venueNames[i] });
        }

        // ========================================
        // HACKATHON EVENT - UPDATED TO CREATE FUTURE EVENTS
        // Attributes: event_id (PK), name, start_date, end_date, event_type, max_participants
        // Relationships: hosts (M:1 with Venue via venue_id FK)
        // ========================================
        const events = [];
        const today = new Date(); // Get current date
        
        for (let i = 0; i < 10; i++) {
            // Create events starting from today and extending into the future
            const startDate = new Date(today);
            startDate.setDate(today.getDate() + (i * 30)); // Events start at 0, 30, 60, 90 days from today
            
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + randomInt(2, 5)); // Event lasts 2-5 days
            
            const baseEventName = randomData.eventNames[i % randomData.eventNames.length];
            const eventName = i < randomData.eventNames.length ? baseEventName : `${baseEventName} ${i + 1}`;
            const [result] = await conn.query(
                'INSERT INTO HackathonEvent (name, start_date, end_date, event_type, max_participants, venue_id) VALUES (?, ?, ?, ?, ?, ?)',
                [eventName, formatDate(startDate), formatDate(endDate), 'Hackathon', randomInt(50, 150), venues[i % venues.length].id]
            );
            events.push({ id: result.insertId, name: eventName, startDate, endDate });
        }

        // ========================================
        // SPONSOR
        // Attributes: sponsor_id (PK), company_name, industry, website, contribution_amount
        // Relationship: supports (M:N with HackathonEvent)
        // ========================================
        const sponsors = [];
        for (let i = 0; i < 5; i++) {
            const [result] = await conn.query(
                'INSERT INTO Sponsor (company_name, industry, website, contribution_amount) VALUES (?, ?, ?, ?)',
                [randomData.companyNames[i], randomElement(randomData.industries), `https://www.${randomData.companyNames[i].toLowerCase().replace(' ', '')}.com`, randomInt(5000, 50000)]
            );
            sponsors.push({ id: result.insertId, name: randomData.companyNames[i] });
        }

        // ========================================
        // WORKSHOP (Weak Entity)
        // Partial Key: workshop_number
        // Owner: HackathonEvent (via event_id)
        // Attributes: title, description, duration, skill_level, max_attendees
        // Relationship: organizes (1:M with HackathonEvent)
        // ========================================
        let workshopCount = 0;
        for (let i = 0; i < events.length; i++) {
            const numWorkshops = randomInt(2, 3);
            for (let j = 1; j <= numWorkshops; j++) {
                await conn.query(
                    'INSERT INTO Workshop (workshop_number, event_id, title, description, duration, skill_level, max_attendees) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [j, events[i].id, `Workshop ${j}: ${randomElement(randomData.expertiseAreas)}`, 'Hands-on workshop session', randomInt(60, 180), randomElement(['Beginner', 'Intermediate', 'Advanced']), randomInt(20, 50)]
                );
                workshopCount++;
            }
        }

        // ========================================
        // REGISTRATION (Relationship with attributes)
        // Between: Participant and HackathonEvent (M:N)
        // Attributes: registration_number, registration_timestamp, payment_status, ticket_type
        // Composite PK: (person_id, event_id)
        // ========================================
        const registrations = [];
        for (let i = 0; i < participants.length; i++) {
            const numEvents = randomInt(1, 2);
            const registeredEvents = new Set();
            
            for (let j = 0; j < numEvents; j++) {
                let eventIdx;
                do {
                    eventIdx = randomInt(0, events.length - 1);
                } while (registeredEvents.has(eventIdx));
                registeredEvents.add(eventIdx);
                
                // Register before event starts
                const regTime = randomDate(new Date('2025-01-01'), events[eventIdx].startDate);
                await conn.query(
                    'INSERT INTO Registration (person_id, event_id, registration_number, registration_timestamp, payment_status, ticket_type) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        participants[i].id,
                        events[eventIdx].id,
                        `REG-${events[eventIdx].id}-${String(participants[i].id).padStart(3, '0')}`,
                        formatDateTime(regTime),
                        randomElement(randomData.paymentStatuses),
                        randomElement(randomData.ticketTypes)
                    ]
                );
                registrations.push({ participantId: participants[i].id, eventId: events[eventIdx].id });
            }
        }

        // ========================================
        // SUPPORTS (Relationship - M:N)
        // Between: Sponsor and HackathonEvent
        // No additional attributes
        // ========================================
        let supportsCount = 0;
        for (let i = 0; i < sponsors.length; i++) {
            const numEvents = randomInt(1, 2);
            const supportedEvents = new Set();
            
            for (let j = 0; j < numEvents; j++) {
                let eventIdx;
                do {
                    eventIdx = randomInt(0, events.length - 1);
                } while (supportedEvents.has(eventIdx));
                supportedEvents.add(eventIdx);
                
                await conn.query(
                    'INSERT INTO Supports (sponsor_id, event_id) VALUES (?, ?)',
                    [sponsors[i].id, events[eventIdx].id]
                );
                supportsCount++;
            }
        }

        // ========================================
        // SUBMISSION - UPDATED TO CREATE SUBMISSIONS WITHIN EVENT DATES
        // Attributes: submission_id (PK), project_name, description, submission_time, technology_stack, repository_url
        // Added for use case: event_id (FK), submission_type
        // Relationship: creates (M:N with Participant)
        // ========================================
        let submissions = [];
        for (let i = 0; i < 8; i++) {
            const eventIdx = i % events.length;
            const event = events[eventIdx];
            
            // Create submission time between event start and end
            const subTime = new Date(event.startDate);
            subTime.setHours(subTime.getHours() + randomInt(12, 48)); // 12-48 hours after event starts
            
            // Ensure submission time doesn't exceed event end date
            if (subTime > event.endDate) {
                subTime.setTime(event.endDate.getTime() - (3600000 * 2)); // 2 hours before event ends
            }
            
            const subType = randomInt(0, 1) === 0 ? 'individual' : 'team';
            
            const [result] = await conn.query(
                `INSERT INTO Submission (event_id, project_name, description, submission_time, technology_stack, repository_url, submission_type) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    event.id,
                    randomData.projectNames[i],
                    `An innovative project focusing on ${randomData.projectNames[i].toLowerCase()}`,
                    formatDateTime(subTime),
                    randomElement(randomData.techStacks),
                    `https://github.com/team${i + 1}/${randomData.projectNames[i].toLowerCase().replace(/ /g, '-')}`,
                    subType
                ]
            );
            submissions.push({ id: result.insertId, eventId: event.id, type: subType });
        }

        // ========================================
        // CREATES (Relationship - M:N)
        // Between: Participant and Submission
        // Constraint: Participants must be registered for the submission's event
        // ========================================
        let createsCount = 0;
        const validSubmissions = [];
        for (let i = 0; i < submissions.length; i++) {
            const submission = submissions[i];
            
            // Get participants registered for this submission's event
            const [registeredForEvent] = await conn.query(
                'SELECT person_id FROM Registration WHERE event_id = ?',
                [submission.eventId]
            );
            
            if (registeredForEvent.length === 0) {
                await conn.query('DELETE FROM Submission WHERE submission_id = ?', [submission.id]);
                continue;
            }
            
            const registeredIds = registeredForEvent.map(r => r.person_id);
            let finalType = submission.type;
            if (finalType === 'team' && registeredIds.length < 2) {
                finalType = 'individual';
                await conn.query(
                    'UPDATE Submission SET submission_type = ? WHERE submission_id = ?',
                    [finalType, submission.id]
                );
            }
            
            const minMembers = finalType === 'team' ? 2 : 1;
            const maxMembers = finalType === 'team' ? Math.min(3, registeredIds.length) : 1;
            const numMembers = finalType === 'team' ? randomInt(minMembers, maxMembers) : 1;
            const usedParticipants = new Set();
            let createdMembers = 0;
            
            for (let j = 0; j < numMembers; j++) {
                let participantId;
                let attempts = 0;
                do {
                    participantId = registeredIds[randomInt(0, registeredIds.length - 1)];
                    attempts++;
                } while (usedParticipants.has(participantId) && attempts < 20);
                
                if (!usedParticipants.has(participantId)) {
                    usedParticipants.add(participantId);
                    await conn.query(
                        'INSERT INTO Creates (person_id, submission_id) VALUES (?, ?)',
                        [participantId, submission.id]
                    );
                    createsCount++;
                    createdMembers++;
                }
            }
            
            if (createdMembers > 0) {
                validSubmissions.push({ ...submission, type: finalType });
            } else {
                await conn.query('DELETE FROM Submission WHERE submission_id = ?', [submission.id]);
            }
        }
        submissions = validSubmissions;

        // ========================================
        // EVALUATES (Relationship - M:N with attributes)
        // Between: Judge and Submission
        // Attributes: score, feedback
        // ========================================
        let evaluatesCount = 0;
        for (let i = 0; i < judges.length; i++) {
            const numEvals = randomInt(2, 4);
            const evaluatedSubmissions = new Set();
            
            for (let j = 0; j < numEvals; j++) {
                let subIdx;
                let attempts = 0;
                do {
                    subIdx = randomInt(0, submissions.length - 1);
                    attempts++;
                } while (evaluatedSubmissions.has(subIdx) && attempts < 20);
                
                if (!evaluatedSubmissions.has(subIdx)) {
                    evaluatedSubmissions.add(subIdx);
                    await conn.query(
                        'INSERT INTO Evaluates (person_id, submission_id, score, feedback) VALUES (?, ?, ?, ?)',
                        [
                            judges[i].id,
                            submissions[subIdx].id,
                            (randomInt(60, 100) / 10).toFixed(1),
                            randomElement(['Excellent work!', 'Good implementation', 'Needs improvement', 'Very innovative', 'Solid technical foundation'])
                        ]
                    );
                    evaluatesCount++;
                }
            }
        }

        await conn.commit();
        
        return {
            Person: persons.length,
            Participant: participants.length,
            Judge: judges.length,
            Venue: venues.length,
            HackathonEvent: events.length,
            Sponsor: sponsors.length,
            Workshop: workshopCount,
            Submission: submissions.length,
            Registration: registrations.length,
            Creates: createsCount,
            Evaluates: evaluatesCount,
            Supports: supportsCount
        };
        
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// POST /api/data/import - Import randomized data to MySQL
router.post('/import', async (req, res) => {
    try {
        const stats = await generateMySQLData(req.mysqlPool);
        res.json({
            success: true,
            message: 'Data imported successfully to MySQL',
            stats
        });
    } catch (error) {
        console.error('Data import error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/data/stats - Get current data statistics
router.get('/stats', async (req, res) => {
    try {
        const tables = ['Person', 'Participant', 'Judge', 'Venue', 'HackathonEvent', 'Sponsor', 'Workshop', 'Submission', 'Registration', 'Creates', 'Evaluates', 'Supports'];
        const stats = {};
        
        for (const table of tables) {
            const [rows] = await req.mysqlPool.query(`SELECT COUNT(*) as count FROM ${table}`);
            stats[table] = rows[0].count;
        }
        
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
