const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Database configurations
const mysqlConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'hackathon_user',
    password: process.env.DB_PASSWORD || 'hackathon_pass',
    database: process.env.DB_NAME || 'hackathon_db',
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 10000
};

const mongoUri = process.env.MONGO_URI || 'mongodb://root:root123@localhost:27017/hackathon_db?authSource=admin';

// Create MySQL connection pool
let mysqlPool = null;
let mongoClient = null;
let mongoDB = null;
let dbInitialized = false;

// Retry connection with delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function initDatabases(retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Database connection attempt ${i + 1}/${retries}...`);
            
            // Initialize MySQL
            mysqlPool = mysql.createPool(mysqlConfig);
            // Test the connection
            const conn = await mysqlPool.getConnection();
            await conn.ping();
            conn.release();
            console.log('MySQL connection pool created and tested');

            // Initialize MongoDB
            mongoClient = new MongoClient(mongoUri, {
                serverSelectionTimeoutMS: 5000
            });
            await mongoClient.connect();
            mongoDB = mongoClient.db('hackathon_db');
            await mongoDB.command({ ping: 1 });
            console.log('MongoDB connected and tested');
            
            dbInitialized = true;
            return true;
        } catch (error) {
            console.error(`Database connection attempt ${i + 1} failed:`, error.message);
            if (i < retries - 1) {
                console.log(`Retrying in 3 seconds...`);
                await delay(3000);
            }
        }
    }
    console.error('Failed to connect to databases after all retries');
    return false;
}

// Import routes
const dataImportRoutes = require('./routes/dataImport');
const submissionRoutes = require('./routes/submissions');
const analyticsRoutes = require('./routes/analytics');
const registrationRoutes = require('./routes/registrations');
const nosqlMigrationRoutes = require('./routes/nosqlMigration');

// Health check - MUST come before database middleware
app.get('/api/health', async (req, res) => {
    const health = {
        status: 'checking',
        mysql: 'disconnected',
        mongodb: 'disconnected',
        dbInitialized: dbInitialized
    };
    
    try {
        if (mysqlPool) {
            const conn = await mysqlPool.getConnection();
            await conn.ping();
            conn.release();
            health.mysql = 'connected';
        }
    } catch (error) {
        health.mysql = `error: ${error.message}`;
    }
    
    try {
        if (mongoDB) {
            await mongoDB.command({ ping: 1 });
            health.mongodb = 'connected';
        }
    } catch (error) {
        health.mongodb = `error: ${error.message}`;
    }
    
    health.status = (health.mysql === 'connected' && health.mongodb === 'connected') 
        ? 'healthy' 
        : 'unhealthy';
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
});

// Make database connections available to routes
app.use('/api', (req, res, next) => {
    if (!dbInitialized || !mysqlPool) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected. Please wait for initialization or check database services.' 
        });
    }
    req.mysqlPool = mysqlPool;
    req.mongoDB = mongoDB;
    next();
});

// API Routes
app.use('/api/data', dataImportRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/nosql', nosqlMigrationRoutes);

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
initDatabases().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    if (mysqlPool) await mysqlPool.end();
    if (mongoClient) await mongoClient.close();
    process.exit(0);
});
