/**
 * MongoDB Controller - NoSQL Request Handler Layer
 * Student 2: Baur, Lennard (12018378)
 *
 * Handles HTTP requests and responses for MongoDB operations
 */

const mongodbService = require('../services/mongodb.service');

class MongoDBController {
  /**
   * POST /api/mongodb/migrate
   * Migrate data from MariaDB to MongoDB
   * MS2 Requirement 2.3.2
   */
  async migrateFromMariaDB(req, res) {
    try {
      console.log('Starting data migration from MariaDB to MongoDB...');
      const result = await mongodbService.migrateFromMariaDB();
      res.json(result);
    } catch (error) {
      console.error('Error during migration:', error);
      res.status(500).json({
        success: false,
        error: 'Migration failed',
        message: error.message
      });
    }
  }

  /**
   * GET /api/mongodb/events
   * Get all events (NoSQL version)
   */
  async getAllEvents(req, res) {
    try {
      const events = await mongodbService.getAllEvents();
      res.json({
        success: true,
        count: events.length,
        data: events
      });
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch events',
        message: error.message
      });
    }
  }

  /**
   * GET /api/mongodb/participants
   * Get all participants (NoSQL version)
   */
  async getAllParticipants(req, res) {
    try {
      const participants = await mongodbService.getAllParticipants();
      res.json({
        success: true,
        count: participants.length,
        data: participants
      });
    } catch (error) {
      console.error('Error fetching participants:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch participants',
        message: error.message
      });
    }
  }

  /**
   * POST /api/mongodb/register
   * Register participant for event (NoSQL version - Student 2 Use Case)
   *
   * Request body:
   * {
   *   "personId": 5,
   *   "eventId": 1,
   *   "ticketType": "Standard",
   *   "paymentStatus": "pending"
   * }
   */
  async registerParticipant(req, res) {
    try {
      const { personId, eventId, ticketType, paymentStatus } = req.body;

      // Validate required fields
      if (!personId || !eventId || !ticketType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'personId, eventId, and ticketType are required'
        });
      }

      // Validate ticket type
      const validTicketTypes = ['Standard', 'VIP', 'Student'];
      if (!validTicketTypes.includes(ticketType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ticket type',
          message: `Ticket type must be one of: ${validTicketTypes.join(', ')}`
        });
      }

      // Execute use case (NoSQL version)
      const result = await mongodbService.registerParticipantForEvent(
        personId,
        eventId,
        ticketType,
        paymentStatus || 'pending'
      );

      res.status(201).json(result);

    } catch (error) {
      console.error('Error registering participant:', error);

      // Handle specific errors
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: error.message
        });
      }

      if (error.message.includes('already registered')) {
        return res.status(409).json({
          success: false,
          error: 'Already registered',
          message: error.message
        });
      }

      if (error.message.includes('full capacity')) {
        return res.status(409).json({
          success: false,
          error: 'Event full',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Registration failed',
        message: error.message
      });
    }
  }

  /**
   * GET /api/mongodb/report
   * Get analytics report (NoSQL version - Student 2 Analytics Report)
   *
   * Query parameters:
   * - eventType: Filter by event type (optional)
   */
  async getAnalyticsReport(req, res) {
    try {
      const { eventType } = req.query;

      const report = await mongodbService.getAnalyticsReport(eventType);

      res.json({
        success: true,
        database: 'MongoDB',
        filter: eventType ? { eventType } : null,
        count: report.length,
        data: report
      });
    } catch (error) {
      console.error('Error generating analytics report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate analytics report',
        message: error.message
      });
    }
  }

  /**
   * GET /api/mongodb/stats
   * Get database statistics (NoSQL version)
   */
  async getDatabaseStats(req, res) {
    try {
      const stats = await mongodbService.getDatabaseStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching database stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch database statistics',
        message: error.message
      });
    }
  }
}

module.exports = new MongoDBController();
