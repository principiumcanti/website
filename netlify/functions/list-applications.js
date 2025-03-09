// Function für die Übersicht offener Mitgliedsanträge
const mysql = require('mysql2/promise');
const { decryptData } = require('../utils/crypto-utils');

/**
 * HTML für die Tabellenansicht erstellen
 * @param {Array} applications - Liste der Anträge
 * @returns {string} - HTML-Tabelle
 */
function generateHtml(applications) {
  const tableRows = applications.map(app => `
    <tr>
      <td>${app.id}</td>
      <td>${app.vorname}</td>
      <td>${app.nachname}</td>
      <td>${app.beitrag}€</td>
      <td>${app.bundesland}</td>
      <td>${new Date(app.timestamp).toLocaleString('de-DE')}</td>
      <td>${app.status}</td>
      <td>
        <a href="/api/view-application?id=${app.id}" class="btn btn-sm btn-primary">Details</a>
      </td>
    </tr>
  `).join('');

  return `
  <!DOCTYPE html>
  <html lang="de">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offene Mitgliedsanträge</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
      body { padding: 20px; }
      h1 { margin-bottom: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h1>Offene Mitgliedsanträge</h1>
        <a href="/api/auth-logout" class="btn btn-outline-danger">Abmelden</a>
      </div>
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark">
            <tr>
              <th>ID</th>
              <th>Vorname</th>
              <th>Nachname</th>
              <th>Beitrag</th>
              <th>Bundesland</th>
              <th>Datum</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Netlify Function zum Anzeigen aller Mitgliedsanträge
 */
const { authenticateVorstand, generateLoginHtml } = require('../utils/auth-utils');

exports.handler = async (event, context) => {
  // Auth0-Authentifizierung prüfen
  const authResult = await authenticateVorstand(event);
  
  if (!authResult.isAuthorized) {
    // Wenn nicht authentifiziert, Login-Seite anzeigen
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8'
      },
      body: generateLoginHtml('/api/list-applications')
    };
  }

  // Datenbankverbindung konfigurieren
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  };

  // Überprüfen, ob alle erforderlichen Umgebungsvariablen vorhanden sind
  const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    return {
      statusCode: 500,
      body: `Konfigurationsfehler: Fehlende Umgebungsvariablen: ${missingEnvVars.join(', ')}`
    };
  }

  let connection;

  try {
    // Datenbankverbindung herstellen
    connection = await mysql.createConnection(dbConfig);
    
    // Alle Anträge abrufen
    const [rows] = await connection.execute(
      `SELECT * FROM membership_applications WHERE status = 'submitted' ORDER BY timestamp DESC`
    );
    
    // Anträge verarbeiten und entschlüsseln
    // Antragsdaten für die Übersicht abrufen (nur die notwendigsten Felder entschlüsseln)
    const applications = await Promise.all(rows.map(async (row) => {
      try {
        // Hybrid-verschlüsselte Daten entschlüsseln
        console.log(`Entschlüssele Antrag ${row.id}`);
        const sensitiveData = await decryptData(row.encrypted_data, row.encrypted_key, row.iv);
        
        return {
          id: row.id,
          vorname: row.vorname || '[Nicht angegeben]',
          nachname: row.nachname || '[Nicht angegeben]',
          beitrag: row.beitrag,
          bundesland: sensitiveData.bundesland || '[Nicht angegeben]',
          timestamp: row.timestamp,
          status: row.status,
          // Diese Felder werden nicht in der Übersichtstabelle angezeigt,
          // aber können für die Detailansicht nützlich sein
          rawId: row.id
        };
      } catch (error) {
        console.error(`Fehler bei der Verarbeitung des Antrags ${row.id}:`, error);
        return {
          id: row.id,
          vorname: row.vorname || '[Nicht angegeben]',
          nachname: row.nachname || '[Nicht angegeben]',
          beitrag: row.beitrag,
          bundesland: '[Fehler]',
          timestamp: row.timestamp,
          status: row.status,
          rawId: row.id
        };
      }
    }));
    
    // HTML generieren und zurückgeben
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8'
      },
      body: generateHtml(applications)
    };
    
  } catch (error) {
    console.error('Funktion Fehler:', error);
    return {
      statusCode: 500,
      body: `<html><body><h1>Server-Fehler</h1><p>${error.message}</p></body></html>`,
      headers: { 'Content-Type': 'text/html' }
    };
  } finally {
    // Datenbankverbindung schließen
    if (connection) {
      await connection.end();
    }
  }
};