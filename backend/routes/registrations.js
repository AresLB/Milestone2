const express = require('express');
const router = express.Router();

// GET /api/registrations - Get all registrations
router.get('/', async (req, res) => {
    try {
        const [registrations] = await req.mysqlPool.query(`
            SELECT 
                r.*,
                p.first_name,
                p.last_name,
                p.email,
                e.name as event_name,
                e.start_date,
                e.end_date,
                e.event_type
            FROM Registration r
            JOIN Person p ON r.person_id = p.person_id
            JOIN HackathonEvent e ON r.event_id = e.event_id
            ORDER BY r.registration_timestamp DESC
        `);
        
        res.json({ success: true, data: registrations });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/registrations/events - Get available events for registration
router.get('/events', async (req, res) => {
    try {
        const [events] = await req.mysqlPool.query(`
            SELECT 
                e.*,
                v.name as venue_name,
                v.address as venue_address,
                (SELECT COUNT(*) FROM Registration r WHERE r.event_id = e.event_id) as current_registrations
            FROM HackathonEvent e
            LEFT JOIN Venue v ON e.venue_id = v.venue_id
            ORDER BY e.start_date
        `);
        
        res.json({ success: true, data: events });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/registrations/available-participants/:eventId - Get participants not yet registered for an event
router.get('/available-participants/:eventId', async (req, res) => {
    try {
        const [participants] = await req.mysqlPool.query(`
            SELECT 
                p.person_id,
                pe.first_name,
                pe.last_name,
                pe.email
            FROM Participant p
            JOIN Person pe ON p.person_id = pe.person_id
            WHERE p.person_id NOT IN (
                SELECT person_id FROM Registration WHERE event_id = ?
            )
            ORDER BY pe.last_name, pe.first_name
        `, [req.params.eventId]);
        
        res.json({ success: true, data: participants });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/registrations - Register participant for event (Student 2's Use Case)
router.post('/', async (req, res) => {
    try {
        const { person_id, event_id, ticket_type } = req.body;
        
        if (!person_id || !event_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Participant and event are required' 
            });
        }
        
        // Check if already registered
        const [existing] = await req.mysqlPool.query(
            'SELECT * FROM Registration WHERE person_id = ? AND event_id = ?',
            [person_id, event_id]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Participant is already registered for this event' 
            });
        }
        
        // Check event capacity
        const [event] = await req.mysqlPool.query(
            'SELECT max_participants, (SELECT COUNT(*) FROM Registration WHERE event_id = ?) as current FROM HackathonEvent WHERE event_id = ?',
            [event_id, event_id]
        );
        
        if (event.length > 0 && event[0].current >= event[0].max_participants) {
            return res.status(400).json({ 
                success: false, 
                error: 'Event has reached maximum capacity' 
            });
        }
        
        // Generate registration number
        const [countResult] = await req.mysqlPool.query('SELECT COUNT(*) as count FROM Registration');
        const regNumber = `REG-2025-${String(countResult[0].count + 1).padStart(3, '0')}`;
        
        // Create registration
        const registration_timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        await req.mysqlPool.query(
            'INSERT INTO Registration (person_id, event_id, registration_number, registration_timestamp, payment_status, ticket_type) VALUES (?, ?, ?, ?, ?, ?)',
            [person_id, event_id, regNumber, registration_timestamp, 'pending', ticket_type || 'Regular']
        );
        
        res.status(201).json({ 
            success: true, 
            message: 'Registration successful',
            registration_number: regNumber
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/registrations/:personId/:eventId - Cancel registration
router.delete('/:personId/:eventId', async (req, res) => {
    try {
        const [result] = await req.mysqlPool.query(
            'DELETE FROM Registration WHERE person_id = ? AND event_id = ?',
            [req.params.personId, req.params.eventId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Registration not found' });
        }
        
        res.json({ success: true, message: 'Registration cancelled successfully' });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
