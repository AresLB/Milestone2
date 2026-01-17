const express = require('express');
const router = express.Router();

// GET /api/submissions - Get all submissions with participant info
router.get('/', async (req, res) => {
    try {
        const [submissions] = await req.mysqlPool.query(`
            SELECT 
                s.submission_id,
                s.project_name,
                s.description,
                s.submission_time,
                s.technology_stack,
                s.repository_url,
                GROUP_CONCAT(DISTINCT CONCAT(p.first_name, ' ', p.last_name) SEPARATOR ', ') as team_members
            FROM Submission s
            LEFT JOIN Creates c ON s.submission_id = c.submission_id
            LEFT JOIN Person p ON c.person_id = p.person_id
            GROUP BY s.submission_id
            ORDER BY s.submission_time DESC
        `);
        
        res.json({ success: true, data: submissions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/submissions/participants - Get available participants for team selection
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

// GET /api/submissions/:id - Get single submission details
router.get('/:id', async (req, res) => {
    try {
        const [submissions] = await req.mysqlPool.query(`
            SELECT 
                s.*,
                GROUP_CONCAT(DISTINCT c.person_id) as team_member_ids,
                GROUP_CONCAT(DISTINCT CONCAT(p.first_name, ' ', p.last_name) SEPARATOR ', ') as team_members
            FROM Submission s
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

// POST /api/submissions - Create new submission (Student 1's Use Case)
router.post('/', async (req, res) => {
    const conn = await req.mysqlPool.getConnection();
    
    try {
        const { project_name, description, technology_stack, repository_url, team_member_ids } = req.body;
        
        // Validate required fields
        if (!project_name || !team_member_ids || team_member_ids.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Project name and at least one team member are required' 
            });
        }
        
        await conn.beginTransaction();
        
        // Create submission record
        const submission_time = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const [result] = await conn.query(
            'INSERT INTO Submission (project_name, description, submission_time, technology_stack, repository_url) VALUES (?, ?, ?, ?, ?)',
            [project_name, description || '', submission_time, technology_stack || '', repository_url || '']
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
        
        // Fetch the created submission with team info
        const [newSubmission] = await req.mysqlPool.query(`
            SELECT 
                s.*,
                GROUP_CONCAT(DISTINCT CONCAT(p.first_name, ' ', p.last_name) SEPARATOR ', ') as team_members
            FROM Submission s
            LEFT JOIN Creates c ON s.submission_id = c.submission_id
            LEFT JOIN Person p ON c.person_id = p.person_id
            WHERE s.submission_id = ?
            GROUP BY s.submission_id
        `, [submission_id]);
        
        res.status(201).json({ 
            success: true, 
            message: 'Project submitted successfully',
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
