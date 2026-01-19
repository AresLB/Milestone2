const express = require('express');
const router = express.Router();

function buildEventSnapshot(event, venue) {
    if (!event) return null;
    return {
        event_id: event.event_id,
        name: event.name,
        event_type: event.event_type,
        start_date: event.start_date,
        end_date: event.end_date,
        max_participants: event.max_participants,
        venue: venue ? {
            venue_id: venue.venue_id,
            name: venue.name,
            address: venue.address,
            capacity: venue.capacity
        } : null
    };
}

function buildPersonSnapshot(person) {
    if (!person) return null;
    return {
        person_id: person.person_id,
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email,
        phone: person.phone
    };
}

// POST /api/nosql/migrate - Migrate data from MySQL to MongoDB
router.post('/migrate', async (req, res) => {
    try {
        const mysqlPool = req.mysqlPool;
        const mongoDB = req.mongoDB;

        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const [
            [people],
            [participants],
            [judges],
            [venues],
            [events],
            [sponsors],
            [submissions],
            [workshops],
            [registrations],
            [supports],
            [creates],
            [evaluates]
        ] = await Promise.all([
            mysqlPool.query('SELECT * FROM Person'),
            mysqlPool.query('SELECT * FROM Participant'),
            mysqlPool.query('SELECT * FROM Judge'),
            mysqlPool.query('SELECT * FROM Venue'),
            mysqlPool.query('SELECT * FROM HackathonEvent'),
            mysqlPool.query('SELECT * FROM Sponsor'),
            mysqlPool.query('SELECT * FROM Submission'),
            mysqlPool.query('SELECT * FROM Workshop'),
            mysqlPool.query('SELECT * FROM Registration'),
            mysqlPool.query('SELECT * FROM Supports'),
            mysqlPool.query('SELECT * FROM Creates'),
            mysqlPool.query('SELECT * FROM Evaluates')
        ]);

        const peopleById = new Map(people.map(p => [p.person_id, p]));
        const participantsById = new Map(participants.map(p => [p.person_id, p]));
        const judgesById = new Map(judges.map(j => [j.person_id, j]));
        const venuesById = new Map(venues.map(v => [v.venue_id, v]));
        const eventsById = new Map(events.map(e => [e.event_id, e]));
        const sponsorsById = new Map(sponsors.map(s => [s.sponsor_id, s]));
        const submissionsById = new Map(submissions.map(s => [s.submission_id, s]));

        const workshopsByEvent = new Map();
        workshops.forEach(w => {
            if (!workshopsByEvent.has(w.event_id)) workshopsByEvent.set(w.event_id, []);
            workshopsByEvent.get(w.event_id).push({
                workshop_number: w.workshop_number,
                title: w.title,
                description: w.description,
                duration: w.duration,
                skill_level: w.skill_level,
                max_attendees: w.max_attendees
            });
        });

        const registrationsByEvent = new Map();
        const registrationsByPerson = new Map();
        registrations.forEach(r => {
            if (!registrationsByEvent.has(r.event_id)) registrationsByEvent.set(r.event_id, []);
            if (!registrationsByPerson.has(r.person_id)) registrationsByPerson.set(r.person_id, []);
            registrationsByEvent.get(r.event_id).push(r);
            registrationsByPerson.get(r.person_id).push(r);
        });

        const supportsByEvent = new Map();
        const supportsBySponsor = new Map();
        supports.forEach(s => {
            if (!supportsByEvent.has(s.event_id)) supportsByEvent.set(s.event_id, []);
            if (!supportsBySponsor.has(s.sponsor_id)) supportsBySponsor.set(s.sponsor_id, []);
            supportsByEvent.get(s.event_id).push(s);
            supportsBySponsor.get(s.sponsor_id).push(s);
        });

        const createsBySubmission = new Map();
        const createsByPerson = new Map();
        creates.forEach(c => {
            if (!createsBySubmission.has(c.submission_id)) createsBySubmission.set(c.submission_id, []);
            if (!createsByPerson.has(c.person_id)) createsByPerson.set(c.person_id, []);
            createsBySubmission.get(c.submission_id).push(c);
            createsByPerson.get(c.person_id).push(c);
        });

        const evaluatesBySubmission = new Map();
        const evaluatesByJudge = new Map();
        evaluates.forEach(e => {
            if (!evaluatesBySubmission.has(e.submission_id)) evaluatesBySubmission.set(e.submission_id, []);
            if (!evaluatesByJudge.has(e.person_id)) evaluatesByJudge.set(e.person_id, []);
            evaluatesBySubmission.get(e.submission_id).push(e);
            evaluatesByJudge.get(e.person_id).push(e);
        });

        const warnings = {
            registrations_missing_event: 0,
            registrations_missing_person: 0,
            creates_missing_submission: 0,
            creates_missing_person: 0,
            submissions_missing_event: 0
        };

        const collections = ['participants', 'events', 'submissions'];
        const legacyCollections = ['judges', 'sponsors', 'venues'];
        await Promise.all(collections.map(name => mongoDB.collection(name).deleteMany({})));
        await Promise.all(legacyCollections.map(name => mongoDB.collection(name).drop().catch(() => null)));

        // Build participant documents with embedded registrations and submissions.
        const participantDocs = participants.map(p => {
            const person = peopleById.get(p.person_id);
            const regs = registrationsByPerson.get(p.person_id) || [];
            const regDocs = regs.map(r => {
                const event = eventsById.get(r.event_id);
                const venue = event ? venuesById.get(event.venue_id) : null;
                if (!event) warnings.registrations_missing_event++;
                if (!peopleById.get(r.person_id)) warnings.registrations_missing_person++;
                return {
                    event_id: r.event_id,
                    registration_number: r.registration_number,
                    registration_timestamp: r.registration_timestamp,
                    payment_status: r.payment_status,
                    ticket_type: r.ticket_type,
                    event_snapshot: buildEventSnapshot(event, venue)
                };
            });

            const created = createsByPerson.get(p.person_id) || [];
            const submissionDocs = created.map(c => {
                const submission = submissionsById.get(c.submission_id);
                if (!submission) {
                    warnings.creates_missing_submission++;
                    return null;
                }
                const event = eventsById.get(submission.event_id);
                const venue = event ? venuesById.get(event.venue_id) : null;
                return {
                    submission_id: submission.submission_id,
                    project_name: submission.project_name,
                    submission_time: submission.submission_time,
                    repository_url: submission.repository_url,
                    event_snapshot: buildEventSnapshot(event, venue)
                };
            }).filter(Boolean);

            return {
                _id: p.person_id,
                person: buildPersonSnapshot(person),
                participant: {
                    registration_date: p.registration_date,
                    t_shirt_size: p.t_shirt_size,
                    dietary_restrictions: p.dietary_restrictions,
                    manager_id: p.manager_id || null
                },
                registrations: regDocs,
                submissions: submissionDocs
            };
        });

        const eventDocs = events.map(e => {
            const venue = venuesById.get(e.venue_id);
            const regRows = registrationsByEvent.get(e.event_id) || [];
            const regDocs = regRows.map(r => {
                const person = peopleById.get(r.person_id);
                if (!person) warnings.registrations_missing_person++;
                return {
                    person_id: r.person_id,
                    registration_number: r.registration_number,
                    registration_timestamp: r.registration_timestamp,
                    payment_status: r.payment_status,
                    ticket_type: r.ticket_type,
                    participant: buildPersonSnapshot(person)
                };
            });

            const sponsorLinks = supportsByEvent.get(e.event_id) || [];
            const sponsorDocs = sponsorLinks.map(s => {
                const sponsor = sponsorsById.get(s.sponsor_id);
                if (!sponsor) return null;
                return {
                    sponsor_id: sponsor.sponsor_id,
                    company_name: sponsor.company_name,
                    industry: sponsor.industry,
                    website: sponsor.website,
                    contribution_amount: sponsor.contribution_amount
                };
            }).filter(Boolean);

            return {
                _id: e.event_id,
                name: e.name,
                start_date: e.start_date,
                end_date: e.end_date,
                event_type: e.event_type,
                max_participants: e.max_participants,
                venue: venue ? {
                    venue_id: venue.venue_id,
                    name: venue.name,
                    address: venue.address,
                    capacity: venue.capacity,
                    facilities: venue.facilities
                } : null,
                workshops: workshopsByEvent.get(e.event_id) || [],
                sponsors: sponsorDocs,
                registrations: regDocs
            };
        });

        const submissionDocs = submissions.map(s => {
            const creators = createsBySubmission.get(s.submission_id) || [];
            const teamDocs = creators.map(c => {
                const person = peopleById.get(c.person_id);
                if (!person) warnings.creates_missing_person++;
                return buildPersonSnapshot(person);
            }).filter(Boolean);
            const event = eventsById.get(s.event_id);
            const venue = event ? venuesById.get(event.venue_id) : null;
            if (!event) warnings.submissions_missing_event++;
            const evals = evaluatesBySubmission.get(s.submission_id) || [];
            const evaluationDocs = evals.map(e => ({
                judge_id: e.person_id,
                score: e.score,
                feedback: e.feedback,
                judge: buildPersonSnapshot(peopleById.get(e.person_id))
            }));
            return {
                _id: s.submission_id,
                event_id: s.event_id,
                project_name: s.project_name,
                description: s.description,
                submission_time: s.submission_time,
                technology_stack: s.technology_stack,
                repository_url: s.repository_url,
                submission_type: s.submission_type,
                event_snapshot: buildEventSnapshot(event, venue),
                team: teamDocs,
                evaluations: evaluationDocs
            };
        });

        const totalEmbeddedWorkshops = eventDocs.reduce((sum, doc) => {
            return sum + (doc.workshops ? doc.workshops.length : 0);
        }, 0);

        const insertOps = [];
        if (participantDocs.length) insertOps.push(mongoDB.collection('participants').insertMany(participantDocs));
        if (eventDocs.length) insertOps.push(mongoDB.collection('events').insertMany(eventDocs));
        if (submissionDocs.length) insertOps.push(mongoDB.collection('submissions').insertMany(submissionDocs));

        await Promise.all(insertOps);

        res.json({
            success: true,
            message: 'Migration completed',
            stats: {
                participants: participantDocs.length,
                events: eventDocs.length,
                submissions: submissionDocs.length,
                'workshops (embedded)': totalEmbeddedWorkshops,
                warnings_reg_missing_event: warnings.registrations_missing_event,
                warnings_reg_missing_person: warnings.registrations_missing_person,
                warnings_creates_missing_submission: warnings.creates_missing_submission,
                warnings_creates_missing_person: warnings.creates_missing_person,
                warnings_submissions_missing_event: warnings.submissions_missing_event
            }
        });
    } catch (error) {
        console.error('NoSQL migration error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/nosql/stats - Current MongoDB collection counts
router.get('/stats', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const collections = ['participants', 'events', 'submissions'];
        const stats = {};

        for (const name of collections) {
            stats[name] = await mongoDB.collection(name).countDocuments();
        }

        // Count embedded workshops (Student 2 data)
        const workshopCount = await mongoDB.collection('events').aggregate([
            { $unwind: '$workshops' },
            { $count: 'total' }
        ]).toArray();
        stats['workshops (embedded)'] = workshopCount[0]?.total || 0;

        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== NOSQL WORKSHOP ENDPOINTS (Student 2 - Use Case 2.3.3) ====================

// GET /api/nosql/workshops - Get all workshops from MongoDB (embedded in events)
router.get('/workshops', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        // Unwind workshops from events and project the needed fields
        const workshops = await mongoDB.collection('events').aggregate([
            { $unwind: { path: '$workshops', preserveNullAndEmptyArrays: false } },
            {
                $project: {
                    workshop_number: '$workshops.workshop_number',
                    event_id: '$_id',
                    title: '$workshops.title',
                    description: '$workshops.description',
                    duration: '$workshops.duration',
                    skill_level: '$workshops.skill_level',
                    max_attendees: '$workshops.max_attendees',
                    event_name: '$name',
                    start_date: '$start_date',
                    end_date: '$end_date',
                    venue_name: '$venue.name'
                }
            },
            { $sort: { start_date: 1, workshop_number: 1 } }
        ]).toArray();

        res.json({ success: true, data: workshops });
    } catch (error) {
        console.error('NoSQL get workshops error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/nosql/workshops/events - Get all events for dropdown (with workshop count)
router.get('/workshops/events', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const events = await mongoDB.collection('events').aggregate([
            {
                $project: {
                    event_id: '$_id',
                    name: 1,
                    start_date: 1,
                    end_date: 1,
                    event_type: 1,
                    venue_name: '$venue.name',
                    workshop_count: { $size: { $ifNull: ['$workshops', []] } }
                }
            },
            { $sort: { start_date: 1 } }
        ]).toArray();

        res.json({ success: true, data: events });
    } catch (error) {
        console.error('NoSQL get events error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/nosql/workshops/:eventId/:workshopNumber - Get single workshop
router.get('/workshops/:eventId/:workshopNumber', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const eventId = parseInt(req.params.eventId);
        const workshopNumber = parseInt(req.params.workshopNumber);

        const event = await mongoDB.collection('events').findOne({ _id: eventId });
        if (!event) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        const workshop = (event.workshops || []).find(w => w.workshop_number === workshopNumber);
        if (!workshop) {
            return res.status(404).json({ success: false, error: 'Workshop not found' });
        }

        res.json({
            success: true,
            data: {
                ...workshop,
                event_id: eventId,
                event_name: event.name,
                start_date: event.start_date,
                end_date: event.end_date,
                venue_name: event.venue?.name,
                venue_address: event.venue?.address
            }
        });
    } catch (error) {
        console.error('NoSQL get workshop error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/nosql/workshops - Create new workshop (add to event's workshops array)
router.post('/workshops', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const { event_id, title, description, duration, skill_level, max_attendees } = req.body;

        if (!event_id || !title) {
            return res.status(400).json({ success: false, error: 'Event and workshop title are required' });
        }

        // Find the event
        const event = await mongoDB.collection('events').findOne({ _id: parseInt(event_id) });
        if (!event) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        // Calculate next workshop number for this event
        const existingWorkshops = event.workshops || [];
        const maxNumber = existingWorkshops.reduce((max, w) => Math.max(max, w.workshop_number || 0), 0);
        const nextWorkshopNumber = maxNumber + 1;

        const newWorkshop = {
            workshop_number: nextWorkshopNumber,
            title: title,
            description: description || '',
            duration: duration || 60,
            skill_level: skill_level || 'Beginner',
            max_attendees: max_attendees || 30
        };

        // Push the new workshop to the event's workshops array
        await mongoDB.collection('events').updateOne(
            { _id: parseInt(event_id) },
            { $push: { workshops: newWorkshop } }
        );

        res.status(201).json({
            success: true,
            message: `Workshop "${title}" created for ${event.name}`,
            data: {
                workshop_number: nextWorkshopNumber,
                event_id: parseInt(event_id),
                title: title
            }
        });
    } catch (error) {
        console.error('NoSQL create workshop error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/nosql/workshops/:eventId/:workshopNumber - Update workshop
router.put('/workshops/:eventId/:workshopNumber', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const eventId = parseInt(req.params.eventId);
        const workshopNumber = parseInt(req.params.workshopNumber);
        const { title, description, duration, skill_level, max_attendees } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, error: 'Workshop title is required' });
        }

        // Update the specific workshop in the array using arrayFilters
        const result = await mongoDB.collection('events').updateOne(
            { _id: eventId, 'workshops.workshop_number': workshopNumber },
            {
                $set: {
                    'workshops.$.title': title,
                    'workshops.$.description': description || '',
                    'workshops.$.duration': duration || 60,
                    'workshops.$.skill_level': skill_level || 'Beginner',
                    'workshops.$.max_attendees': max_attendees || 30
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, error: 'Workshop not found' });
        }

        res.json({ success: true, message: 'Workshop updated successfully' });
    } catch (error) {
        console.error('NoSQL update workshop error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/nosql/workshops/:eventId/:workshopNumber - Delete workshop
router.delete('/workshops/:eventId/:workshopNumber', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const eventId = parseInt(req.params.eventId);
        const workshopNumber = parseInt(req.params.workshopNumber);

        // Remove the workshop from the array
        const result = await mongoDB.collection('events').updateOne(
            { _id: eventId },
            { $pull: { workshops: { workshop_number: workshopNumber } } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, error: 'Workshop not found' });
        }

        res.json({ success: true, message: 'Workshop deleted successfully' });
    } catch (error) {
        console.error('NoSQL delete workshop error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/nosql/indexes/create - Create indexes for workshop analytics (Student 2 - Task 2.3.5)
router.post('/indexes/create', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        // Create index on workshops.skill_level for filtering
        const indexResult = await mongoDB.collection('events').createIndex(
            { 'workshops.skill_level': 1 },
            { name: 'idx_workshops_skill_level' }
        );

        // Create compound index for sorting
        const indexResult2 = await mongoDB.collection('events').createIndex(
            { 'start_date': 1 },
            { name: 'idx_events_start_date' }
        );

        res.json({
            success: true,
            message: 'Indexes created successfully',
            indexes: [indexResult, indexResult2]
        });
    } catch (error) {
        console.error('Index creation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/nosql/indexes/list - List all indexes on events collection
router.get('/indexes/list', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const indexes = await mongoDB.collection('events').indexes();
        res.json({ success: true, indexes });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/nosql/analytics/workshops/explain - Get execution stats for analytics query
router.get('/analytics/workshops/explain', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const { skillLevel } = req.query;
        const filterSkillLevel = skillLevel || 'all';

        // Build the same pipeline as the analytics query
        const pipeline = [
            { $unwind: { path: '$workshops', preserveNullAndEmptyArrays: false } }
        ];

        if (filterSkillLevel !== 'all') {
            pipeline.push({ $match: { 'workshops.skill_level': filterSkillLevel } });
        }

        pipeline.push({
            $project: {
                workshop_number: '$workshops.workshop_number',
                event_id: '$_id',
                workshop_title: '$workshops.title',
                skill_level: '$workshops.skill_level',
                duration: '$workshops.duration',
                event_name: '$name',
                venue_name: '$venue.name'
            }
        });

        // Get execution stats using explain
        const explainResult = await mongoDB.collection('events')
            .aggregate(pipeline)
            .explain('executionStats');

        res.json({
            success: true,
            filter: { skillLevel: filterSkillLevel },
            executionStats: {
                totalDocsExamined: explainResult.stages?.[0]?.['$cursor']?.executionStats?.totalDocsExamined || 'N/A',
                executionTimeMillis: explainResult.stages?.[0]?.['$cursor']?.executionStats?.executionTimeMillis || 'N/A',
                indexesUsed: explainResult.stages?.[0]?.['$cursor']?.queryPlanner?.winningPlan?.inputStage?.indexName || 'COLLSCAN (no index)'
            },
            fullExplain: explainResult
        });
    } catch (error) {
        console.error('Explain error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/nosql/analytics/submissions - Submission Analytics Report (Student 1)
router.get('/analytics/submissions', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const { startDate, endDate } = req.query;

        // Default filter: same as SQL - submissions after October 10, 2025
        const filterStartDate = startDate ? new Date(startDate) : new Date('2025-10-10');
        const filterEndDate = endDate ? new Date(endDate) : new Date('2026-02-28');

        // First, get all submissions within date range
        const submissions = await mongoDB.collection('submissions').find({
            submission_time: {
                $gte: filterStartDate,
                $lte: filterEndDate
            }
        }).sort({ submission_time: -1 }).toArray();

        // Get all participants to lookup registration_date, t_shirt_size, dietary_restrictions
        const participants = await mongoDB.collection('participants').find({}).toArray();
        const participantsById = new Map(participants.map(p => [p._id, p]));

        // Count total submissions per participant
        const allSubmissions = await mongoDB.collection('submissions').find({}).toArray();
        const submissionCountByPerson = {};
        allSubmissions.forEach(s => {
            if (s.team) {
                s.team.forEach(member => {
                    submissionCountByPerson[member.person_id] = (submissionCountByPerson[member.person_id] || 0) + 1;
                });
            }
        });

        // Build results with all required fields (one row per participant per submission)
        const results = [];
        submissions.forEach(s => {
            if (s.team && s.team.length > 0) {
                s.team.forEach(member => {
                    const participant = participantsById.get(member.person_id);
                    const registrationDate = participant?.participant?.registration_date
                        ? new Date(participant.participant.registration_date)
                        : null;
                    const submissionTime = new Date(s.submission_time);

                    // Calculate days_since_registration
                    let daysSinceRegistration = null;
                    if (registrationDate) {
                        const diffTime = submissionTime - registrationDate;
                        daysSinceRegistration = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    }

                    results.push({
                        submission_id: s._id,
                        project_name: s.project_name,
                        description: s.description,
                        submission_time: s.submission_time,
                        technology_stack: s.technology_stack,
                        repository_url: s.repository_url,
                        event_name: s.event_snapshot?.name || null,
                        event_type: s.event_snapshot?.event_type || null,
                        person_id: member.person_id,
                        participant_first_name: member.first_name,
                        participant_last_name: member.last_name,
                        participant_email: member.email,
                        registration_date: participant?.participant?.registration_date || null,
                        t_shirt_size: participant?.participant?.t_shirt_size || null,
                        dietary_restrictions: participant?.participant?.dietary_restrictions || null,
                        days_since_registration: daysSinceRegistration,
                        total_submissions_by_participant: submissionCountByPerson[member.person_id] || 0
                    });
                });
            }
        });

        // Sort by submission_id ASC, then last_name ASC
        results.sort((a, b) => {
            const idCompare = a.submission_id - b.submission_id;
            if (idCompare !== 0) return idCompare;
            return (a.participant_last_name || '').localeCompare(b.participant_last_name || '');
        });

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
                startDate: filterStartDate.toISOString(),
                endDate: filterEndDate.toISOString()
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
        console.error('NoSQL analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/analytics/workshops', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const { skillLevel } = req.query;
        const filterSkillLevel = skillLevel || 'all';

        // Build aggregation pipeline
        const pipeline = [
            { $unwind: { path: '$workshops', preserveNullAndEmptyArrays: false } }
        ];

        // Add filter if skill level is specified
        if (filterSkillLevel !== 'all') {
            pipeline.push({ $match: { 'workshops.skill_level': filterSkillLevel } });
        }

        // Project the fields we need
        pipeline.push({
            $project: {
                workshop_number: '$workshops.workshop_number',
                event_id: '$_id',
                workshop_title: '$workshops.title',
                workshop_description: '$workshops.description',
                duration: '$workshops.duration',
                skill_level: '$workshops.skill_level',
                max_attendees: '$workshops.max_attendees',
                event_name: '$name',
                event_type: '$event_type',
                start_date: '$start_date',
                end_date: '$end_date',
                event_max_participants: '$max_participants',
                venue_id: '$venue.venue_id',
                venue_name: '$venue.name',
                venue_address: '$venue.address',
                venue_capacity: '$venue.capacity',
                venue_facilities: '$venue.facilities'
            }
        });

        pipeline.push({ $sort: { start_date: 1, workshop_number: 1 } });

        const results = await mongoDB.collection('events').aggregate(pipeline).toArray();

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

        // Add workshops_per_event to each result
        const workshopCountByEvent = {};
        results.forEach(r => {
            workshopCountByEvent[r.event_id] = (workshopCountByEvent[r.event_id] || 0) + 1;
        });
        results.forEach(r => {
            r.workshops_per_event = workshopCountByEvent[r.event_id];
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
        console.error('NoSQL analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== SUBMISSIONS (NoSQL) ====================

// ==================== SUBMISSIONS (NoSQL) ====================
// IMPORTANT: Specific routes MUST come BEFORE generic parameter routes

// GET /api/nosql/submissions/events/available - Get available events for submission (MongoDB)
router.get('/submissions/events/available', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const events = await mongoDB.collection('events').find({}).toArray();

        // Count submissions per event
        const submissions = await mongoDB.collection('submissions').find({}).toArray();
        const submissionCounts = {};
        submissions.forEach(s => {
            submissionCounts[s.event_id] = (submissionCounts[s.event_id] || 0) + 1;
        });

        const formattedEvents = events.map(e => ({
            event_id: e._id,
            name: e.name,
            event_type: e.event_type,
            start_date: e.start_date,
            end_date: e.end_date,
            max_participants: e.max_participants,
            venue_name: e.venue ? e.venue.name : null,
            submission_count: submissionCounts[e._id] || 0,
            registration_count: e.registrations ? e.registrations.length : 0
        }));

        res.json({ success: true, data: formattedEvents });
    } catch (error) {
        console.error('Error fetching events from MongoDB:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/nosql/submissions/participants/:eventId - Get participants for event (MongoDB)
router.get('/submissions/participants/:eventId', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const eventId = parseInt(req.params.eventId);

        const event = await mongoDB.collection('events').findOne({ _id: eventId });

        if (!event) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        const participants = event.registrations ? event.registrations.map(reg => ({
            person_id: reg.participant.person_id,
            first_name: reg.participant.first_name,
            last_name: reg.participant.last_name,
            email: reg.participant.email,
            registration_date: reg.registration_timestamp,
            registration_number: reg.registration_number,
            ticket_type: reg.ticket_type
        })) : [];

        res.json({ success: true, data: participants });
    } catch (error) {
        console.error('Error fetching participants from MongoDB:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/nosql/submissions - Get all submissions from MongoDB
router.get('/submissions', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const submissions = await mongoDB.collection('submissions').find({}).toArray();

        // Format the response to match SQL format
        const formattedSubmissions = submissions.map(s => ({
            submission_id: s._id,
            event_id: s.event_id,
            project_name: s.project_name,
            description: s.description,
            submission_time: s.submission_time,
            technology_stack: s.technology_stack,
            repository_url: s.repository_url,
            submission_type: s.submission_type,
            event_name: s.event_snapshot ? s.event_snapshot.name : null,
            team_members: s.team ? s.team.map(t => `${t.first_name} ${t.last_name}`).join(', ') : null
        }));

        res.json({ success: true, data: formattedSubmissions });
    } catch (error) {
        console.error('Error fetching submissions from MongoDB:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/nosql/submissions/:id - Get single submission from MongoDB
router.get('/submissions/:id', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const submission = await mongoDB.collection('submissions').findOne({ _id: parseInt(req.params.id) });
        
        if (!submission) {
            return res.status(404).json({ success: false, error: 'Submission not found' });
        }

        // Format the response
        const formatted = {
            submission_id: submission._id,
            event_id: submission.event_id,
            project_name: submission.project_name,
            description: submission.description,
            submission_time: submission.submission_time,
            technology_stack: submission.technology_stack,
            repository_url: submission.repository_url,
            submission_type: submission.submission_type,
            event_name: submission.event_snapshot ? submission.event_snapshot.name : null,
            team_member_ids: submission.team ? submission.team.map(t => t.person_id).join(',') : null,
            team_members: submission.team ? submission.team.map(t => `${t.first_name} ${t.last_name}`).join(', ') : null
        };

        res.json({ success: true, data: formatted });
    } catch (error) {
        console.error('Error fetching submission from MongoDB:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/nosql/submissions - Create new submission in MongoDB
router.post('/submissions', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const mysqlPool = req.mysqlPool;
        const { 
            event_id, 
            project_name, 
            description, 
            technology_stack, 
            repository_url, 
            team_member_ids,
            submission_type 
        } = req.body;

        // Validation
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

        // Get event from MySQL for snapshot
        const [eventCheck] = await mysqlPool.query(
            'SELECT e.*, v.name as venue_name, v.address, v.capacity FROM HackathonEvent e LEFT JOIN Venue v ON e.venue_id = v.venue_id WHERE e.event_id = ?',
            [event_id]
        );

        if (eventCheck.length === 0) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        const event = eventCheck[0];

        // Get team member info from MySQL
        const placeholders = team_member_ids.map(() => '?').join(',');
        const [teamMembers] = await mysqlPool.query(
            `SELECT person_id, first_name, last_name, email, phone FROM Person WHERE person_id IN (${placeholders})`,
            team_member_ids
        );

        // Get next submission ID
        const submissions = await mongoDB.collection('submissions').find({}).toArray();
        const nextId = submissions.length > 0 ? Math.max(...submissions.map(s => s._id)) + 1 : 1;

        // Create submission document
        const newSubmission = {
            _id: nextId,
            event_id,
            project_name,
            description,
            submission_time: new Date(),
            technology_stack,
            repository_url,
            submission_type,
            event_snapshot: {
                event_id: event.event_id,
                name: event.name,
                event_type: event.event_type,
                start_date: event.start_date,
                end_date: event.end_date,
                max_participants: event.max_participants,
                venue: {
                    venue_id: event.venue_id,
                    name: event.venue_name,
                    address: event.address,
                    capacity: event.capacity
                }
            },
            team: teamMembers.map(member => ({
                person_id: member.person_id,
                first_name: member.first_name,
                last_name: member.last_name,
                email: member.email,
                phone: member.phone
            })),
            evaluations: []
        };

        const result = await mongoDB.collection('submissions').insertOne(newSubmission);

        res.json({ 
            success: true, 
            message: 'Submission created successfully',
            submission_id: nextId,
            data: newSubmission 
        });
    } catch (error) {
        console.error('Error creating submission in MongoDB:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/nosql/submissions/:id - Update submission in MongoDB
router.put('/submissions/:id', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const mysqlPool = req.mysqlPool;
        const submissionId = parseInt(req.params.id);
        const { 
            event_id, 
            project_name, 
            description, 
            technology_stack, 
            repository_url, 
            team_member_ids,
            submission_type 
        } = req.body;

        // Validation
        if (!project_name || !team_member_ids || team_member_ids.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Project name and at least one team member are required' 
            });
        }

        // Check if submission exists
        const existing = await mongoDB.collection('submissions').findOne({ _id: submissionId });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Submission not found' });
        }

        // Get event from MySQL for snapshot
        const [eventCheck] = await mysqlPool.query(
            'SELECT e.*, v.name as venue_name, v.address, v.capacity FROM HackathonEvent e LEFT JOIN Venue v ON e.venue_id = v.venue_id WHERE e.event_id = ?',
            [event_id]
        );

        if (eventCheck.length === 0) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        const event = eventCheck[0];

        // Get team member info
        const placeholders = team_member_ids.map(() => '?').join(',');
        const [teamMembers] = await mysqlPool.query(
            `SELECT person_id, first_name, last_name, email, phone FROM Person WHERE person_id IN (${placeholders})`,
            team_member_ids
        );

        // Update submission
        const updatedSubmission = {
            event_id,
            project_name,
            description,
            technology_stack,
            repository_url,
            submission_type,
            event_snapshot: {
                event_id: event.event_id,
                name: event.name,
                event_type: event.event_type,
                start_date: event.start_date,
                end_date: event.end_date,
                max_participants: event.max_participants,
                venue: {
                    venue_id: event.venue_id,
                    name: event.venue_name,
                    address: event.address,
                    capacity: event.capacity
                }
            },
            team: teamMembers.map(member => ({
                person_id: member.person_id,
                first_name: member.first_name,
                last_name: member.last_name,
                email: member.email,
                phone: member.phone
            }))
        };

        await mongoDB.collection('submissions').updateOne(
            { _id: submissionId },
            { $set: updatedSubmission }
        );

        res.json({ 
            success: true, 
            message: 'Submission updated successfully',
            data: { _id: submissionId, ...updatedSubmission }
        });
    } catch (error) {
        console.error('Error updating submission in MongoDB:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/nosql/submissions/:id - Delete submission from MongoDB
router.delete('/submissions/:id', async (req, res) => {
    try {
        const mongoDB = req.mongoDB;
        if (!mongoDB) {
            return res.status(503).json({ success: false, error: 'MongoDB not connected' });
        }

        const submissionId = parseInt(req.params.id);

        const result = await mongoDB.collection('submissions').deleteOne({ _id: submissionId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, error: 'Submission not found' });
        }

        res.json({ success: true, message: 'Submission deleted successfully' });
    } catch (error) {
        console.error('Error deleting submission from MongoDB:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
