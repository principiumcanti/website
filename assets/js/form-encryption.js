/**
 * Encryption utilities for the membership form
 * Uses the Web Crypto API for hybrid encryption (AES-GCM + RSA-OAEP)
 */

// Öffentlicher Schlüssel wird aus einer Meta-Tag Variable geladen oder aus dem Standard-Wert
let PEM_PUBLIC_KEY = '';

// Versuchen, den öffentlichen Schlüssel aus dem meta-Tag zu holen
document.addEventListener('DOMContentLoaded', function() {
  const metaPublicKey = document.querySelector('meta[name="public-key"]');
  if (metaPublicKey && metaPublicKey.content) {
    PEM_PUBLIC_KEY = metaPublicKey.content;
    console.log("Öffentlicher Schlüssel aus Meta-Tag geladen");
  } else {
    console.error('Kein öffentlicher Schlüssel in den Meta-Tags gefunden!');
  }
});

/**
 * Import a PEM encoded RSA public key, to use for RSA-OAEP encryption
 * @param {string} pem - PEM encoded public key
 * @returns {Promise<CryptoKey>}
 */
async function importPublicKey(pem) {
  try {
    // Remove header, footer, and whitespace
    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    
    // Make sure the key has the correct format with header/footer
    if (!pem.includes(pemHeader) || !pem.includes(pemFooter)) {
      throw new Error("Invalid PEM format: Missing header or footer");
    }
    
    const pemContents = pem.substring(
      pem.indexOf(pemHeader) + pemHeader.length,
      pem.indexOf(pemFooter)
    ).replace(/\s/g, '');
    
    // Base64 decode the string to get the binary data
    const binaryDerString = window.atob(pemContents);
    
    // Convert binary to buffer
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    // Import the key
    return window.crypto.subtle.importKey(
      "spki",
      binaryDer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256"
      },
      false, // whether the key is extractable
      ["encrypt"] // key can only be used for encryption
    );
  } catch (error) {
    console.error("Error importing public key:", error);
    throw error;
  }
}

/**
 * Generate a random AES-GCM key
 * @returns {Promise<CryptoKey>}
 */
async function generateAESKey() {
  return window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Export an AES key to raw bytes
 * @param {CryptoKey} key - The AES key to export
 * @returns {Promise<ArrayBuffer>}
 */
async function exportAESKey(key) {
  return window.crypto.subtle.exportKey("raw", key);
}

/**
 * Encrypt data using hybrid encryption (AES-GCM + RSA-OAEP)
 * 1. Generate random AES key
 * 2. Encrypt data with AES-GCM
 * 3. Encrypt AES key with RSA-OAEP
 * 4. Return encrypted data + encrypted key
 * 
 * @param {string} data - The data to encrypt (as a string)
 * @returns {Promise<Object>} Object with encryptedData and encryptedKey
 */
async function encryptData(data) {
  try {
    console.log("Hybrid Verschlüsselung wird gestartet...");
    
    // 1. Import RSA public key
    const rsaKey = await importPublicKey(PEM_PUBLIC_KEY);
    console.log("RSA-Schlüssel importiert");
    
    // 2. Generate random AES key
    const aesKey = await generateAESKey();
    console.log("AES-Schlüssel generiert");
    
    // 3. Generate random IV for AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes IV for AES-GCM
    
    // 4. Encrypt data with AES-GCM
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    console.log("Daten zu verschlüsseln, Größe:", dataBuffer.byteLength, "Bytes");
    
    const encryptedDataBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128 // 16 Bytes AuthTag
      },
      aesKey,
      dataBuffer
    );
    console.log("Daten mit AES-GCM verschlüsselt");
    
    // 5. Export AES key to raw bytes
    const rawAesKey = await exportAESKey(aesKey);
    console.log("AES-Schlüssel exportiert, Größe:", rawAesKey.byteLength, "Bytes");
    
    // 6. Encrypt AES key with RSA-OAEP
    const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
      {
        name: "RSA-OAEP"
      },
      rsaKey,
      rawAesKey
    );
    console.log("AES-Schlüssel mit RSA-OAEP verschlüsselt");
    
    // 7. Convert encrypted data, encrypted key and IV to Base64
    const base64EncryptedData = arrayBufferToBase64(encryptedDataBuffer);
    const base64EncryptedKey = arrayBufferToBase64(encryptedKeyBuffer);
    const base64Iv = arrayBufferToBase64(iv);
    
    console.log("Verschlüsselung abgeschlossen");
    
    return {
      encryptedData: base64EncryptedData,
      encryptedKey: base64EncryptedKey,
      iv: base64Iv,
      algorithm: "AES-GCM+RSA-OAEP" // Indicate which algorithm was used
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

/**
 * Helper function to convert ArrayBuffer to Base64 string
 * @param {ArrayBuffer} buffer - The buffer to convert
 * @returns {string} - Base64 encoded string
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Prepare form data by encrypting sensitive fields
 * @param {Object} formData - The form data to be encrypted
 * @returns {Promise<Object>} Object with encrypted sensitive data
 */
async function prepareEncryptedFormData(formData) {
  try {
    console.log("Bereite verschlüsselte Formulardaten vor");
    
    // Fields that should be encrypted
    const sensitiveFields = [
      'adresse', 'plz', 'stadt', 'bundesland', 'email', 
      'handynummer', 'kontoinhaber', 'iban', 'bic', 'bank', 'unterschrift'
    ];
    
    // Create a copy of the data to encrypt sensitive fields
    const result = { ...formData };
    
    // Convert sensitive data to JSON and encrypt it as one block
    const sensitiveData = {};
    sensitiveFields.forEach(field => {
      if (formData[field]) {
        sensitiveData[field] = formData[field];
      }
    });
    
    // Encrypt all sensitive data as one JSON string
    const jsonData = JSON.stringify(sensitiveData);
    console.log("JSON-Daten erstellt, Länge:", jsonData.length);
    
    const encryptionResult = await encryptData(jsonData);
    console.log("Daten erfolgreich verschlüsselt");
    
    // Replace individual fields with encrypted data
    sensitiveFields.forEach(field => {
      delete result[field];
    });
    
    // Add the encrypted data
    result.encryptedData = encryptionResult.encryptedData;
    result.encryptedKey = encryptionResult.encryptedKey;
    result.iv = encryptionResult.iv;
    result.encryptionAlgorithm = encryptionResult.algorithm;
    
    // Add non-encrypted fields
    result.vorname = formData.vorname;
    result.nachname = formData.nachname;
    result.beitrag = formData.beitrag;
    result.timestamp = new Date().toISOString();
    
    console.log("Formulardaten fertig vorbereitet:", Object.keys(result));
    return result;
  } catch (error) {
    console.error('Error preparing encrypted form data:', error);
    throw error;
  }
}