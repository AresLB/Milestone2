/**
 * MariaDB Service - Business Logic Layer
 * Student 2: Baur, Lennard (12018378)
 *
 * Handles all MariaDB database operations including:
 * - Use Case: Register Participant for Event
 * - Analytics Report: Event Registration Statistics
 * - Data Import/Generation
 */

const { pool } = require('../config/mariadb.config');
const fs = require('fs').promises;
const path = require('path');

class MariaDBService {
  /**
   * Get all events with venue information
   */
  async getAllEvents() {
    const query = `
      SELECT
        e.event_id,
        e.name,
        e.start_date,
        e.end_date,
        e.event_type,
        e.max_participants,
        v.name AS venue_name,
        v.address AS venue_address,
        COUNT(r.person_id) AS current_registrations,
        ROUND((COUNT(r.person_id) / e.max_participants) * 100, 2) AS capacity_percentage
      FROM HackathonEvent e
      INNER JOIN Venue v ON e.venue_id = v.venue_id
      LEFT JOIN Registration r ON e.event_id = r.event_id
      GROUP BY e.event_id, e.name, e.start_date, e.end_date, e.event_type,
               e.max_participants, v.name, v.address
      ORDER BY e.start_date ASC
    `;

    const [rows] = await pool.query(query);
    return rows;
  }

  /**
   * Get all participants (for dropdown selection)
   */
  async getAllParticipants() {
    const query = `
      SELECT
        p.person_id,
        p.first_name,
        p.last_name,
        p.email,
        pt.registration_date,
        pt.t_shirt_size,
        COUNT(r.event_id) AS events_registered
      FROM Person p
      INNER JOIN Participant pt ON p.person_id = pt.person_id
      LEFT JOIN Registration r ON pt.person_id = r.person_id
      GROUP BY p.person_id, p.first_name, p.last_name, p.email,
               pt.registration_date, pt.t_shirt_size
      ORDER BY p.last_name, p.first_name
    `;

    const [rows] = await pool.query(query);
    return rows;
  }

  /**
   * Check if participant is already registered for an event
   */
  async isAlreadyRegistered(personId, eventId) {
    const query = `
      SELECT COUNT(*) AS count
      FROM Registration
      WHERE person_id = ? AND event_id = ?
    `;

    const [rows] = await pool.query(query, [personId, eventId]);
    return rows[0].count > 0;
  }

  /**
   * Check if event has available capacity
   */
  async hasAvailableCapacity(eventId) {
    const query = `
      SELECT
        e.max_participants,
        COUNT(r.person_id) AS current_registrations,
        (e.max_participants - COUNT(r.person_id)) AS available_spots
      FROM HackathonEvent e
      LEFT JOIN Registration r ON e.event_id = r.event_id
      WHERE e.event_id = ?
      GROUP BY e.event_id, e.max_participants
    `;

    const [rows] = await pool.query(query, [eventId]);
    if (rows.length === 0) {
      throw new Error('Event not found');
    }

    return rows[0].available_spots > 0;
  }

  /**
   * Generate unique registration number
   */
  generateRegistrationNumber() {
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `REG-${year}-${timestamp}-${random}`;
  }

  /**
   * STUDENT 2 USE CASE: Register Participant for Event
   *
   * Workflow:
   * 1. Validate participant exists
   * 2. Validate event exists
   * 3. Check if already registered
   * 4. Check event capacity
   * 5. Create registration record
   *
   * Entities involved: Person, Participant, HackathonEvent, Venue, Registration
   */
  async registerParticipantForEvent(personId, eventId, ticketType, paymentStatus = 'pending') {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Validate participant exists
      const [participant] = await connection.query(
        'SELECT person_id FROM Participant WHERE person_id = ?',
        [personId]
      );

      if (participant.length === 0) {
        throw new Error('Participant not found');
      }

      // Validate event exists
      const [event] = await connection.query(
        'SELECT event_id, name, max_participants FROM HackathonEvent WHERE event_id = ?',
        [eventId]
      );

      if (event.length === 0) {
        throw new Error('Event not found');
      }

      // Check if already registered
      const [existing] = await connection.query(
        'SELECT person_id FROM Registration WHERE person_id = ? AND event_id = ?',
        [personId, eventId]
      );

      if (existing.length > 0) {
        throw new Error('Participant is already registered for this event');
      }

      // Check capacity
      const [capacity] = await connection.query(
        `SELECT COUNT(*) AS current_registrations, ? AS max_participants
         FROM Registration WHERE event_id = ?`,
        [event[0].max_participants, eventId]
      );

      if (capacity[0].current_registrations >= capacity[0].max_participants) {
        throw new Error('Event is at full capacity');
      }

      // Generate unique registration number
      const registrationNumber = this.generateRegistrationNumber();
      const registrationTimestamp = new Date();

      // Insert registration
      const [result] = await connection.query(
        `INSERT INTO Registration
         (person_id, event_id, registration_number, registration_timestamp, payment_status, ticket_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [personId, eventId, registrationNumber, registrationTimestamp, paymentStatus, ticketType]
      );

      await connection.commit();

      // Fetch complete registration details
      const [registration] = await connection.query(
        `SELECT
           r.registration_number,
           r.registration_timestamp,
           r.payment_status,
           r.ticket_type,
           p.first_name,
           p.last_name,
           p.email,
           e.name AS event_name,
           e.start_date,
           e.end_date,
           v.name AS venue_name
         FROM Registration r
         INNER JOIN Person p ON r.person_id = p.person_id
         INNER JOIN HackathonEvent e ON r.event_id = e.event_id
         INNER JOIN Venue v ON e.venue_id = v.venue_id
         WHERE r.person_id = ? AND r.event_id = ?`,
        [personId, eventId]
      );

      return {
        success: true,
        message: 'Registration successful',
        registration: registration[0]
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * STUDENT 2 ANALYTICS REPORT: Event Registration Statistics
   *
   * Requirements:
   * - Uses data from registration use case
   * - Involves 5 entities: Person, Participant, HackathonEvent, Venue, Registration
   * - Filter field: event_type
   * - Results change after use case execution
   */
  async getAnalyticsReport(eventType = null) {
    let query = `
      SELECT
        -- Event Information
        he.event_id,
        he.name AS event_name,
        he.event_type,
        he.start_date,
        he.end_date,
        he.max_participants,

        -- Venue Information
        v.name AS venue_name,
        v.address AS venue_address,
        v.capacity AS venue_capacity,

        -- Registration Statistics
        COUNT(r.registration_number) AS total_registrations,
        ROUND((COUNT(r.registration_number) / he.max_participants) * 100, 2) AS capacity_percentage,

        -- Payment Status Breakdown
        SUM(CASE WHEN r.payment_status = 'completed' THEN 1 ELSE 0 END) AS paid_registrations,
        SUM(CASE WHEN r.payment_status = 'pending' THEN 1 ELSE 0 END) AS pending_payments,

        -- Ticket Type Breakdown
        SUM(CASE WHEN r.ticket_type = 'Standard' THEN 1 ELSE 0 END) AS standard_tickets,
        SUM(CASE WHEN r.ticket_type = 'VIP' THEN 1 ELSE 0 END) AS vip_tickets,
        SUM(CASE WHEN r.ticket_type = 'Student' THEN 1 ELSE 0 END) AS student_tickets,

        -- Participant Details
        GROUP_CONCAT(
          CONCAT(p.first_name, ' ', p.last_name, ' (', r.ticket_type, ')')
          ORDER BY r.registration_timestamp
          SEPARATOR '; '
        ) AS registered_participants

      FROM HackathonEvent he
      INNER JOIN Venue v ON he.venue_id = v.venue_id
      LEFT JOIN Registration r ON he.event_id = r.event_id
      LEFT JOIN Participant pt ON r.person_id = pt.person_id
      LEFT JOIN Person p ON pt.person_id = p.person_id
    `;

    const params = [];

    // Apply filter if event_type is specified
    if (eventType) {
      query += ' WHERE he.event_type = ?';
      params.push(eventType);
    }

    query += `
      GROUP BY
        he.event_id, he.name, he.event_type, he.start_date, he.end_date, he.max_participants,
        v.name, v.address, v.capacity
      ORDER BY he.start_date DESC, total_registrations DESC
    `;

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Execute SQL script from file
   */
  async executeSQLFile(filename) {
    const sqlPath = path.join(__dirname, '../../sql', filename);
    const sql = await fs.readFile(sqlPath, 'utf8');

    const connection = await pool.getConnection();

    try {
      // Execute the entire SQL file at once to preserve session settings
      // like SET FOREIGN_KEY_CHECKS
      await connection.query(sql);

      return { success: true, message: `Executed ${filename} successfully` };
    } catch (error) {
      throw new Error(`Error executing ${filename}: ${error.message}`);
    } finally {
      connection.release();
    }
  }

  /**
   * Import/Regenerate data (for GUI button - MS2 requirement 2.2.1)
   * Executes the random data generation script
   */
  async importData() {
    try {
      // Execute the random data generation script
      await this.executeSQLFile('05_generate_random_data.sql');

      // Get summary statistics
      const [stats] = await pool.query(`
        SELECT
          'Persons' AS entity, COUNT(*) AS count FROM Person
        UNION ALL SELECT 'Participants', COUNT(*) FROM Participant
        UNION ALL SELECT 'Judges', COUNT(*) FROM Judge
        UNION ALL SELECT 'Events', COUNT(*) FROM HackathonEvent
        UNION ALL SELECT 'Workshops', COUNT(*) FROM Workshop
        UNION ALL SELECT 'Registrations', COUNT(*) FROM Registration
        UNION ALL SELECT 'Submissions', COUNT(*) FROM Submission
      `);

      return {
        success: true,
        message: 'Data imported successfully',
        statistics: stats
      };
    } catch (error) {
      throw new Error(`Data import failed: ${error.message}`);
    }
  }

  /**
   * Initialize database with schema and initial data
   */
  async initializeDatabase() {
    try {
      await this.executeSQLFile('01_create_tables.sql');
      await this.executeSQLFile('02_insert_initial_data.sql');
      await this.executeSQLFile('03_usecase_execution.sql');

      return {
        success: true,
        message: 'Database initialized successfully'
      };
    } catch (error) {
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    const [stats] = await pool.query(`
      SELECT
        'Persons' AS entity, COUNT(*) AS count FROM Person
      UNION ALL SELECT 'Participants', COUNT(*) FROM Participant
      UNION ALL SELECT 'Judges', COUNT(*) FROM Judge
      UNION ALL SELECT 'Venues', COUNT(*) FROM Venue
      UNION ALL SELECT 'Sponsors', COUNT(*) FROM Sponsor
      UNION ALL SELECT 'Events', COUNT(*) FROM HackathonEvent
      UNION ALL SELECT 'Workshops', COUNT(*) FROM Workshop
      UNION ALL SELECT 'Registrations', COUNT(*) FROM Registration
      UNION ALL SELECT 'Submissions', COUNT(*) FROM Submission
    `);

    return stats;
  }
}

module.exports = new MariaDBService();
