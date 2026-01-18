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

module.exports = router;
