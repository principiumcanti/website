# Verschlüsselung für Mitgliedsanträge

Diese Anleitung beschreibt, wie die Verschlüsselung für die Mitgliedsanträge eingerichtet wird. Die Verschlüsselung erfolgt mit RSA-Schlüsseln, wobei sensible personenbezogene Daten bereits im Browser des Benutzers verschlüsselt werden, bevor sie an den Server gesendet werden.

## Schlüsselgenerierung

Um ein sicheres Schlüsselpaar zu generieren, folge diesen Schritten:

### Option 1: Mit OpenSSL (empfohlen)

1. Öffne ein Terminal
2. Generiere einen neuen privaten Schlüssel mit 2048 Bit:
   ```bash
   openssl genrsa -out private.pem 2048
   ```

3. Extrahiere den öffentlichen Schlüssel aus dem privaten Schlüssel:
   ```bash
   openssl rsa -in private.pem -outform PEM -pubout -out public.pem
   ```

4. Die Dateien `private.pem` und `public.pem` enthalten nun dein Schlüsselpaar.

### Option 2: Mit Node.js

Alternativ kannst du auch Node.js verwenden, um ein Schlüsselpaar zu generieren:

```javascript
const crypto = require('crypto');
const fs = require('fs');

// Generate RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Save keys to files
fs.writeFileSync('public.pem', publicKey);
fs.writeFileSync('private.pem', privateKey);

console.log('RSA Key Pair generated successfully!');
console.log('Public Key:', publicKey);
console.log('Private Key saved to private.pem');
```

Speichere diesen Code in einer Datei (z.B. `generate-keys.js`) und führe sie mit Node.js aus: `node generate-keys.js`

## Einrichtung der Umgebungsvariablen

1. Kopiere die `.env.example` Datei nach `.env`:
   ```bash
   cp .env.example .env
   ```

2. Öffne die neue `.env` Datei und ersetze die Platzhalter mit deinen generierten Schlüsseln:
   - `PUBLIC_KEY`: Der Inhalt der `public.pem` Datei
   - `PRIVATE_KEY`: Der Inhalt der `private.pem` Datei

   **Wichtig**: Achte darauf, das Format mit den Anfangs- und Endzeilen beizubehalten:
   ```
   PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
   MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMI...
   ...
   -----END PUBLIC KEY-----"
   ```

## Sicherheitshinweise

1. **Halte deinen privaten Schlüssel geheim!** Teile ihn niemals und check ihn nicht ins Git-Repository ein.
2. In der Produktion solltest du die Schlüssel nicht in einer `.env`-Datei, sondern als sichere Umgebungsvariablen in Netlify speichern.
3. Verwende eine Schlüssellänge von mindestens 2048 Bit für ausreichende Sicherheit.
4. Rotiere die Schlüssel regelmäßig (z.B. jährlich) für zusätzliche Sicherheit.
5. Achte darauf, dass die alten Schlüssel für eine Übergangszeit verfügbar bleiben, um auf ältere verschlüsselte Daten zugreifen zu können.

## Verwendung

- Der **öffentliche Schlüssel** wird im Frontend genutzt, um sensible Daten zu verschlüsseln, bevor sie an den Server gesendet werden.
- Der **private Schlüssel** wird nur im Backend (Netlify Functions) verwendet, um die verschlüsselten Daten wieder zu entschlüsseln, wenn sie angezeigt werden sollen.

Die Mitgliedsantragsdaten werden in der Datenbank in verschlüsselter Form gespeichert und nur entschlüsselt, wenn ein Administrator mit gültigem Token auf die Übersichtsseite zugreift.