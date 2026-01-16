/**
 * MariaDB Controller - Request Handler Layer
 * Student 2: Baur, Lennard (12018378)
 *
 * Handles HTTP requests and responses for MariaDB operations
 */

const mariadbService = require('../services/mariadb.service');

class MariaDBController {
  /**
   * GET /api/mariadb/events
   * Get all events with registration statistics
   */
  async getAllEvents(req, res) {
    try {
      const events = await mariadbService.getAllEvents();
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
   * GET /api/mariadb/participants
   * Get all participants
   */
  async getAllParticipants(req, res) {
    try {
      const participants = await mariadbService.getAllParticipants();
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
   * POST /api/mariadb/register
   * Register a participant for an event (Student 2 Use Case)
   *
   * Request body:
   * {
   *   "personId": 5,
   *   "eventId": 1,
   *   "ticketType": "Standard",
   *   "paymentStatus": "pending"  // optional, defaults to "pending"
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

      // Execute use case
      const result = await mariadbService.registerParticipantForEvent(
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
   * GET /api/mariadb/report
   * Get analytics report (Student 2 Analytics Report)
   *
   * Query parameters:
   * - eventType: Filter by event type (optional)
   *   Example: /api/mariadb/report?eventType=Hackathon
   */
  async getAnalyticsReport(req, res) {
    try {
      const { eventType } = req.query;

      const report = await mariadbService.getAnalyticsReport(eventType);

      res.json({
        success: true,
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
   * POST /api/mariadb/import-data
   * Import/regenerate random data (MS2 requirement 2.2.1)
   * Triggered by GUI button
   */
  async importData(req, res) {
    try {
      const result = await mariadbService.importData();
      res.json(result);
    } catch (error) {
      console.error('Error importing data:', error);
      res.status(500).json({
        success: false,
        error: 'Data import failed',
        message: error.message
      });
    }
  }

  /**
   * POST /api/mariadb/initialize
   * Initialize database with schema and initial data
   */
  async initializeDatabase(req, res) {
    try {
      const result = await mariadbService.initializeDatabase();
      res.json(result);
    } catch (error) {
      console.error('Error initializing database:', error);
      res.status(500).json({
        success: false,
        error: 'Database initialization failed',
        message: error.message
      });
    }
  }

  /**
   * GET /api/mariadb/stats
   * Get database statistics
   */
  async getDatabaseStats(req, res) {
    try {
      const stats = await mariadbService.getDatabaseStats();
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

module.exports = new MariaDBController();
