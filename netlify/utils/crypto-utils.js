const crypto = require('crypto');

/**
 * Entschlüsseln von hybrid-verschlüsselten Daten (AES-GCM + RSA-OAEP)
 * @param {string} encryptedData - Base64-kodierte verschlüsselte Daten (AES-GCM)
 * @param {string} encryptedKey - Base64-kodierter verschlüsselter AES-Schlüssel (RSA-OAEP)
 * @param {string} iv - Base64-kodierter Initialisierungsvektor für AES-GCM
 * @returns {Object} - Entschlüsselte Daten als Objekt oder Fehlerobjekt
 */
async function decryptData(encryptedData, encryptedKey, iv) {
  try {
    // Prüfen, ob der private Schlüssel vorhanden ist
    if (!process.env.PRIVATE_KEY) {
      console.error('Fehlender privater Schlüssel in Umgebungsvariablen');
      return { error: 'Konfigurationsfehler: Privater Schlüssel fehlt' };
    }
    
    // Konvertieren von Base64 zu Binärdaten
    const encryptedDataBuffer = Buffer.from(encryptedData, 'base64');
    const encryptedKeyBuffer = Buffer.from(encryptedKey, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    
    console.log("Entschlüsselung gestartet - Schritt 1: RSA-Entschlüsselung des AES-Schlüssels");
    
    // 1. Entschlüsseln des AES-Schlüssels mit RSA-OAEP
    const aesKeyBuffer = crypto.privateDecrypt(
      {
        key: process.env.PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedKeyBuffer
    );
    
    console.log("Schritt 2: AES-GCM-Entschlüsselung der Daten");
    
    // 2. Erstellen eines Decipher-Objekts mit AES-GCM und IV
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm', 
      aesKeyBuffer, 
      ivBuffer
    );
    
    // Bei AES-GCM wird der Authentication Tag ans Ende der verschlüsselten Daten angehängt
    // Browser Web Crypto API macht das automatisch, während Node.js ihn separat erwartet.
    // Wir müssen hier den Auth Tag (letzte 16 Bytes) vom Rest der Daten trennen.
    
    // Extrahiere den Authentication Tag (letzte 16 Bytes)
    const authTagLength = 16; // 16 Bytes für 128 bit tag
    const contentLength = encryptedDataBuffer.length - authTagLength;
    
    // Trenne Inhalt und Auth Tag
    const content = encryptedDataBuffer.slice(0, contentLength);
    const authTag = encryptedDataBuffer.slice(contentLength);
    
    // Setze den Authentication Tag
    decipher.setAuthTag(authTag);
    
    // 3. Entschlüsseln der Daten
    let decrypted = decipher.update(content);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    console.log("Entschlüsselung abgeschlossen");
    
    // 4. Entschlüsselte Daten als JSON zurückgeben
    return JSON.parse(decrypted.toString('utf8'));
  } catch (error) {
    console.error('Fehler bei der Entschlüsselung:', error);
    return { error: 'Entschlüsselungsfehler: ' + error.message };
  }
}

module.exports = {
  decryptData
};