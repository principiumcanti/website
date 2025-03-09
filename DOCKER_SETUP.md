# Lokales Entwicklungssetup mit Docker

Dieses Projekt verwendet Docker Compose, um ein vollständiges lokales Entwicklungsumfeld mit Jekyll, Netlify Functions und MySQL-Datenbank einzurichten.

## Voraussetzungen

- Docker und Docker Compose installiert
- Git-Repository geklont

## Architektur des lokalen Setups

Das lokale Entwicklungssetup besteht aus vier Containern:

1. **Proxy** (Nginx): Zentraler Reverse-Proxy, der alle Anfragen auf Port 8888 entgegennimmt und an die entsprechenden Services weiterleitet
2. **Web** (Jekyll): Stellt die statische Website bereit
3. **Functions** (Node.js): Hostet die Netlify Functions für API-Endpunkte
4. **Database** (MySQL): Speichert die Mitgliedsanträge und andere Daten

## Einrichtung der Umgebungsvariablen

1. Verwende die vorhandene `.env`-Datei oder kopiere die Beispieldatei `.env.example` zu `.env`:
   ```bash
   cp .env.example .env
   ```

2. Bearbeite die `.env`-Datei und füge die tatsächlichen Werte ein:
   - Setze einen sicheren `ADMIN_TOKEN` für den Zugriff auf die Admin-Übersichtsseite
   - Füge den privaten RSA-Schlüssel für die Entschlüsselung ein
   - Die Datenbankeinstellungen sind bereits für die Docker-Umgebung konfiguriert

## Starten der Entwicklungsumgebung

```bash
docker compose up
```

Das startet alle Container:
- **Proxy**: Nginx-Proxy auf Port 8888 (intern Port 80)
- **Web**: Jekyll-Website auf Port 4000
- **Functions**: API-Server auf Port 8888
- **Database**: MySQL-Datenbank auf Port 3306

## Zugriff auf die Anwendung

Alle Dienste sind über einen einzigen Port (8888) erreichbar:

- Website: http://localhost:8888
- Formular: http://localhost:8888/form
- Mitgliedsanträge-Übersicht: http://localhost:8888/api/list-applications?token=DEIN_ADMIN_TOKEN
- Membership API: http://localhost:8888/api/save-membership

Der Nginx-Proxy leitet die Anfragen entsprechend weiter:
- Alle `/api/*` Pfade werden zum Functions-Container weitergeleitet
- Alle anderen Pfade werden zum Jekyll-Container weitergeleitet

## Datenbank-Zugriff

- Host: localhost
- Port: 3306
- Datenbankname: principium_members
- Benutzer: principium
- Passwort: principium_password

## Datenbankverbindung mit einem Client (z.B. MySQL Workbench)

```
Hostname: 127.0.0.1
Port: 3306
Username: principium
Password: principium_password
Database: principium_members
```

## Funktionsweise des Setups

1. **Reverse-Proxy**: Die `local-reverse-proxy/nginx.conf` Datei konfiguriert Nginx, um die Anfragen an die richtigen Container weiterzuleiten. Der Proxy läuft intern auf Port 80, wird aber nach außen auf Port 8888 gemappt.
2. **Functions-Server**: Der `local-functions-server/server.js` liest die Redirect-Regeln aus der `netlify.toml` Datei und registriert die Netlify Functions als API-Endpunkte.
3. **Jekyll-Server**: Erzeugt die statische Website und hostet sie auf Port 4000.

## Stoppen der Entwicklungsumgebung

```bash
docker compose down
```

Um auch die Datenbankinhalte zu löschen:
```bash
docker compose down -v
```