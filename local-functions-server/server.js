const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const toml = require('toml');

// Express-App erstellen und Middleware konfigurieren
const app = express();
app.use(cors());
app.use(express.json());

// Netlify Konfiguration lesen
const netlifyTomlPath = path.join(__dirname, '..', 'netlify.toml');
const netlifyConfig = toml.parse(fs.readFileSync(netlifyTomlPath, 'utf-8'));

// Redirects aus netlify.toml extrahieren
const redirects = netlifyConfig.redirects || [];
console.log('Gefundene Redirects:', redirects);

// Netlify Functions-Verzeichnis
const functionsDir = path.join(__dirname, '..', 'netlify', 'functions');

// Funktion zum Löschen des require-Cache für ein Modul und seine Abhängigkeiten
function clearRequireCache(modulePath) {
  // Modul aus dem Cache entfernen
  if (require.cache[modulePath]) {
    delete require.cache[modulePath];
    console.log(`Cache gelöscht für: ${modulePath}`);
  }
}

// Routen für jede Funktion registrieren
fs.readdirSync(functionsDir).forEach(file => {
  if (file.endsWith('.js')) {
    const functionName = file.replace('.js', '');
    const functionPath = path.join(functionsDir, file);
    
    // Bei Nodemon ist dies nicht unbedingt nötig, aber eine zusätzliche Sicherheit
    clearRequireCache(functionPath);
    
    // Funktion dynamisch laden
    const func = require(functionPath);
    
    console.log(`Registriere Funktion: ${functionName}`);
    
    // Für jeden Redirect prüfen, ob es ein Functions-Redirect ist
    redirects.forEach(redirect => {
      if (redirect.to && redirect.to.includes('/.netlify/functions/')) {
        // "from" Pfad aus netlify.toml (z.B. "/api/*")
        const fromPattern = redirect.from;
        
        // Stern durch Funktionsname ersetzen
        const routePath = fromPattern.replace('*', functionName);
        
        console.log(`Mapping Route ${routePath} zu Funktion ${functionName}`);
        
        app.all(routePath, async (req, res) => {
          try {
            // Netlify Functions-Event-Objekt simulieren
            const event = {
              httpMethod: req.method,
              path: req.path,
              headers: req.headers,
              queryStringParameters: req.query,
              body: JSON.stringify(req.body),
              isBase64Encoded: false
            };
            
            console.log(`Aufruf von ${routePath} mit Methode ${req.method}`);
            
            // In der Entwicklung Funktion neu laden für jeden Request
            clearRequireCache(functionPath);
            const freshFunc = require(functionPath);
            
            // Funktion ausführen
            const result = await freshFunc.handler(event);
            
            // Antwort senden
            res.status(result.statusCode || 200)
               .set(result.headers || {})
               .send(result.body);
          } catch (error) {
            console.error(`Fehler in Funktion ${functionName}:`, error);
            res.status(500).send({
              error: 'Interner Serverfehler',
              message: error.toString()
            });
          }
        });
      }
    });
  }
});

// Server starten
const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`Functions-Server läuft auf Port ${PORT}`);
  console.log(`API-Endpunkte gemäß netlify.toml Redirects konfiguriert`);
});