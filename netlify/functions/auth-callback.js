/**
 * Auth0 Callback Handler - Authorization Code Flow
 * Diese Funktion wird von Auth0 nach erfolgreicher Authentifizierung aufgerufen
 */
const axios = require('axios');
const crypto = require('crypto');

/**
 * Validiert den State-Parameter
 * @param {string} state - Der Base64-codierte State
 * @param {string} secret - Das Geheimnis zur Validierung der Signatur
 * @returns {object|null} - Das decodierte State-Objekt oder null bei Fehler
 */
function validateState(state, secret) {
  try {
    // Base64 decodieren und JSON parsen
    const stateObj = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    
    // Wenn keine Signatur vorhanden ist, ist der State ungültig
    if (!stateObj.sig) {
      console.error('Keine Signatur im State gefunden');
      return null;
    }
    
    // Kopie des State-Objekts ohne Signatur erstellen
    const { sig, ...dataWithoutSig } = stateObj;
    
    // Neue Signatur zum Vergleich erstellen
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(dataWithoutSig));
    const expectedSig = hmac.digest('hex');
    
    // Signatur vergleichen
    if (sig !== expectedSig) {
      console.error('Ungültige State-Signatur, möglicher CSRF-Angriff!');
      return null;
    }
    
    return dataWithoutSig;
  } catch (error) {
    console.error('Fehler beim Validieren des State-Parameters:', error);
    return null;
  }
}

exports.handler = async (event, context) => {
  // Akzeptiere nur GET-Anfragen
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Methode nicht erlaubt'
    };
  }

  // Extrahiere Authorization Code aus Parametern
  const code = event.queryStringParameters?.code;
  const state = event.queryStringParameters?.state;
  const error = event.queryStringParameters?.error;
  
  // Fehlerbehandlung
  if (error) {
    return {
      statusCode: 400,
      body: `<html>
        <head>
          <title>Authentifizierungsfehler</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-5">
          <div class="alert alert-danger">
            <h3>Authentifizierungsfehler</h3>
            <p>${event.queryStringParameters.error_description || error}</p>
            <a href="/" class="btn btn-primary mt-3">Zurück zur Startseite</a>
          </div>
        </body>
      </html>`,
      headers: { 'Content-Type': 'text/html' }
    };
  }
  
  // Prüfe ob Authorization Code vorhanden
  if (!code) {
    return {
      statusCode: 400,
      body: `<html>
        <head>
          <title>Fehler</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-5">
          <div class="alert alert-danger">
            <h3>Fehler</h3>
            <p>Kein Authorization Code von Auth0 erhalten.</p>
            <a href="/" class="btn btn-primary mt-3">Zurück zur Startseite</a>
          </div>
        </body>
      </html>`,
      headers: { 'Content-Type': 'text/html' }
    };
  }
  
  // Prüfe ob State vorhanden und validiere ihn
  if (!state) {
    return {
      statusCode: 400,
      body: `<html>
        <head>
          <title>Fehler</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-5">
          <div class="alert alert-danger">
            <h3>Fehler</h3>
            <p>Kein State-Parameter von Auth0 erhalten.</p>
            <a href="/" class="btn btn-primary mt-3">Zurück zur Startseite</a>
          </div>
        </body>
      </html>`,
      headers: { 'Content-Type': 'text/html' }
    };
  }
  
  // Validiere State und extrahiere returnUrl und nonce
  const signingSecret = process.env.AUTH0_STATE_SIGNING_SECRET;
  const stateData = validateState(state, signingSecret);
  
  if (!stateData) {
    return {
      statusCode: 400,
      body: `<html>
        <head>
          <title>Sicherheitsfehler</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-5">
          <div class="alert alert-danger">
            <h3>Sicherheitsfehler</h3>
            <p>Ungültiger State-Parameter, möglicher CSRF-Angriff.</p>
            <a href="/" class="btn btn-primary mt-3">Zurück zur Startseite</a>
          </div>
        </body>
      </html>`,
      headers: { 'Content-Type': 'text/html' }
    };
  }
  
  const returnUrl = stateData.returnUrl || '/';
  const expectedNonce = stateData.nonce;
  
  try {
    // Prüfe, ob die Domain bereits mit https:// beginnt
    const domain = process.env.AUTH0_DOMAIN.startsWith('https://') 
      ? process.env.AUTH0_DOMAIN 
      : `https://${process.env.AUTH0_DOMAIN}`;
    
    // Tausche den Authorization Code gegen Tokens
    const tokenResponse = await axios.post(`${domain}/oauth/token`, {
      grant_type: 'authorization_code',
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      code: code,
      redirect_uri: `${process.env.URL || 'http://' + event.headers.host}/api/auth-callback`
    });
    
    // Extrahiere Tokens
    const { access_token, id_token, refresh_token } = tokenResponse.data;
    
    // Theoretisch solltest du hier die ID-Token-Signatur verifizieren
    // und prüfen, ob die Nonce im ID-Token mit der erwarteten übereinstimmt
    
    // Setze Cookies für die Tokens
    const cookieOptions = [
      // ID Token Cookie (für Benutzerinfos)
      `PrincipiumCantiIdToken=${id_token}; HttpOnly; Path=/; SameSite=Strict; Secure; Max-Age=${60 * 60 * 24 * 7}`,
      // Access Token Cookie (für API-Zugriff)
      `PrincipiumCantiAccessToken=${access_token}; HttpOnly; Path=/; SameSite=Strict; Secure; Max-Age=${60 * 60 * 24 * 7}`
    ];
    
    // Wenn Refresh Token vorhanden, auch diesen speichern
    if (refresh_token) {
      cookieOptions.push(
        `PrincipiumCantiRefreshToken=${refresh_token}; HttpOnly; Path=/; SameSite=Strict; Secure; Max-Age=${60 * 60 * 24 * 30}`
      );
    }
    
    // Leite zur ursprünglichen URL zurück
    return {
      statusCode: 302,
      headers: {
        'Location': returnUrl,
        'Set-Cookie': cookieOptions,
        'Cache-Control': 'no-cache'
      },
      body: ''
    };
  } catch (error) {
    console.error('Fehler beim Tokenanfrage:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: `<html>
        <head>
          <title>Server-Fehler</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-5">
          <div class="alert alert-danger">
            <h3>Fehler beim Token-Austausch</h3>
            <p>${error.response?.data?.error_description || error.message || 'Unbekannter Fehler'}</p>
            <a href="/" class="btn btn-primary mt-3">Zurück zur Startseite</a>
          </div>
        </body>
      </html>`,
      headers: { 'Content-Type': 'text/html' }
    };
  }
  
  if (state) {
    try {
      // Base64 decodieren und JSON parsen
      const stateObj = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      
      // Signatur überprüfen
      const signingSecret = process.env.AUTH0_STATE_SIGNING_SECRET;
      if (signingSecret && stateObj.sig) {
        // Kopie des State-Objekts ohne Signatur erstellen
        const { sig, ...dataWithoutSig } = stateObj;
        
        // Neue Signatur zum Vergleich erstellen
        const crypto = require('crypto');
        const hmac = crypto.createHmac('sha256', signingSecret);
        hmac.update(JSON.stringify(dataWithoutSig));
        const expectedSig = hmac.digest('hex');
        
        // Signatur vergleichen
        isValidState = sig === expectedSig;
        
        if (isValidState) {
          // State ist gültig, Daten extrahieren
          returnUrl = stateObj.returnUrl || '/';
          expectedNonce = stateObj.nonce || '';
          
          console.log('State validiert:', isValidState);
        } else {
          console.error('Ungültige State-Signatur, möglicher CSRF-Angriff!');
        }
      } else {
        console.error('Signierungsschlüssel fehlt oder State hat keine Signatur!');
      }
    } catch (error) {
      console.error('Fehler beim Parsen/Validieren des State-Parameters:', error);
    }
  }
  
  // Validiere ID Token und Nonce (vereinfacht)
  // Hier würde normalerweise eine vollständige Token-Validierung erfolgen
  // einschließlich Signaturprüfung, Issuer-Validierung, etc.
  if (!isValidState || !expectedNonce) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <head>
            <title>Sicherheitsfehler</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 2rem; line-height: 1.6; }
              .error { color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 1rem; border-radius: 0.25rem; }
            </style>
          </head>
          <body>
            <div class="error">
              <h2>Sicherheitsfehler</h2>
              <p>Die Authentifizierung konnte nicht abgeschlossen werden.</p>
              <p><strong>Fehler:</strong> Ungültiger State-Parameter oder fehlende Nonce.</p>
              <p><a href="/">Zurück zur Startseite</a></p>
            </div>
          </body>
        </html>
      `
    };
  }

};