/**
 * Hilfsfunktionen für die Auth0-Authentifizierung
 */
const { auth } = require('express-openid-connect');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const mysql = require('mysql2/promise');

/**
 * JWT-Token aus Cookie extrahieren
 * @param {Object} event - Netlify Function Event
 * @returns {string|null} - Das JWT-Token oder null, wenn nicht gefunden
 */
function extractJwtFromCookie(event) {
  const cookies = event.headers.cookie || '';
  const cookieMap = cookies.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});
  
  return cookieMap['PrincipiumCantiAccessToken'] || null;
}

// JWKS-Client für die Validierung der Auth0-Tokens einrichten
const client = jwksClient({
  jwksUri: `${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5
});

/**
 * Datenbank-Verbindung herstellen
 * @returns {Promise<Object>} - Datenbank-Connection
 */
async function getDbConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
}

/**
 * Schlüssel aus dem Datenbank-Cache abrufen
 * @param {string} kid - Key ID
 * @returns {Promise<string|null>} - Der Signaturschlüssel oder null
 */
async function getKeyFromCache(kid) {
  try {
    const connection = await getDbConnection();
    
    // Prüfen, ob der Schlüssel im Cache ist und noch nicht abgelaufen ist
    const [rows] = await connection.execute(
      'SELECT signing_key FROM jwks_cache WHERE kid = ? AND expires_at > NOW()',
      [kid]
    );
    
    await connection.end();
    
    if (rows.length > 0) {
      console.log('JWKS-Schlüssel aus Datenbank-Cache geladen:', kid);
      return rows[0].signing_key;
    }
    
    return null;
  } catch (error) {
    console.error('Fehler beim Abrufen des Schlüssels aus dem Cache:', error);
    return null;
  }
}

/**
 * Schlüssel im Datenbank-Cache speichern
 * @param {string} kid - Key ID
 * @param {string} signingKey - Der zu cachende Signaturschlüssel
 */
async function saveKeyToCache(kid, signingKey) {
  try {
    const connection = await getDbConnection();
    
    // Ablaufzeitpunkt berechnen (24 Stunden ab jetzt)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Schlüssel im Cache speichern oder aktualisieren
    await connection.execute(
      'INSERT INTO jwks_cache (kid, signing_key, expires_at) VALUES (?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE signing_key = ?, expires_at = ?',
      [kid, signingKey, expiresAt, signingKey, expiresAt]
    );
    
    await connection.end();
    console.log('JWKS-Schlüssel im Datenbank-Cache gespeichert:', kid);
  } catch (error) {
    console.error('Fehler beim Speichern des Schlüssels im Cache:', error);
  }
}

/**
 * Signaturschlüssel abrufen mit Datenbank-Caching
 */
function getSigningKey(header, callback) {
  // Zuerst versuchen, den Schlüssel aus dem Datenbank-Cache zu laden
  getKeyFromCache(header.kid)
    .then(cachedKey => {
      if (cachedKey) {
        // Wenn der Schlüssel im Cache gefunden wurde, diesen zurückgeben
        return callback(null, cachedKey);
      }
      
      // Wenn nicht im Cache, vom JWKS-Server abrufen
      client.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        
        const signingKey = key.publicKey || key.rsaPublicKey;
        
        // Im Datenbank-Cache speichern für zukünftige Anfragen
        saveKeyToCache(header.kid, signingKey)
          .catch(cacheErr => console.error('Fehler beim Cachen:', cacheErr));
        
        callback(null, signingKey);
      });
    })
    .catch(err => {
      console.error('Fehler beim Abrufen des Cache:', err);
      
      // Bei Fehlern mit dem Cache direkt vom JWKS-Server abrufen
      client.getSigningKey(header.kid, (jwksErr, key) => {
        if (jwksErr) return callback(jwksErr);
        const signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
      });
    });
}

/**
 * JWT-Token verifizieren
 * @param {string} token - Das zu verifizierende JWT-Token
 * @returns {Promise<Object>} - Die decodierten Token-Daten
 */
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `${process.env.AUTH0_DOMAIN}/`,
        algorithms: ['RS256']
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      }
    );
  });
}

/**
 * Prüfen, ob der Benutzer die Rolle 'Vorstand' hat
 * @param {Object} decodedToken - Das decodierte JWT-Token
 * @returns {boolean} - True, wenn der Benutzer die Rolle 'Vorstand' hat
 */
function hasVorstandRole(decodedToken) {
  const namespace = process.env.AUTH0_NAMESPACE || 'https://principiumcanti.de';
  const roles = decodedToken[`${namespace}/roles`] || [];
  return roles.includes('Vorstand');
}

/**
 * Authentifizierung und Autorisierung für Vorstand prüfen
 * @param {Object} event - Netlify Function Event
 * @returns {Promise<Object>} - Authentifizierungsergebnis: { isAuthorized, userId, error }
 */
async function authenticateVorstand(event) {
  try {
    // JWT-Token aus Cookie extrahieren
    const token = extractJwtFromCookie(event);
    if (!token) {
      return { isAuthorized: false, error: 'Kein Authentifizierungstoken gefunden' };
    }
    
    // Token verifizieren
    const decodedToken = await verifyToken(token);
    
    // Prüfen, ob der Benutzer die Rolle 'Vorstand' hat
    if (!hasVorstandRole(decodedToken)) {
      return { isAuthorized: false, error: 'Unzureichende Berechtigungen' };
    }
    
    return { 
      isAuthorized: true, 
      userId: decodedToken.sub,
      email: decodedToken.email,
      name: decodedToken.name
    };
  } catch (error) {
    console.error('Authentifizierungsfehler:', error);
    return { isAuthorized: false, error: error.message };
  }
}

/**
 * HTML für die Login-Seite generieren
 * @param {string} returnUrl - Die URL, zu der nach dem Login zurückgekehrt werden soll
 * @returns {string} - HTML für die Login-Seite
 */
function generateLoginHtml(returnUrl = '/') {
  return `
  <!DOCTYPE html>
  <html lang="de">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Principium Canti</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
      body { 
        padding: 20px; 
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: #f5f5f5;
      }
      .login-container {
        width: 100%;
        max-width: 400px;
        padding: 15px;
        margin: auto;
      }
      .login-title {
        text-align: center;
        margin-bottom: 30px;
      }
    </style>
  </head>
  <body>
    <div class="login-container">
      <h2 class="login-title">Vorstandsbereich - Login</h2>
      <div class="card">
        <div class="card-body">
          <div class="alert alert-info mb-4">
            Bitte melde dich an, um auf den Vorstandsbereich zuzugreifen.
          </div>
          <a href="/api/auth-login?returnUrl=${encodeURIComponent(returnUrl)}" class="btn btn-primary w-100">Anmelden</a>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

module.exports = {
  authenticateVorstand,
  generateLoginHtml
};