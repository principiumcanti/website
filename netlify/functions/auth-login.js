/**
 * Auth0 Login-Handler
 * Leitet zum Auth0 Login weiter
 */
const crypto = require('crypto');

// Signatur für den State erzeugen
function signState(data, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(data));
  const signature = hmac.digest('hex');
  
  // Daten + Signatur zurückgeben
  return {
    ...data,
    sig: signature
  };
}

exports.handler = async (event, context) => {
  // Akzeptiere nur GET-Anfragen
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Methode nicht erlaubt'
    };
  }

  // Extrahiere Return-URL aus Parametern
  const returnUrl = event.queryStringParameters?.returnUrl || '/';

  // Prüfe, ob ein Signierungsschlüssel vorhanden ist
  const signingSecret = process.env.AUTH0_STATE_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('Sicherheitsfehler: AUTH0_STATE_SIGNING_SECRET nicht konfiguriert!');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <head>
            <title>Konfigurationsfehler</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 2rem; line-height: 1.6; }
              .error { color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 1rem; border-radius: 0.25rem; }
            </style>
          </head>
          <body>
            <div class="error">
              <h2>Sicherheitskonfiguration unvollständig</h2>
              <p>Der Auth0-Login wurde nicht korrekt konfiguriert. Bitte kontaktieren Sie den Administrator.</p>
              <p><strong>Fehler:</strong> Fehlender Signierungsschlüssel</p>
            </div>
          </body>
        </html>
      `
    };
  }
  
  // Generiere zufällige Nonce für OIDC-Sicherheit
  const crypto = require('crypto');
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // State mit ReturnURL und Nonce erstellen und signieren
  const stateData = { returnUrl, nonce };
  const signedState = signState(stateData, signingSecret);
  const state = Buffer.from(JSON.stringify(signedState)).toString('base64');
  
  // Prüfe, ob die Domain bereits mit https:// beginnt
  const domain = process.env.AUTH0_DOMAIN.startsWith('https://') 
    ? process.env.AUTH0_DOMAIN 
    : `https://${process.env.AUTH0_DOMAIN}`;
    
  // Auth0 Login-URL erstellen
  const authUrl = new URL(`${domain}/authorize`);
  
  // Parameter für Auth0 setzen - Authorization Code Flow
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', `${process.env.URL || 'http://' + event.headers.host}/api/auth-callback`);
  authUrl.searchParams.set('scope', 'openid profile email offline_access read:roles read:client_grants');  // offline_access für Refresh Token
  authUrl.searchParams.set('audience', process.env.AUTH0_AUDIENCE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);

  // Zur Auth0 Login-Seite weiterleiten
  return {
    statusCode: 302,
    headers: {
      'Location': authUrl.toString(),
      'Cache-Control': 'no-cache'
    },
    body: ''
  };
};