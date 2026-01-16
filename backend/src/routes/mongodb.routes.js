/**
 * MongoDB Routes
 * Student 2: Baur, Lennard (12018378)
 *
 * API endpoints for MongoDB (NoSQL) operations
 */

const express = require('express');
const router = express.Router();
const mongodbController = require('../controllers/mongodb.controller');

/**
 * @route   POST /api/mongodb/migrate
 * @desc    Migrate data from MariaDB to MongoDB (MS2 2.3.2)
 * @access  Public
 */
router.post('/migrate', (req, res) => mongodbController.migrateFromMariaDB(req, res));

/**
 * @route   GET /api/mongodb/events
 * @desc    Get all events (NoSQL version)
 * @access  Public
 */
router.get('/events', (req, res) => mongodbController.getAllEvents(req, res));

/**
 * @route   GET /api/mongodb/participants
 * @desc    Get all participants (NoSQL version)
 * @access  Public
 */
router.get('/participants', (req, res) => mongodbController.getAllParticipants(req, res));

/**
 * @route   POST /api/mongodb/register
 * @desc    Register participant for event (NoSQL version - Student 2 Use Case)
 * @access  Public
 * @body    { personId, eventId, ticketType, paymentStatus }
 */
router.post('/register', (req, res) => mongodbController.registerParticipant(req, res));

/**
 * @route   GET /api/mongodb/report
 * @desc    Get analytics report (NoSQL version - Student 2 Analytics Report)
 * @access  Public
 * @query   eventType (optional) - Filter by event type
 */
router.get('/report', (req, res) => mongodbController.getAnalyticsReport(req, res));

/**
 * @route   GET /api/mongodb/stats
 * @desc    Get database statistics (NoSQL version)
 * @access  Public
 */
router.get('/stats', (req, res) => mongodbController.getDatabaseStats(req, res));

module.exports = router;
