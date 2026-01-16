/**
 * MariaDB Routes
 * Student 2: Baur, Lennard (12018378)
 *
 * API endpoints for MariaDB operations
 */

const express = require('express');
const router = express.Router();
const mariadbController = require('../controllers/mariadb.controller');

/**
 * @route   GET /api/mariadb/events
 * @desc    Get all events with registration statistics
 * @access  Public
 */
router.get('/events', (req, res) => mariadbController.getAllEvents(req, res));

/**
 * @route   GET /api/mariadb/participants
 * @desc    Get all participants
 * @access  Public
 */
router.get('/participants', (req, res) => mariadbController.getAllParticipants(req, res));

/**
 * @route   POST /api/mariadb/register
 * @desc    Register participant for event (Student 2 Use Case)
 * @access  Public
 * @body    { personId, eventId, ticketType, paymentStatus }
 */
router.post('/register', (req, res) => mariadbController.registerParticipant(req, res));

/**
 * @route   GET /api/mariadb/report
 * @desc    Get analytics report (Student 2 Analytics Report)
 * @access  Public
 * @query   eventType (optional) - Filter by event type
 */
router.get('/report', (req, res) => mariadbController.getAnalyticsReport(req, res));

/**
 * @route   POST /api/mariadb/import-data
 * @desc    Import/regenerate random data (GUI button - MS2 2.2.1)
 * @access  Public
 */
router.post('/import-data', (req, res) => mariadbController.importData(req, res));

/**
 * @route   POST /api/mariadb/initialize
 * @desc    Initialize database with schema and initial data
 * @access  Public
 */
router.post('/initialize', (req, res) => mariadbController.initializeDatabase(req, res));

/**
 * @route   GET /api/mariadb/stats
 * @desc    Get database statistics
 * @access  Public
 */
router.get('/stats', (req, res) => mariadbController.getDatabaseStats(req, res));

module.exports = router;
