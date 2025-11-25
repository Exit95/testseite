# 📧 Email-Benachrichtigung Debugging

## Problem
Die Email-Benachrichtigungen funktionieren nicht bei Buchungen.

## Mögliche Ursachen & Lösungen

### 1. Server muss neu gestartet werden
Nach Änderungen an der `.env` Datei **MUSS** der Server neu gestartet werden!

```bash
# Im Terminal wo der Server läuft:
# Drücke Strg+C um den Server zu stoppen

# Dann neu starten:
npm run dev
```

### 2. Environment-Variablen prüfen
Öffne die Browser-Konsole (F12) nach einer Testbuchung und schaue nach:
- Gibt es Fehlermeldungen?
- Steht dort "SMTP nicht konfiguriert"?

### 3. Server-Logs prüfen
Im Terminal wo `npm run dev` läuft, solltest du nach einer Buchung sehen:
- ✅ "SMTP-Verbindung erfolgreich"
- ✅ "E-Mail erfolgreich gesendet an: ..."

Oder Fehler wie:
- ❌ "SMTP nicht konfiguriert"
- ❌ "Fehler beim E-Mail-Versand: ..."

### 4. SMTP-Einstellungen testen

**Aktuelle Einstellungen in `.env`:**
```
SMTP_HOST=mail.danapfel-digital.de
SMTP_PORT=587
SMTP_USER=office@danapfel-digital.de
SMTP_PASS=:,30,seNDSK
BOOKING_EMAIL=danapfelmichael7@gmail.com
FROM_EMAIL=office@danapfel-digital.de
```

**Prüfe:**
- Ist `mail.danapfel-digital.de` der richtige SMTP-Server?
- Funktioniert die Email `office@danapfel-digital.de`?
- Ist das Passwort korrekt?

### 5. Alternative: Gmail verwenden

Falls der aktuelle SMTP-Server nicht funktioniert, kannst du Gmail verwenden:

**Schritt 1:** Gmail App-Passwort erstellen
1. Gehe zu https://myaccount.google.com/apppasswords
2. Erstelle ein neues App-Passwort für "Mail"
3. Kopiere das 16-stellige Passwort

**Schritt 2:** `.env` Datei ändern
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deine-gmail@gmail.com
SMTP_PASS=dein-app-passwort-hier
BOOKING_EMAIL=deine-gmail@gmail.com
FROM_EMAIL=deine-gmail@gmail.com
```

**Schritt 3:** Server neu starten
```bash
# Strg+C im Terminal
npm run dev
```

## Test-Checkliste

- [ ] `.env` Datei hat alle SMTP-Einstellungen
- [ ] Server wurde nach `.env` Änderungen neu gestartet
- [ ] Testbuchung durchgeführt
- [ ] Server-Logs im Terminal geprüft
- [ ] Browser-Konsole (F12) geprüft
- [ ] Spam-Ordner geprüft

## Nächste Schritte

1. **Server neu starten** (falls noch nicht gemacht)
2. **Testbuchung** durchführen
3. **Terminal-Logs** anschauen - was steht dort?
4. **Mir Bescheid geben** was in den Logs steht, dann kann ich weiterhelfen!

