const express = require('express');
const router = express.Router();

// GET /api/analytics/submissions - Student 1's Analytics Report
// Hackathon Submission Statistics with participant details
// Filter field: submission_time
router.get('/submissions', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Default filter: submissions after November 1, 2025
        const filterStartDate = startDate || '2025-11-01 00:00:00';
        const filterEndDate = endDate || '2099-11-10 23:59:59';
        
        const [results] = await req.mysqlPool.query(`
            SELECT
                s.submission_id,
                s.project_name,
                s.description,
                s.submission_time,
                s.technology_stack,
                s.repository_url,
                e.name AS event_name,
                e.event_type AS event_type,

                -- Participant Information (from Person and Participant entities)
                p.person_id,
                p.first_name AS participant_first_name,
                p.last_name AS participant_last_name,
                p.email AS participant_email,
                pt.registration_date,
                pt.t_shirt_size,
                pt.dietary_restrictions,

                -- Calculated Fields
                -- days_since_registration: time difference between registration and project submission
                DATEDIFF(s.submission_time, pt.registration_date) AS days_since_registration,

                -- total_submissions_by_participant: total number of projects submitted by each participant
                (SELECT COUNT(*)
                 FROM Creates c2
                 WHERE c2.person_id = pt.person_id) AS total_submissions_by_participant
                 
            FROM Submission s
            -- Join to get the participant who created this submission
            INNER JOIN Creates c ON s.submission_id = c.submission_id
            INNER JOIN Participant pt ON c.person_id = pt.person_id
            INNER JOIN Person p ON pt.person_id = p.person_id
            INNER JOIN HackathonEvent e ON s.event_id = e.event_id
            
            -- FILTER FIELD: Only include submissions within date range
            WHERE s.submission_time >= ? AND s.submission_time <= ?
            
            ORDER BY
                s.submission_id ASC,
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

// GET /api/analytics/workshops - Student 2's Analytics Report
// Workshop Statistics (Weak Entity)
// Filter field: skill_level
// Entities involved: Workshop (weak entity), HackathonEvent (owner), Venue
router.get('/workshops', async (req, res) => {
    try {
        const { skillLevel } = req.query;
        const filterSkillLevel = skillLevel || 'all';

        let query = `
            SELECT
                -- Workshop data (Weak Entity)
                w.workshop_number,
                w.event_id,
                w.title AS workshop_title,
                w.description AS workshop_description,
                w.duration,
                w.skill_level,
                w.max_attendees,

                -- HackathonEvent data (Owner Entity)
                e.name AS event_name,
                e.event_type,
                e.start_date,
                e.end_date,
                e.max_participants AS event_max_participants,

                -- Venue data (Related Entity via Event)
                v.venue_id,
                v.name AS venue_name,
                v.address AS venue_address,
                v.capacity AS venue_capacity,
                v.facilities AS venue_facilities,

                -- Computed statistics
                (SELECT COUNT(*) FROM Workshop w2 WHERE w2.event_id = e.event_id) AS workshops_per_event

            FROM Workshop w
            INNER JOIN HackathonEvent e ON w.event_id = e.event_id
            LEFT JOIN Venue v ON e.venue_id = v.venue_id
        `;

        const params = [];
        if (filterSkillLevel !== 'all') {
            query += ` WHERE w.skill_level = ?`;
            params.push(filterSkillLevel);
        }

        query += ` ORDER BY e.start_date, w.workshop_number`;

        const [results] = await req.mysqlPool.query(query, params);

        // Calculate summary statistics
        const totalWorkshops = results.length;
        const uniqueEvents = [...new Set(results.map(r => r.event_id))].length;
        const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
        const avgDuration = totalWorkshops > 0 ? Math.round(totalDuration / totalWorkshops) : 0;

        // Skill level distribution
        const skillDistribution = {};
        results.forEach(r => {
            skillDistribution[r.skill_level] = (skillDistribution[r.skill_level] || 0) + 1;
        });

        res.json({
            success: true,
            filter: { skillLevel: filterSkillLevel },
            summary: {
                totalWorkshops,
                uniqueEvents,
                averageDuration: avgDuration,
                skillDistribution
            },
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
            SELECT 
                s.submission_id,
                s.project_name,
                s.submission_time,
                s.submission_type,
                s.description,
                s.repository_url,
                s.technology_stack,
                e.name as event_name,
                GROUP_CONCAT(CONCAT(p.first_name, ' ', p.last_name) SEPARATOR ', ') as team
            FROM Submission s
            LEFT JOIN Creates c ON s.submission_id = c.submission_id
            LEFT JOIN Person p ON c.person_id = p.person_id
            LEFT JOIN HackathonEvent e ON s.event_id = e.event_id
            GROUP BY s.submission_id
            ORDER BY s.submission_id DESC
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
