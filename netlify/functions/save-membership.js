// Function for handling membership application
const mysql = require('mysql2/promise');

/**
 * Netlify function to handle membership form submissions
 */
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' })
    };
  }

  // Database configuration
  // These would be set as environment variables in Netlify
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  };

  let connection;

  try {
    // Parse the incoming JSON data
    const data = JSON.parse(event.body);
    
    // Validate all required fields for hybrid encryption
    if (!data.encryptedData || !data.encryptedKey || !data.iv || !data.timestamp || !data.encryptionAlgorithm) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields for encryption' })
      };
    }
    
    // Verify the encryption algorithm is the expected one
    if (data.encryptionAlgorithm !== 'AES-GCM+RSA-OAEP') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Unsupported encryption algorithm' })
      };
    }
    
    // Validate beitrag (membership fee) is at least 25€
    const beitrag = parseInt(data.beitrag, 10);
    if (isNaN(beitrag) || beitrag < 25) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Der Mindestbeitrag beträgt 25€' })
      };
    }
    
    // Validate vorname and nachname are provided
    if (!data.vorname || !data.nachname) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Vor- und Nachname sind erforderlich' })
      };
    }
    
    
    // Create a database connection
    connection = await mysql.createConnection(dbConfig);
    
    // Convert ISO timestamp to MySQL compatible format
    const timestamp = new Date(data.timestamp).toISOString().slice(0, 19).replace('T', ' ');
    
    // Insert the membership application data with hybrid encryption fields
    const [result] = await connection.execute(
      `INSERT INTO membership_applications 
       (vorname, nachname, encrypted_data, encrypted_key, iv, encryption_algorithm, beitrag, timestamp, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.vorname,
        data.nachname,
        data.encryptedData,
        data.encryptedKey,
        data.iv,
        data.encryptionAlgorithm,
        beitrag,
        timestamp, // Konvertierter Zeitstempel im Format 'YYYY-MM-DD HH:MM:SS'
        'submitted' // Initial status
      ]
    );
      
    // Return success with the inserted ID
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Membership application received',
        id: result.insertId
      })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: error.message })
    };
  } finally {
    // Close the database connection
    if (connection) {
      await connection.end();
    }
  }
};