// Function für die Detailansicht eines Mitgliedsantrags
const mysql = require('mysql2/promise');
const { decryptData } = require('../utils/crypto-utils');
const { isValidIBAN, electronicFormatIBAN } = require('ibantools');
const { bankDataByIBAN } = require('bankdata-germany');
const { isValidIBAN: isValidIBANGermany } = require('ibantools-germany');

/**
 * HTML für die Detailansicht erstellen
 * @param {Object} application - Die Antragsdaten
 * @returns {string} - HTML für die Detailansicht
 */
function generateDetailHtml(application, sensitiveData) {
  const sensitiveFields = [
    { label: 'Vorname', value: application.vorname || '-' },
    { label: 'Nachname', value: application.nachname || '-' },
    { label: 'Adresse', value: sensitiveData.adresse || '-' },
    { label: 'PLZ', value: sensitiveData.plz || '-' },
    { label: 'Stadt', value: sensitiveData.stadt || '-' },
    { label: 'Bundesland', value: sensitiveData.bundesland || '-' },
    { label: 'E-Mail', value: sensitiveData.email || '-' },
    { label: 'Handynummer', value: sensitiveData.handynummer ? `+49 ${sensitiveData.handynummer}` : '-' }
  ];
  
  // Validiere die IBAN und hole die Bankdaten
  let ibanStatus = '❌';
  let bicStatus = '❌';
  let bankStatus = '❌';
  let bankDetails = null;
  
  if (sensitiveData.iban) {
    // Validiere IBAN mit beiden Libraries
    const isValid = isValidIBAN(sensitiveData.iban);
    
    if (isValid) {
      ibanStatus = '✅';
      
      // Hole Bankdaten zur IBAN
      try {
        bankDetails = bankDataByIBAN(sensitiveData.iban);
        
        // Prüfe BIC
        if (bankDetails && bankDetails.bic && sensitiveData.bic) {
          if (bankDetails.bic.toLowerCase() === sensitiveData.bic.toLowerCase()) {
            bicStatus = '✅';
          }
        }
        
        // Prüfe Bankname
        if (bankDetails && bankDetails.bankName && sensitiveData.bank) {
          // Prüfe, ob der angegebene Bankname im tatsächlichen Banknamen enthalten ist oder umgekehrt
          const enteredBank = sensitiveData.bank.toLowerCase();
          const actualBank = bankDetails.bankName.toLowerCase();
          
          if (actualBank.includes(enteredBank) || enteredBank.includes(actualBank)) {
            bankStatus = '✅';
          }
        }
      } catch (error) {
        console.error('Fehler beim Abrufen der Bankdaten:', error);
      }
    }
  }
  
  const bankFields = [
    { label: 'Kontoinhaber', value: sensitiveData.kontoinhaber || '-' },
    { 
      label: 'IBAN', 
      value: sensitiveData.iban ? `${sensitiveData.iban} ${ibanStatus}` : '-' 
    },
    { 
      label: 'BIC', 
      value: sensitiveData.bic ? `${sensitiveData.bic} ${bicStatus}` : '-',
      tooltip: bankDetails?.bic ? `Tatsächliche BIC: ${bankDetails.bic}` : null
    },
    { 
      label: 'Bank', 
      value: sensitiveData.bank ? `${sensitiveData.bank} ${bankStatus}` : '-',
      tooltip: bankDetails?.bankName ? `Tatsächliche Bank: ${bankDetails.bankName}` : null
    },
    { label: 'Beitrag', value: `${application.beitrag}€` }
  ];
  
  // Status-Emoji basierend auf dem Status des Antrags
  let statusEmoji = '❓'; // Fragezeichen für offene Anträge (Standardwert)
  if (application.status === 'approved') {
    statusEmoji = '✅'; // Grüner Haken für angenommene Anträge
  } else if (application.status === 'rejected') {
    statusEmoji = '❌'; // Rotes X für abgelehnte Anträge
  }
  
  const generalFields = [
    { label: 'Antrags-ID', value: application.id },
    { label: 'Datum', value: new Date(application.timestamp).toLocaleString('de-DE') },
    { label: 'Status', value: `${statusEmoji} ${application.status}` }
  ];
  
  const sensitiveFieldsHtml = sensitiveFields.map(field => `
    <div class="row mb-2">
      <div class="col-md-4 fw-bold">${field.label}:</div>
      <div class="col-md-8">${field.value}</div>
    </div>
  `).join('');
  
  const bankFieldsHtml = bankFields.map(field => `
    <div class="row mb-2">
      <div class="col-md-4 fw-bold">${field.label}:</div>
      <div class="col-md-8">
        ${field.value}
        ${field.tooltip ? `<span class="ms-2 text-muted" data-bs-toggle="tooltip" title="${field.tooltip}"><i class="bi bi-info-circle"></i></span>` : ''}
      </div>
    </div>
  `).join('');
  
  const generalFieldsHtml = generalFields.map(field => `
    <div class="row mb-2">
      <div class="col-md-4 fw-bold">${field.label}:</div>
      <div class="col-md-8">${field.value}</div>
    </div>
  `).join('');

  // Unterschrift als Bild anzeigen, falls vorhanden
  let signatureHtml = '';
  if (sensitiveData.unterschrift) {
    signatureHtml = `
      <div class="row mb-3">
        <div class="col-md-4 fw-bold">Unterschrift:</div>
        <div class="col-md-8">
          <img src="${sensitiveData.unterschrift}" alt="Unterschrift" class="img-fluid border" style="max-width: 300px;">
        </div>
      </div>
    `;
  }
  
  return `
  <!DOCTYPE html>
  <html lang="de">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mitgliedsantrag Details</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">
    <style>
      body { padding: 20px; }
      h1 { margin-bottom: 10px; }
      .antrag-info { 
        background-color: #f8f9fa; 
        padding: 10px; 
        border-radius: 6px; 
        margin-bottom: 20px;
        display: flex;
        flex-wrap: wrap;
      }
      .antrag-info-item {
        margin-right: 24px;
      }
      .antrag-info-label {
        font-weight: bold;
        margin-right: 5px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h1>Mitgliedsantrag Details</h1>
        <a href="/api/list-applications" class="btn btn-secondary">Zurück zur Übersicht</a>
      </div>
      
      <div class="antrag-info">
        <div class="antrag-info-item">
          <span class="antrag-info-label">Antrags-ID:</span>
          <span>${application.id}</span>
        </div>
        <div class="antrag-info-item">
          <span class="antrag-info-label">Datum:</span>
          <span>${new Date(application.timestamp).toLocaleString('de-DE')}</span>
        </div>
        <div class="antrag-info-item">
          <span class="antrag-info-label">Status:</span>
          <span>${statusEmoji} ${application.status}</span>
        </div>
      </div>
      
      <div class="card mb-4">
        <div class="card-header bg-primary text-white">
          Persönliche Daten
        </div>
        <div class="card-body">
          ${sensitiveFieldsHtml}
          ${signatureHtml}
        </div>
      </div>
      
      <div class="card mb-4">
        <div class="card-header bg-primary text-white">
          Zahlungsdaten
        </div>
        <div class="card-body">
          ${bankFieldsHtml}
        </div>
      </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
      // Initialisiere Bootstrap Tooltips
      document.addEventListener('DOMContentLoaded', function() {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function(tooltipTriggerEl) {
          return new bootstrap.Tooltip(tooltipTriggerEl);
        });
      });
    </script>
  </body>
  </html>
  `;
}

/**
 * Netlify Function zum Anzeigen eines einzelnen Mitgliedsantrags
 */
const { authenticateVorstand, generateLoginHtml } = require('../utils/auth-utils');

exports.handler = async (event, context) => {
  // Parameter aus der Anfrage extrahieren
  const applicationId = event.queryStringParameters?.id;
  const currentUrl = event.path + (event.rawQuery ? `?${event.rawQuery}` : '');
  
  // Auth0-Authentifizierung prüfen
  const authResult = await authenticateVorstand(event);
  
  if (!authResult.isAuthorized) {
    // Wenn nicht authentifiziert, Login-Seite anzeigen
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8'
      },
      body: generateLoginHtml(currentUrl)
    };
  }
  
  // Prüfen, ob eine Antrags-ID angegeben wurde
  if (!applicationId) {
    return {
      statusCode: 400,
      body: 'Keine Antrags-ID angegeben'
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
    
    // Antrag mit der angegebenen ID abrufen
    const [rows] = await connection.execute(
      `SELECT * FROM membership_applications WHERE id = ?`,
      [applicationId]
    );
    
    // Prüfen, ob der Antrag gefunden wurde
    if (rows.length === 0) {
      return {
        statusCode: 404,
        body: `Antrag mit ID ${applicationId} nicht gefunden`
      };
    }
    
    const application = rows[0];
    
    // Verschlüsselte Daten entschlüsseln
    console.log(`Entschlüssele Detailansicht für Antrag ${application.id}`);
    const sensitiveData = await decryptData(
      application.encrypted_data, 
      application.encrypted_key, 
      application.iv
    );
    
    // Prüfen, ob die Entschlüsselung erfolgreich war
    if (sensitiveData.error) {
      return {
        statusCode: 500,
        body: `<html><body><h1>Entschlüsselungsfehler</h1><p>${sensitiveData.error}</p><a href="/api/list-applications">Zurück zur Übersicht</a></body></html>`,
        headers: { 'Content-Type': 'text/html' }
      };
    }
    
    // HTML generieren und zurückgeben
    const html = generateDetailHtml({
      ...application
    }, sensitiveData);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8'
      },
      body: html
    };
    
  } catch (error) {
    console.error('Funktion Fehler:', error);
    return {
      statusCode: 500,
      body: `<html><body><h1>Server-Fehler</h1><p>${error.message}</p><a href="/api/list-applications">Zurück zur Übersicht</a></body></html>`,
      headers: { 'Content-Type': 'text/html' }
    };
  } finally {
    // Datenbankverbindung schließen
    if (connection) {
      await connection.end();
    }
  }
};