/**
 * Auth0 Logout-Handler
 * Löscht den Cookie und leitet zu Auth0 Logout weiter
 */
exports.handler = async (event, context) => {
  // Akzeptiere nur GET-Anfragen
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Methode nicht erlaubt'
    };
  }

  // Wir müssen alle Cookies löschen (ID Token, Access Token und Refresh Token)
  const expiredCookies = [
    'PrincipiumCantiIdToken=; HttpOnly; Path=/; SameSite=Strict; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'PrincipiumCantiAccessToken=; HttpOnly; Path=/; SameSite=Strict; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'PrincipiumCantiRefreshToken=; HttpOnly; Path=/; SameSite=Strict; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ];

  // Prüfe, ob die Domain bereits mit https:// beginnt
  const domain = process.env.AUTH0_DOMAIN.startsWith('https://') 
    ? process.env.AUTH0_DOMAIN 
    : `https://${process.env.AUTH0_DOMAIN}`;
    
  // Auth0 Logout-URL erstellen
  const logoutUrl = new URL(`${domain}/v2/logout`);
  
  // Parameter für Auth0 setzen
  logoutUrl.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID);
  logoutUrl.searchParams.set('returnTo', `${process.env.URL || 'http://' + event.headers.host}`);

  // Zur Auth0 Logout-Seite weiterleiten
  return {
    statusCode: 302,
    headers: {
      'Location': logoutUrl.toString(),
      'Set-Cookie': expiredCookies,
      'Cache-Control': 'no-cache'
    },
    body: ''
  };
};