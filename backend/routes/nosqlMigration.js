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

        const collections = ['participants', 'judges', 'events', 'submissions', 'sponsors', 'venues'];
        await Promise.all(collections.map(name => mongoDB.collection(name).deleteMany({})));

        // Build participant documents with embedded registrations and submissions.
        const participantDocs = participants.map(p => {
            const person = peopleById.get(p.person_id);
            const regs = registrationsByPerson.get(p.person_id) || [];
            const regDocs = regs.map(r => {
                const event = eventsById.get(r.event_id);
                const venue = event ? venuesById.get(event.venue_id) : null;
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
                if (!submission) return null;
                return {
                    submission_id: submission.submission_id,
                    project_name: submission.project_name,
                    submission_time: submission.submission_time,
                    repository_url: submission.repository_url
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

        const judgeDocs = judges.map(j => {
            const person = peopleById.get(j.person_id);
            const evals = evaluatesByJudge.get(j.person_id) || [];
            const evaluationDocs = evals.map(e => {
                const submission = submissionsById.get(e.submission_id);
                return {
                    submission_id: e.submission_id,
                    project_name: submission ? submission.project_name : null,
                    score: e.score,
                    feedback: e.feedback
                };
            });
            return {
                _id: j.person_id,
                person: buildPersonSnapshot(person),
                judge: {
                    expertise_area: j.expertise_area,
                    years_experience: j.years_experience,
                    organization: j.organization
                },
                evaluations: evaluationDocs
            };
        });

        const eventDocs = events.map(e => {
            const venue = venuesById.get(e.venue_id);
            const regRows = registrationsByEvent.get(e.event_id) || [];
            const regDocs = regRows.map(r => ({
                person_id: r.person_id,
                registration_number: r.registration_number,
                registration_timestamp: r.registration_timestamp,
                payment_status: r.payment_status,
                ticket_type: r.ticket_type,
                participant: buildPersonSnapshot(peopleById.get(r.person_id))
            }));

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
            const teamDocs = creators.map(c => buildPersonSnapshot(peopleById.get(c.person_id))).filter(Boolean);
            const evals = evaluatesBySubmission.get(s.submission_id) || [];
            const evaluationDocs = evals.map(e => ({
                judge_id: e.person_id,
                score: e.score,
                feedback: e.feedback,
                judge: buildPersonSnapshot(peopleById.get(e.person_id))
            }));
            return {
                _id: s.submission_id,
                project_name: s.project_name,
                description: s.description,
                submission_time: s.submission_time,
                technology_stack: s.technology_stack,
                repository_url: s.repository_url,
                team: teamDocs,
                evaluations: evaluationDocs
            };
        });

        const sponsorDocs = sponsors.map(s => {
            const links = supportsBySponsor.get(s.sponsor_id) || [];
            const eventsDocs = links.map(l => {
                const event = eventsById.get(l.event_id);
                const venue = event ? venuesById.get(event.venue_id) : null;
                return buildEventSnapshot(event, venue);
            }).filter(Boolean);
            return {
                _id: s.sponsor_id,
                company_name: s.company_name,
                industry: s.industry,
                website: s.website,
                contribution_amount: s.contribution_amount,
                supported_events: eventsDocs
            };
        });

        const venueDocs = venues.map(v => {
            const hostedEvents = events.filter(e => e.venue_id === v.venue_id).map(e => ({
                event_id: e.event_id,
                name: e.name,
                start_date: e.start_date,
                end_date: e.end_date,
                event_type: e.event_type,
                max_participants: e.max_participants
            }));
            return {
                _id: v.venue_id,
                name: v.name,
                address: v.address,
                capacity: v.capacity,
                facilities: v.facilities,
                events: hostedEvents
            };
        });

        const insertOps = [];
        if (participantDocs.length) insertOps.push(mongoDB.collection('participants').insertMany(participantDocs));
        if (judgeDocs.length) insertOps.push(mongoDB.collection('judges').insertMany(judgeDocs));
        if (eventDocs.length) insertOps.push(mongoDB.collection('events').insertMany(eventDocs));
        if (submissionDocs.length) insertOps.push(mongoDB.collection('submissions').insertMany(submissionDocs));
        if (sponsorDocs.length) insertOps.push(mongoDB.collection('sponsors').insertMany(sponsorDocs));
        if (venueDocs.length) insertOps.push(mongoDB.collection('venues').insertMany(venueDocs));

        await Promise.all(insertOps);

        res.json({
            success: true,
            message: 'Migration completed',
            stats: {
                participants: participantDocs.length,
                judges: judgeDocs.length,
                events: eventDocs.length,
                submissions: submissionDocs.length,
                sponsors: sponsorDocs.length,
                venues: venueDocs.length
            }
        });
    } catch (error) {
        console.error('NoSQL migration error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
