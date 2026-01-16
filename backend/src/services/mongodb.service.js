/**
 * MongoDB Service - NoSQL Business Logic Layer
 * Student 2: Baur, Lennard (12018378)
 *
 * Handles all MongoDB operations including:
 * - Data migration from MariaDB to MongoDB
 * - Use Case: Register Participant for Event (NoSQL version)
 * - Analytics Report: Event Registration Statistics (NoSQL version)
 */

const { getDb } = require('../config/mongodb.config');
const { pool } = require('../config/mariadb.config');

class MongoDBService {
  /**
   * Get MongoDB collections
   */
  getCollections() {
    const db = getDb();
    return {
      events: db.collection('events'),
      participants: db.collection('participants'),
      venues: db.collection('venues'),
      sponsors: db.collection('sponsors'),
      workshops: db.collection('workshops'),
      submissions: db.collection('submissions'),
      judges: db.collection('judges')
    };
  }

  /**
   * MIGRATION: Transfer data from MariaDB to MongoDB
   * MS2 Requirement 2.3.2: Data migration without recreating data
   *
   * NoSQL Design (based on MS1 feedback):
   * - Use MongoDB's _id as the primary identifier (no redundant IDs)
   * - Embed related data where appropriate
   * - Use references for M:N relationships
   * - Denormalize for read optimization
   */
  async migrateFromMariaDB() {
    const collections = this.getCollections();

    try {
      // Clear existing MongoDB data
      await collections.events.deleteMany({});
      await collections.participants.deleteMany({});
      await collections.venues.deleteMany({});
      await collections.sponsors.deleteMany({});
      await collections.workshops.deleteMany({});
      await collections.submissions.deleteMany({});
      await collections.judges.deleteMany({});

      console.log('✓ Cleared existing MongoDB collections');

      // Step 1: Migrate Venues (simple entity)
      const [venues] = await pool.query('SELECT * FROM Venue');
      const venueIdMap = new Map(); // Maps SQL venue_id to MongoDB _id

      for (const venue of venues) {
        const mongoVenue = {
          _id: venue.venue_id, // Use SQL ID as MongoDB _id
          name: venue.name,
          address: venue.address,
          capacity: venue.capacity,
          facilities: venue.facilities
        };
        await collections.venues.insertOne(mongoVenue);
        venueIdMap.set(venue.venue_id, venue.venue_id);
      }
      console.log(`✓ Migrated ${venues.length} venues`);

      // Step 2: Migrate Sponsors
      const [sponsors] = await pool.query('SELECT * FROM Sponsor');
      const sponsorIdMap = new Map();

      for (const sponsor of sponsors) {
        const mongoSponsor = {
          _id: sponsor.sponsor_id,
          company_name: sponsor.company_name,
          industry: sponsor.industry,
          website: sponsor.website,
          contribution_amount: parseFloat(sponsor.contribution_amount)
        };
        await collections.sponsors.insertOne(mongoSponsor);
        sponsorIdMap.set(sponsor.sponsor_id, sponsor.sponsor_id);
      }
      console.log(`✓ Migrated ${sponsors.length} sponsors`);

      // Step 3: Migrate Events with embedded venue and registrations
      const [events] = await pool.query(`
        SELECT e.*, v.name AS venue_name, v.address AS venue_address, v.capacity AS venue_capacity
        FROM HackathonEvent e
        INNER JOIN Venue v ON e.venue_id = v.venue_id
      `);

      const eventIdMap = new Map();

      for (const event of events) {
        // Get registrations for this event
        const [registrations] = await pool.query(`
          SELECT
            r.*,
            p.first_name,
            p.last_name,
            p.email,
            pt.t_shirt_size,
            pt.dietary_restrictions
          FROM Registration r
          INNER JOIN Participant pt ON r.person_id = pt.person_id
          INNER JOIN Person p ON pt.person_id = p.person_id
          WHERE r.event_id = ?
        `, [event.event_id]);

        // Get sponsors for this event
        const [eventSponsors] = await pool.query(`
          SELECT s.*
          FROM Supports sup
          INNER JOIN Sponsor s ON sup.sponsor_id = s.sponsor_id
          WHERE sup.event_id = ?
        `, [event.event_id]);

        const mongoEvent = {
          _id: event.event_id,
          name: event.name,
          start_date: event.start_date,
          end_date: event.end_date,
          event_type: event.event_type,
          max_participants: event.max_participants,

          // Embed venue information (denormalization for read performance)
          venue: {
            _id: event.venue_id,
            name: event.venue_name,
            address: event.venue_address,
            capacity: event.venue_capacity
          },

          // Embed registrations (frequently accessed with event)
          registrations: registrations.map(r => ({
            person_id: r.person_id,
            participant_name: `${r.first_name} ${r.last_name}`,
            email: r.email,
            registration_number: r.registration_number,
            registration_timestamp: r.registration_timestamp,
            payment_status: r.payment_status,
            ticket_type: r.ticket_type,
            t_shirt_size: r.t_shirt_size,
            dietary_restrictions: r.dietary_restrictions
          })),

          // Reference to sponsors (M:N relationship)
          sponsor_ids: eventSponsors.map(s => s.sponsor_id),

          // Computed fields for performance
          registration_count: registrations.length,
          capacity_percentage: Math.round((registrations.length / event.max_participants) * 100 * 100) / 100
        };

        await collections.events.insertOne(mongoEvent);
        eventIdMap.set(event.event_id, event.event_id);
      }
      console.log(`✓ Migrated ${events.length} events with registrations`);

      // Step 4: Migrate Workshops (embedded in events or separate collection)
      const [workshops] = await pool.query(`
        SELECT * FROM Workshop ORDER BY event_id, workshop_number
      `);

      const workshopsByEvent = {};
      for (const workshop of workshops) {
        if (!workshopsByEvent[workshop.event_id]) {
          workshopsByEvent[workshop.event_id] = [];
        }
        workshopsByEvent[workshop.event_id].push({
          workshop_number: workshop.workshop_number,
          title: workshop.title,
          description: workshop.description,
          duration: workshop.duration,
          skill_level: workshop.skill_level,
          max_attendees: workshop.max_attendees
        });
      }

      // Update events with workshops
      for (const [eventId, eventWorkshops] of Object.entries(workshopsByEvent)) {
        await collections.events.updateOne(
          { _id: parseInt(eventId) },
          { $set: { workshops: eventWorkshops } }
        );
      }
      console.log(`✓ Migrated ${workshops.length} workshops`);

      // Step 5: Migrate Participants with event history
      const [participants] = await pool.query(`
        SELECT p.*, pt.*
        FROM Person p
        INNER JOIN Participant pt ON p.person_id = pt.person_id
      `);

      for (const participant of participants) {
        // Get participant's event history
        const [participantEvents] = await pool.query(`
          SELECT
            r.*,
            e.name AS event_name,
            e.event_type,
            e.start_date
          FROM Registration r
          INNER JOIN HackathonEvent e ON r.event_id = e.event_id
          WHERE r.person_id = ?
          ORDER BY r.registration_timestamp DESC
        `, [participant.person_id]);

        // Get manager info if exists
        let managerInfo = null;
        if (participant.manager_id) {
          const [manager] = await pool.query(`
            SELECT p.first_name, p.last_name
            FROM Person p
            WHERE p.person_id = ?
          `, [participant.manager_id]);
          if (manager.length > 0) {
            managerInfo = {
              _id: participant.manager_id,
              name: `${manager[0].first_name} ${manager[0].last_name}`
            };
          }
        }

        const mongoParticipant = {
          _id: participant.person_id,
          first_name: participant.first_name,
          last_name: participant.last_name,
          email: participant.email,
          phone: participant.phone,
          registration_date: participant.registration_date,
          t_shirt_size: participant.t_shirt_size,
          dietary_restrictions: participant.dietary_restrictions,

          // Manager info (unary relationship)
          manager: managerInfo,

          // Event history (denormalized for quick access)
          event_history: participantEvents.map(e => ({
            event_id: e.event_id,
            event_name: e.event_name,
            event_type: e.event_type,
            start_date: e.start_date,
            registration_number: e.registration_number,
            registration_timestamp: e.registration_timestamp,
            payment_status: e.payment_status,
            ticket_type: e.ticket_type
          })),

          events_count: participantEvents.length
        };

        await collections.participants.insertOne(mongoParticipant);
      }
      console.log(`✓ Migrated ${participants.length} participants`);

      // Step 6: Migrate Judges
      const [judges] = await pool.query(`
        SELECT p.*, j.*
        FROM Person p
        INNER JOIN Judge j ON p.person_id = j.person_id
      `);

      for (const judge of judges) {
        // Get judge's evaluation history
        const [evaluations] = await pool.query(`
          SELECT
            e.*,
            s.project_name,
            s.submission_time
          FROM Evaluates e
          INNER JOIN Submission s ON e.submission_id = s.submission_id
          WHERE e.person_id = ?
        `, [judge.person_id]);

        const mongoJudge = {
          _id: judge.person_id,
          first_name: judge.first_name,
          last_name: judge.last_name,
          email: judge.email,
          phone: judge.phone,
          expertise_area: judge.expertise_area,
          years_experience: judge.years_experience,
          organization: judge.organization,

          // Evaluation history
          evaluations: evaluations.map(e => ({
            submission_id: e.submission_id,
            project_name: e.project_name,
            score: parseFloat(e.score),
            feedback: e.feedback,
            evaluation_date: e.evaluation_date
          })),

          evaluations_count: evaluations.length
        };

        await collections.judges.insertOne(mongoJudge);
      }
      console.log(`✓ Migrated ${judges.length} judges`);

      // Step 7: Migrate Submissions with team members
      const [submissions] = await pool.query('SELECT * FROM Submission');

      for (const submission of submissions) {
        // Get team members
        const [teamMembers] = await pool.query(`
          SELECT p.person_id, p.first_name, p.last_name, p.email
          FROM Creates c
          INNER JOIN Person p ON c.person_id = p.person_id
          WHERE c.submission_id = ?
        `, [submission.submission_id]);

        // Get evaluations
        const [evals] = await pool.query(`
          SELECT
            e.*,
            p.first_name AS judge_first_name,
            p.last_name AS judge_last_name
          FROM Evaluates e
          INNER JOIN Person p ON e.person_id = p.person_id
          WHERE e.submission_id = ?
        `, [submission.submission_id]);

        const mongoSubmission = {
          _id: submission.submission_id,
          project_name: submission.project_name,
          description: submission.description,
          submission_time: submission.submission_time,
          technology_stack: submission.technology_stack,
          repository_url: submission.repository_url,

          // Team members (M:N relationship embedded)
          team_members: teamMembers.map(m => ({
            person_id: m.person_id,
            name: `${m.first_name} ${m.last_name}`,
            email: m.email
          })),

          // Evaluations
          evaluations: evals.map(e => ({
            judge_id: e.person_id,
            judge_name: `${e.judge_first_name} ${e.judge_last_name}`,
            score: parseFloat(e.score),
            feedback: e.feedback,
            evaluation_date: e.evaluation_date
          })),

          // Computed fields
          team_size: teamMembers.length,
          average_score: evals.length > 0
            ? Math.round(evals.reduce((sum, e) => sum + parseFloat(e.score), 0) / evals.length * 100) / 100
            : null
        };

        await collections.submissions.insertOne(mongoSubmission);
      }
      console.log(`✓ Migrated ${submissions.length} submissions`);

      // Create indexes for query performance
      await this.createIndexes();

      return {
        success: true,
        message: 'Data migration completed successfully',
        statistics: {
          venues: venues.length,
          sponsors: sponsors.length,
          events: events.length,
          workshops: workshops.length,
          participants: participants.length,
          judges: judges.length,
          submissions: submissions.length
        }
      };

    } catch (error) {
      console.error('Migration error:', error);
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  /**
   * Create MongoDB indexes for query performance (MS2 2.3.5)
   */
  async createIndexes() {
    const collections = this.getCollections();

    // Events indexes
    await collections.events.createIndex({ event_type: 1 });
    await collections.events.createIndex({ start_date: 1 });
    await collections.events.createIndex({ 'registrations.person_id': 1 });

    // Participants indexes
    await collections.participants.createIndex({ email: 1 }, { unique: true });
    await collections.participants.createIndex({ 'event_history.event_id': 1 });

    // Judges indexes
    await collections.judges.createIndex({ expertise_area: 1 });

    // Submissions indexes
    await collections.submissions.createIndex({ 'team_members.person_id': 1 });

    console.log('✓ Created MongoDB indexes');
  }

  /**
   * Get all events (NoSQL version)
   */
  async getAllEvents() {
    const collections = this.getCollections();
    const events = await collections.events
      .find({})
      .sort({ start_date: 1 })
      .toArray();

    return events;
  }

  /**
   * Get all participants (NoSQL version)
   */
  async getAllParticipants() {
    const collections = this.getCollections();
    const participants = await collections.participants
      .find({})
      .sort({ last_name: 1, first_name: 1 })
      .toArray();

    return participants;
  }

  /**
   * USE CASE: Register Participant for Event (NoSQL version)
   * Student 2 Use Case implemented with MongoDB
   */
  async registerParticipantForEvent(personId, eventId, ticketType, paymentStatus = 'pending') {
    const collections = this.getCollections();

    try {
      // Validate participant exists
      const participant = await collections.participants.findOne({ _id: personId });
      if (!participant) {
        throw new Error('Participant not found');
      }

      // Validate event exists
      const event = await collections.events.findOne({ _id: eventId });
      if (!event) {
        throw new Error('Event not found');
      }

      // Check if already registered
      const alreadyRegistered = event.registrations.some(r => r.person_id === personId);
      if (alreadyRegistered) {
        throw new Error('Participant is already registered for this event');
      }

      // Check capacity
      if (event.registrations.length >= event.max_participants) {
        throw new Error('Event is at full capacity');
      }

      // Generate registration
      const registrationNumber = `REG-${new Date().getFullYear()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const registrationTimestamp = new Date();

      const newRegistration = {
        person_id: personId,
        participant_name: `${participant.first_name} ${participant.last_name}`,
        email: participant.email,
        registration_number: registrationNumber,
        registration_timestamp: registrationTimestamp,
        payment_status: paymentStatus,
        ticket_type: ticketType,
        t_shirt_size: participant.t_shirt_size,
        dietary_restrictions: participant.dietary_restrictions
      };

      // Update event with new registration
      await collections.events.updateOne(
        { _id: eventId },
        {
          $push: { registrations: newRegistration },
          $inc: { registration_count: 1 },
          $set: {
            capacity_percentage: Math.round(((event.registrations.length + 1) / event.max_participants) * 100 * 100) / 100
          }
        }
      );

      // Update participant's event history
      await collections.participants.updateOne(
        { _id: personId },
        {
          $push: {
            event_history: {
              event_id: eventId,
              event_name: event.name,
              event_type: event.event_type,
              start_date: event.start_date,
              registration_number: registrationNumber,
              registration_timestamp: registrationTimestamp,
              payment_status: paymentStatus,
              ticket_type: ticketType
            }
          },
          $inc: { events_count: 1 }
        }
      );

      return {
        success: true,
        message: 'Registration successful',
        registration: {
          ...newRegistration,
          event_name: event.name,
          venue_name: event.venue.name
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * ANALYTICS REPORT: Event Registration Statistics (NoSQL version)
   * Student 2 Analytics Report implemented with MongoDB
   */
  async getAnalyticsReport(eventType = null) {
    const collections = this.getCollections();

    // Build match stage
    const matchStage = eventType ? { event_type: eventType } : {};

    // Aggregation pipeline
    const pipeline = [
      { $match: matchStage },
      {
        $project: {
          event_id: '$_id',
          event_name: '$name',
          event_type: '$event_type',
          start_date: '$start_date',
          end_date: '$end_date',
          max_participants: '$max_participants',
          venue_name: '$venue.name',
          venue_address: '$venue.address',
          venue_capacity: '$venue.capacity',
          total_registrations: { $size: '$registrations' },
          capacity_percentage: '$capacity_percentage',
          paid_registrations: {
            $size: {
              $filter: {
                input: '$registrations',
                as: 'reg',
                cond: { $eq: ['$$reg.payment_status', 'completed'] }
              }
            }
          },
          pending_payments: {
            $size: {
              $filter: {
                input: '$registrations',
                as: 'reg',
                cond: { $eq: ['$$reg.payment_status', 'pending'] }
              }
            }
          },
          standard_tickets: {
            $size: {
              $filter: {
                input: '$registrations',
                as: 'reg',
                cond: { $eq: ['$$reg.ticket_type', 'Standard'] }
              }
            }
          },
          vip_tickets: {
            $size: {
              $filter: {
                input: '$registrations',
                as: 'reg',
                cond: { $eq: ['$$reg.ticket_type', 'VIP'] }
              }
            }
          },
          student_tickets: {
            $size: {
              $filter: {
                input: '$registrations',
                as: 'reg',
                cond: { $eq: ['$$reg.ticket_type', 'Student'] }
              }
            }
          },
          registered_participants: {
            $reduce: {
              input: '$registrations',
              initialValue: '',
              in: {
                $concat: [
                  '$$value',
                  { $cond: [{ $eq: ['$$value', ''] }, '', '; '] },
                  '$$this.participant_name',
                  ' (',
                  '$$this.ticket_type',
                  ')'
                ]
              }
            }
          }
        }
      },
      {
        $sort: { start_date: -1, total_registrations: -1 }
      }
    ];

    const report = await collections.events.aggregate(pipeline).toArray();
    return report;
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    const collections = this.getCollections();

    const stats = [
      { entity: 'Events', count: await collections.events.countDocuments() },
      { entity: 'Participants', count: await collections.participants.countDocuments() },
      { entity: 'Judges', count: await collections.judges.countDocuments() },
      { entity: 'Venues', count: await collections.venues.countDocuments() },
      { entity: 'Sponsors', count: await collections.sponsors.countDocuments() },
      { entity: 'Submissions', count: await collections.submissions.countDocuments() }
    ];

    return stats;
  }
}

module.exports = new MongoDBService();
