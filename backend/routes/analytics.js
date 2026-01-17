const express = require('express');
const router = express.Router();

// GET /api/analytics/submissions - Student 1's Analytics Report
// Hackathon Submission Statistics with participant details
// Filter field: submission_time
router.get('/submissions', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Default filter: submissions after November 8, 2025
        const filterStartDate = startDate || '2025-10-01 00:00:00';
        const filterEndDate = endDate || '2099-11-10 23:59:59';
        
        const [results] = await req.mysqlPool.query(`
            SELECT
                s.submission_id,
                s.project_name,
                s.description,
                s.submission_time,
                s.technology_stack,
                s.repository_url,
                
                -- Participant Information (from Person and Participant entities)
                p.person_id,
                p.first_name AS participant_first_name,
                p.last_name AS participant_last_name,
                p.email AS participant_email,
                pt.registration_date,
                pt.t_shirt_size,
                pt.dietary_restrictions,
                
                -- Time-based statistics
                DATEDIFF(CURRENT_DATE, pt.registration_date) AS days_since_registration,
                
                -- Submission count per participant
                (SELECT COUNT(*)
                 FROM Creates c2
                 WHERE c2.person_id = pt.person_id) AS total_submissions_by_participant
                 
            FROM Submission s
            -- Join to get the participant who created this submission
            INNER JOIN Creates c ON s.submission_id = c.submission_id
            INNER JOIN Participant pt ON c.person_id = pt.person_id
            INNER JOIN Person p ON pt.person_id = p.person_id
            
            -- FILTER FIELD: Only include submissions within date range
            WHERE s.submission_time >= ? AND s.submission_time <= ?
            
            ORDER BY
                s.submission_time DESC,
                p.last_name ASC
        `, [filterStartDate, filterEndDate]);
        
        // Calculate summary statistics
        const uniqueSubmissions = [...new Set(results.map(r => r.submission_id))].length;
        const uniqueParticipants = [...new Set(results.map(r => r.person_id))].length;
        
        // Technology stack analysis
        const techStacks = {};
        results.forEach(r => {
            if (r.technology_stack) {
                const techs = r.technology_stack.split(',').map(t => t.trim());
                techs.forEach(tech => {
                    techStacks[tech] = (techStacks[tech] || 0) + 1;
                });
            }
        });
        
        res.json({
            success: true,
            filter: {
                startDate: filterStartDate,
                endDate: filterEndDate
            },
            summary: {
                totalRecords: results.length,
                uniqueSubmissions,
                uniqueParticipants,
                technologyUsage: techStacks
            },
            data: results
        });
        
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/analytics/registrations - Student 2's Analytics Report
// Event Registration Statistics
// Filter field: event_type
router.get('/registrations', async (req, res) => {
    try {
        const { eventType } = req.query;
        const filterEventType = eventType || 'Hackathon';
        
        const [results] = await req.mysqlPool.query(`
            SELECT
                e.event_id,
                e.name AS event_name,
                e.event_type,
                e.start_date,
                e.end_date,
                e.max_participants,
                v.name AS venue_name,
                v.address AS venue_address,
                v.capacity AS venue_capacity,
                COUNT(r.person_id) AS total_registrations,
                ROUND((COUNT(r.person_id) * 100.0 / e.max_participants), 2) AS capacity_percentage,
                SUM(CASE WHEN r.payment_status = 'completed' THEN 1 ELSE 0 END) AS paid_registrations,
                SUM(CASE WHEN r.payment_status = 'pending' THEN 1 ELSE 0 END) AS pending_payments,
                GROUP_CONCAT(
                    CONCAT(p.first_name, ' ', p.last_name, ' (', r.ticket_type, ')')
                    SEPARATOR ', '
                ) AS registered_participants
            FROM HackathonEvent e
            JOIN Venue v ON e.venue_id = v.venue_id
            LEFT JOIN Registration r ON e.event_id = r.event_id
            LEFT JOIN Person p ON r.person_id = p.person_id
            WHERE e.event_type = ?
            GROUP BY e.event_id, e.name, e.event_type, e.start_date, e.end_date,
                     e.max_participants, v.name, v.address, v.capacity
            ORDER BY total_registrations DESC
        `, [filterEventType]);
        
        res.json({
            success: true,
            filter: { eventType: filterEventType },
            data: results
        });
        
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/analytics/summary - Overall system statistics
router.get('/summary', async (req, res) => {
    try {
        const [events] = await req.mysqlPool.query('SELECT COUNT(*) as count FROM HackathonEvent');
        const [participants] = await req.mysqlPool.query('SELECT COUNT(*) as count FROM Participant');
        const [submissions] = await req.mysqlPool.query('SELECT COUNT(*) as count FROM Submission');
        const [registrations] = await req.mysqlPool.query('SELECT COUNT(*) as count FROM Registration');
        
        const [recentSubmissions] = await req.mysqlPool.query(`
            SELECT s.project_name, s.submission_time, 
                   GROUP_CONCAT(CONCAT(p.first_name, ' ', p.last_name) SEPARATOR ', ') as team
            FROM Submission s
            LEFT JOIN Creates c ON s.submission_id = c.submission_id
            LEFT JOIN Person p ON c.person_id = p.person_id
            GROUP BY s.submission_id
            ORDER BY s.submission_time DESC
            LIMIT 5
        `);
        
        res.json({
            success: true,
            stats: {
                totalEvents: events[0].count,
                totalParticipants: participants[0].count,
                totalSubmissions: submissions[0].count,
                totalRegistrations: registrations[0].count
            },
            recentSubmissions
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
