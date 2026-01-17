const express = require('express');
const router = express.Router();

// Helper function to generate random data
const randomData = {
    firstNames: ['Anna', 'Michael', 'Sarah', 'David', 'Lisa', 'Thomas', 'Emma', 'Lukas', 'Sophie', 'Felix', 'Aziz', 'Lennard', 'Maria', 'Johannes', 'Laura'],
    lastNames: ['Mueller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Koch', 'Richter', 'Iftekher', 'Baur', 'Huber', 'Mayer'],
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
    projectNames: ['Smart Home IoT Platform', 'AI-Powered Chatbot', 'Blockchain Voting System', 'Healthcare Analytics Dashboard', 'Landing Page Design', 'E-Commerce Platform', 'Task Manager App', 'Weather Forecast API'],
    techStacks: ['Python, Flask, PostgreSQL', 'React, Node.js, MongoDB', 'Solidity, Web3.js, React', 'HTML, CSS, Tailwind, JavaScript, ReactJS', 'Vue.js, Express, MySQL', 'Django, Redis, Docker'],
    ticketTypes: ['Early Bird', 'Regular', 'VIP', 'Student'],
    paymentStatuses: ['completed', 'pending', 'cancelled']
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

// Generate randomized data for MySQL
async function generateMySQLData(pool) {
    const conn = await pool.getConnection();
    
    try {
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

        // Generate Persons (15 people - some will be participants, some judges, some both)
        const persons = [];
        for (let i = 0; i < 25; i++) {
            const firstName = randomElement(randomData.firstNames);
            const lastName = randomElement(randomData.lastNames);
            const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${randomElement(randomData.domains)}`;
            const phone = `+43-${randomInt(660, 699)}-${randomInt(1000000, 9999999)}`;
            
            const [result] = await conn.query(
                'INSERT INTO Person (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)',
                [firstName, lastName, email, phone]
            );
            persons.push({ id: result.insertId, firstName, lastName, email });
        }

        // Generate Participants (first 20 persons become participants)
        const participants = [];
        for (let i = 0; i < 20; i++) {
            const regDate = randomDate(new Date('2025-01-01'), new Date('2025-11-01'));
            const managerId = i > 2 ? participants[randomInt(0, Math.min(i-1, 2))].id : null;
            
            await conn.query(
                'INSERT INTO Participant (person_id, registration_date, t_shirt_size, dietary_restrictions, manager_id) VALUES (?, ?, ?, ?, ?)',
                [persons[i].id, formatDate(regDate), randomElement(randomData.tShirtSizes), randomElement(randomData.dietaryRestrictions), managerId]
            );
            participants.push({ ...persons[i] });
        }

        // Generate Judges (persons 20-24 become judges - disjoint from participants)
        const judges = [];
        for (let i = 20; i < 25; i++) {
            await conn.query(
                'INSERT INTO Judge (person_id, expertise_area, years_experience, organization) VALUES (?, ?, ?, ?)',
                [persons[i].id, randomElement(randomData.expertiseAreas), randomInt(2, 20), randomElement(randomData.organizations)]
            );
            judges.push({ ...persons[i] });
        }

        // Generate Venues (5 venues)
        const venues = [];
        for (let i = 0; i < 5; i++) {
            const [result] = await conn.query(
                'INSERT INTO Venue (name, address, capacity, facilities) VALUES (?, ?, ?, ?)',
                [randomData.venueNames[i], randomData.venueAddresses[i % randomData.venueAddresses.length], randomInt(50, 500), randomElement(randomData.facilities)]
            );
            venues.push({ id: result.insertId });
        }

        // Generate HackathonEvents (10 events)
        const events = [];
        for (let i = 0; i < 10; i++) {
            const startDate = randomDate(new Date('2025-01-15'), new Date('2026-01-20'));
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + randomInt(1, 3));
            
            const [result] = await conn.query(
                'INSERT INTO HackathonEvent (name, start_date, end_date, event_type, max_participants, venue_id) VALUES (?, ?, ?, ?, ?, ?)',
                [randomElement(randomData.eventNames), formatDate(startDate), formatDate(endDate), randomElement(randomData.eventTypes), randomInt(50, 200), venues[i % venues.length].id]
            );
            events.push({ id: result.insertId, startDate, endDate });
        }

        // Generate Sponsors (3 sponsors)
        const sponsors = [];
        for (let i = 0; i < 5; i++) {
            const [result] = await conn.query(
                'INSERT INTO Sponsor (company_name, industry, website, contribution_amount) VALUES (?, ?, ?, ?)',
                [randomData.companyNames[i], randomElement(randomData.industries), `https://www.${randomData.companyNames[i].toLowerCase().replace(' ', '')}.com`, randomInt(5000, 50000)]
            );
            sponsors.push({ id: result.insertId });
        }

        // Generate Submissions (7 submissions)
        const submissions = [];
        for (let i = 0; i < 7; i++) {
            const subTime = randomDate(new Date('2025-10-08'), new Date('2025-11-15'));
            const [result] = await conn.query(
                'INSERT INTO Submission (project_name, description, submission_time, technology_stack, repository_url) VALUES (?, ?, ?, ?, ?)',
                [
                    randomData.projectNames[i],
                    `A innovative project focusing on ${randomData.projectNames[i].toLowerCase()}`,
                    formatDateTime(subTime),
                    randomElement(randomData.techStacks),
                    `https://github.com/team${i + 1}/${randomData.projectNames[i].toLowerCase().replace(/ /g, '-')}`
                ]
            );
            submissions.push({ id: result.insertId, time: subTime });
        }

        // Generate Workshops (2-3 per event)
        for (let i = 0; i < events.length; i++) {
            const numWorkshops = randomInt(2, 3);
            for (let j = 1; j <= numWorkshops; j++) {
                await conn.query(
                    'INSERT INTO Workshop (workshop_number, event_id, title, description, duration, skill_level, max_attendees) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [j, events[i].id, `Workshop ${j}: ${randomElement(randomData.expertiseAreas)}`, 'Hands-on workshop session', randomInt(60, 180), randomElement(['Beginner', 'Intermediate', 'Advanced']), randomInt(20, 50)]
                );
            }
        }

        // Generate Registrations (each participant registers for 1-2 events)
        for (let i = 0; i < participants.length; i++) {
            const numEvents = randomInt(1, 2);
            const registeredEvents = new Set();
            
            for (let j = 0; j < numEvents; j++) {
                let eventIdx;
                do {
                    eventIdx = randomInt(0, events.length - 1);
                } while (registeredEvents.has(eventIdx));
                registeredEvents.add(eventIdx);
                
                const regTime = randomDate(new Date('2025-01-20'), events[eventIdx].startDate);
                await conn.query(
                    'INSERT INTO Registration (person_id, event_id, registration_number, registration_timestamp, payment_status, ticket_type) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        participants[i].id,
                        events[eventIdx].id,
                        `REG-2025-${String(i * 10 + j + 1).padStart(3, '0')}`,
                        formatDateTime(regTime),
                        randomElement(randomData.paymentStatuses),
                        randomElement(randomData.ticketTypes)
                    ]
                );
            }
        }

        // Generate Supports (each sponsor supports 1-2 events)
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
            }
        }

        // Generate Creates (link participants to submissions - 1-3 participants per submission for team projects)
        for (let i = 0; i < submissions.length; i++) {
            const numMembers = randomInt(1, 3);
            const usedParticipants = new Set();
            
            for (let j = 0; j < numMembers; j++) {
                let participantIdx;
                do {
                    participantIdx = randomInt(0, participants.length - 1);
                } while (usedParticipants.has(participantIdx));
                usedParticipants.add(participantIdx);
                
                await conn.query(
                    'INSERT INTO Creates (person_id, submission_id) VALUES (?, ?)',
                    [participants[participantIdx].id, submissions[i].id]
                );
            }
        }

        // Generate Evaluates (each judge evaluates 2-4 submissions)
        for (let i = 0; i < judges.length; i++) {
            const numEvals = randomInt(2, 4);
            const evaluatedSubmissions = new Set();
            
            for (let j = 0; j < numEvals; j++) {
                let subIdx;
                do {
                    subIdx = randomInt(0, submissions.length - 1);
                } while (evaluatedSubmissions.has(subIdx));
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
            }
        }

        await conn.commit();
        
        return {
            persons: persons.length,
            participants: participants.length,
            judges: judges.length,
            venues: venues.length,
            events: events.length,
            sponsors: sponsors.length,
            submissions: submissions.length
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
        const tables = ['Person', 'Participant', 'Judge', 'Venue', 'HackathonEvent', 'Sponsor', 'Submission', 'Registration', 'Creates', 'Evaluates'];
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
