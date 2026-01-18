const express = require('express');
const router = express.Router();

// ========================================
// IMPORTANT: Specific routes MUST come BEFORE dynamic routes (/:id)
// Otherwise Express will treat "events" or "participants" as an ID
// ========================================

// GET /api/submissions/events/available - Get available events for submission
router.get('/events/available', async (req, res) => {
    try {
        const [events] = await req.mysqlPool.query(`
            SELECT 
                e.event_id,
                e.name,
                e.event_type,
                e.start_date,
                e.end_date,
                e.max_participants,
                v.name as venue_name,
                COUNT(DISTINCT s.submission_id) as submission_count,
                COUNT(DISTINCT r.person_id) as registration_count
            FROM HackathonEvent e
            LEFT JOIN Venue v ON e.venue_id = v.venue_id
            LEFT JOIN Submission s ON e.event_id = s.event_id
            LEFT JOIN Registration r ON e.event_id = r.event_id
            WHERE e.end_date >= CURDATE()
            GROUP BY e.event_id, e.name, e.event_type, e.start_date, e.end_date, e.max_participants, v.name
            ORDER BY e.start_date ASC
        `);
        
        res.json({ success: true, data: events });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/submissions/participants/:eventId - Get participants registered for specific event
router.get('/participants/:eventId', async (req, res) => {
    try {
        const eventId = req.params.eventId;
        
        // Validate event exists
        const [eventCheck] = await req.mysqlPool.query(
            'SELECT event_id FROM HackathonEvent WHERE event_id = ?',
            [eventId]
        );
        
        if (eventCheck.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Event not found' 
            });
        }
        
        // Get participants registered for this event
        const [participants] = await req.mysqlPool.query(`
            SELECT DISTINCT
                p.person_id,
                pe.first_name,
                pe.last_name,
                pe.email,
                p.registration_date,
                r.registration_number,
                r.ticket_type
            FROM Participant p
            JOIN Person pe ON p.person_id = pe.person_id
            JOIN Registration r ON p.person_id = r.person_id
            WHERE r.event_id = ?
            ORDER BY pe.last_name, pe.first_name
        `, [eventId]);
        
        res.json({ success: true, data: participants });
    } catch (error) {
        console.error('Error fetching participants:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/submissions/participants - Get all participants (backward compatibility)
router.get('/participants', async (req, res) => {
    try {
        const [participants] = await req.mysqlPool.query(`
            SELECT 
                p.person_id,
                pe.first_name,
                pe.last_name,
                pe.email,
                p.registration_date
            FROM Participant p
            JOIN Person pe ON p.person_id = pe.person_id
            ORDER BY pe.last_name, pe.first_name
        `);
        
        res.json({ success: true, data: participants });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/submissions - Get all submissions with participant info
router.get('/', async (req, res) => {
    try {
        const [submissions] = await req.mysqlPool.query(`
            SELECT 
                s.submission_id,
                s.event_id,
                s.project_name,
                s.description,
                s.submission_time,
                s.technology_stack,
                s.repository_url,
                s.submission_type,
                e.name as event_name,
                GROUP_CONCAT(DISTINCT CONCAT(p.first_name, ' ', p.last_name) SEPARATOR ', ') as team_members
            FROM Submission s
            LEFT JOIN Creates c ON s.submission_id = c.submission_id
            LEFT JOIN Person p ON c.person_id = p.person_id
            LEFT JOIN HackathonEvent e ON s.event_id = e.event_id
            GROUP BY s.submission_id
            ORDER BY s.submission_time DESC
        `);
        
        res.json({ success: true, data: submissions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/submissions/:id - Get single submission details
router.get('/:id', async (req, res) => {
    try {
        const [submissions] = await req.mysqlPool.query(`
            SELECT 
                s.*,
                e.name as event_name,
                e.start_date,
                e.end_date,
                GROUP_CONCAT(DISTINCT c.person_id) as team_member_ids,
                GROUP_CONCAT(DISTINCT CONCAT(p.first_name, ' ', p.last_name) SEPARATOR ', ') as team_members
            FROM Submission s
            LEFT JOIN HackathonEvent e ON s.event_id = e.event_id
            LEFT JOIN Creates c ON s.submission_id = c.submission_id
            LEFT JOIN Person p ON c.person_id = p.person_id
            WHERE s.submission_id = ?
            GROUP BY s.submission_id
        `, [req.params.id]);
        
        if (submissions.length === 0) {
            return res.status(404).json({ success: false, error: 'Submission not found' });
        }
        
        res.json({ success: true, data: submissions[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/submissions - Create new submission (Student 1's Use Case - Enhanced)
router.post('/', async (req, res) => {
    const conn = await req.mysqlPool.getConnection();
    
    try {
        const { 
            event_id, 
            project_name, 
            description, 
            technology_stack, 
            repository_url, 
            team_member_ids,
            submission_type 
        } = req.body;
        
        // ========================================
        // VALIDATION STEP 1: Required Fields
        // ========================================
        if (!project_name || !team_member_ids || team_member_ids.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Project name and at least one team member are required' 
            });
        }
        
        // ========================================
        // VALIDATION STEP 2: Event Selection
        // ========================================
        if (!event_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Event selection is required' 
            });
        }
        
        // ========================================
        // VALIDATION STEP 3: Event Exists and is Active
        // ========================================
        const [eventCheck] = await conn.query(
            'SELECT event_id, name, end_date FROM HackathonEvent WHERE event_id = ?',
            [event_id]
        );
        
        if (eventCheck.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Selected event does not exist' 
            });
        }
        
        // Check if event submission period is still open
        const eventEndDate = new Date(eventCheck[0].end_date);
        const currentDate = new Date();
        
        if (currentDate > eventEndDate) {
            return res.status(400).json({ 
                success: false, 
                error: `Submission period for "${eventCheck[0].name}" has closed` 
            });
        }
        
        // ========================================
        // VALIDATION STEP 4: Team Members are Registered for Event
        // ========================================
        const [registeredCheck] = await conn.query(
            'SELECT person_id FROM Registration WHERE event_id = ? AND person_id IN (?)',
            [event_id, team_member_ids]
        );
        
        if (registeredCheck.length !== team_member_ids.length) {
            // Find which team members are not registered
            const registeredIds = registeredCheck.map(r => r.person_id);
            const unregisteredIds = team_member_ids.filter(id => !registeredIds.includes(id));
            
            // Get names of unregistered participants
            const [unregisteredNames] = await conn.query(
                'SELECT CONCAT(first_name, " ", last_name) as name FROM Person WHERE person_id IN (?)',
                [unregisteredIds]
            );
            
            const names = unregisteredNames.map(p => p.name).join(', ');
            
            return res.status(400).json({ 
                success: false, 
                error: `All team members must be registered for the selected event. Not registered: ${names}` 
            });
        }
        
        // ========================================
        // VALIDATION STEP 5: Submission Type Consistency
        // ========================================
        const determinedType = team_member_ids.length === 1 ? 'individual' : 'team';
        const finalSubmissionType = submission_type || determinedType;
        
        if (finalSubmissionType === 'individual' && team_member_ids.length !== 1) {
            return res.status(400).json({ 
                success: false, 
                error: 'Individual submissions must have exactly one team member' 
            });
        }
        
        if (finalSubmissionType === 'team' && team_member_ids.length < 2) {
            return res.status(400).json({ 
                success: false, 
                error: 'Team submissions must have at least two members' 
            });
        }
        
        // ========================================
        // DATABASE TRANSACTION: Create Submission
        // ========================================
        await conn.beginTransaction();
        
        // Create submission record
        const submission_time = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const [result] = await conn.query(
            `INSERT INTO Submission 
            (event_id, project_name, description, submission_time, technology_stack, repository_url, submission_type) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                event_id,
                project_name, 
                description || '', 
                submission_time, 
                technology_stack || '', 
                repository_url || '',
                finalSubmissionType
            ]
        );
        
        const submission_id = result.insertId;
        
        // Create relationship records in Creates table (M:N relationship)
        for (const person_id of team_member_ids) {
            await conn.query(
                'INSERT INTO Creates (person_id, submission_id) VALUES (?, ?)',
                [person_id, submission_id]
            );
        }
        
        await conn.commit();
        
        // ========================================
        // RESPONSE: Fetch Created Submission with Details
        // ========================================
        const [newSubmission] = await req.mysqlPool.query(`
            SELECT 
                s.*,
                e.name as event_name,
                GROUP_CONCAT(DISTINCT CONCAT(p.first_name, ' ', p.last_name) SEPARATOR ', ') as team_members,
                GROUP_CONCAT(DISTINCT c.person_id) as team_member_ids
            FROM Submission s
            LEFT JOIN HackathonEvent e ON s.event_id = e.event_id
            LEFT JOIN Creates c ON s.submission_id = c.submission_id
            LEFT JOIN Person p ON c.person_id = p.person_id
            WHERE s.submission_id = ?
            GROUP BY s.submission_id
        `, [submission_id]);
        
        res.status(201).json({ 
            success: true, 
            message: `Project submitted successfully to ${eventCheck[0].name}!`,
            data: newSubmission[0]
        });
        
    } catch (error) {
        await conn.rollback();
        console.error('Submission error:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        conn.release();
    }
});

// PUT /api/submissions/:id - Update submission
router.put('/:id', async (req, res) => {
    const conn = await req.mysqlPool.getConnection();
    
    try {
        const submissionId = parseInt(req.params.id, 10);
        const { 
            event_id, 
            project_name, 
            description, 
            technology_stack, 
            repository_url, 
            team_member_ids,
            submission_type 
        } = req.body;
        
        if (!submissionId) {
            return res.status(400).json({ success: false, error: 'Invalid submission ID' });
        }
        
        if (!project_name || !team_member_ids || team_member_ids.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Project name and at least one team member are required' 
            });
        }
        
        if (!event_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Event selection is required' 
            });
        }
        
        const [existing] = await conn.query(
            'SELECT submission_id FROM Submission WHERE submission_id = ?',
            [submissionId]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Submission not found' });
        }
        
        const [eventCheck] = await conn.query(
            'SELECT event_id, name, end_date FROM HackathonEvent WHERE event_id = ?',
            [event_id]
        );
        
        if (eventCheck.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Selected event does not exist' 
            });
        }
        
        const eventEndDate = new Date(eventCheck[0].end_date);
        const currentDate = new Date();
        
        if (currentDate > eventEndDate) {
            return res.status(400).json({ 
                success: false, 
                error: `Submission period for "${eventCheck[0].name}" has closed` 
            });
        }
        
        const [registeredCheck] = await conn.query(
            'SELECT person_id FROM Registration WHERE event_id = ? AND person_id IN (?)',
            [event_id, team_member_ids]
        );
        
        if (registeredCheck.length !== team_member_ids.length) {
            const registeredIds = registeredCheck.map(r => r.person_id);
            const unregisteredIds = team_member_ids.filter(id => !registeredIds.includes(id));
            
            const [unregisteredNames] = await conn.query(
                'SELECT CONCAT(first_name, " ", last_name) as name FROM Person WHERE person_id IN (?)',
                [unregisteredIds]
            );
            
            const names = unregisteredNames.map(p => p.name).join(', ');
            
            return res.status(400).json({ 
                success: false, 
                error: `All team members must be registered for the selected event. Not registered: ${names}` 
            });
        }
        
        const determinedType = team_member_ids.length === 1 ? 'individual' : 'team';
        const finalSubmissionType = submission_type || determinedType;
        
        if (finalSubmissionType === 'individual' && team_member_ids.length !== 1) {
            return res.status(400).json({ 
                success: false, 
                error: 'Individual submissions must have exactly one team member' 
            });
        }
        
        if (finalSubmissionType === 'team' && team_member_ids.length < 2) {
            return res.status(400).json({ 
                success: false, 
                error: 'Team submissions must have at least two members' 
            });
        }
        
        await conn.beginTransaction();
        
        await conn.query(
            `UPDATE Submission
             SET event_id = ?, project_name = ?, description = ?, technology_stack = ?, repository_url = ?, submission_type = ?
             WHERE submission_id = ?`,
            [
                event_id,
                project_name,
                description || '',
                technology_stack || '',
                repository_url || '',
                finalSubmissionType,
                submissionId
            ]
        );
        
        await conn.query('DELETE FROM Creates WHERE submission_id = ?', [submissionId]);
        
        for (const person_id of team_member_ids) {
            await conn.query(
                'INSERT INTO Creates (person_id, submission_id) VALUES (?, ?)',
                [person_id, submissionId]
            );
        }
        
        await conn.commit();
        
        const [updatedSubmission] = await req.mysqlPool.query(`
            SELECT 
                s.*,
                e.name as event_name,
                GROUP_CONCAT(DISTINCT CONCAT(p.first_name, ' ', p.last_name) SEPARATOR ', ') as team_members,
                GROUP_CONCAT(DISTINCT c.person_id) as team_member_ids
            FROM Submission s
            LEFT JOIN HackathonEvent e ON s.event_id = e.event_id
            LEFT JOIN Creates c ON s.submission_id = c.submission_id
            LEFT JOIN Person p ON c.person_id = p.person_id
            WHERE s.submission_id = ?
            GROUP BY s.submission_id
        `, [submissionId]);
        
        res.json({ 
            success: true, 
            message: 'Project updated successfully!',
            data: updatedSubmission[0]
        });
        
    } catch (error) {
        await conn.rollback();
        console.error('Update submission error:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        conn.release();
    }
});

// DELETE /api/submissions/:id - Delete a submission
router.delete('/:id', async (req, res) => {
    const conn = await req.mysqlPool.getConnection();
    
    try {
        await conn.beginTransaction();
        
        // Delete from Creates first (due to foreign key)
        await conn.query('DELETE FROM Creates WHERE submission_id = ?', [req.params.id]);
        
        // Delete from Evaluates (due to foreign key)
        await conn.query('DELETE FROM Evaluates WHERE submission_id = ?', [req.params.id]);
        
        // Delete submission
        const [result] = await conn.query('DELETE FROM Submission WHERE submission_id = ?', [req.params.id]);
        
        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, error: 'Submission not found' });
        }
        
        await conn.commit();
        res.json({ success: true, message: 'Submission deleted successfully' });
        
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ success: false, error: error.message });
    } finally {
        conn.release();
    }
});

module.exports = router;
