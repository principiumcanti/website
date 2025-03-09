CREATE DATABASE IF NOT EXISTS principium_members;
USE principium_members;

CREATE TABLE IF NOT EXISTS membership_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vorname VARCHAR(100) NOT NULL,
  nachname VARCHAR(100) NOT NULL,
  encrypted_data TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  encryption_algorithm VARCHAR(50) NOT NULL,
  beitrag INT NOT NULL,
  timestamp DATETIME NOT NULL,
  status VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS jwks_cache (
  kid VARCHAR(100) PRIMARY KEY,
  signing_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);