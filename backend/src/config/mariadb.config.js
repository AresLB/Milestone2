const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'hackathon_user',
  password: process.env.DB_PASSWORD || 'hackathon_pass',
  database: process.env.DB_NAME || 'hackathon_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  multipleStatements: true  // Allow executing multiple SQL statements in one query
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MariaDB connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MariaDB connection failed:', error.message);
    return false;
  }
}

// Initialize connection test
testConnection();

module.exports = { pool, testConnection };
