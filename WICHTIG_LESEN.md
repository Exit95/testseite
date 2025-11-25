# ⚠️ WICHTIG: Letzte Schritte zur Aktivierung

## 🔧 Was noch zu tun ist:

### 1. SMTP-Passwort eintragen

Öffne die Datei `.env` und trage dein E-Mail-Passwort ein:

```bash
SMTP_PASS=DEIN_PASSWORT_HIER
```

**Wichtig:** Ersetze `DEIN_PASSWORT_HIER` mit deinem echten Passwort!

### 2. Server neu starten

Nach dem Eintragen des Passworts:

```bash
# Server stoppen (Strg+C im Terminal)
# Dann neu starten:
npm run dev
```

### 3. Testen

1. **Admin-Panel öffnen:** http://localhost:4321/admin
   - Login: `admin` / `admin123`
   - Termin hinzufügen (z.B. morgen, 14:00, 15 Plätze)

2. **Hauptseite öffnen:** http://localhost:4321
   - Zum Kalender scrollen
   - Tag mit Termin anklicken
   - Uhrzeit auswählen
   - Formular ausfüllen
   - Buchen

3. **E-Mail prüfen:**
   - Du solltest eine E-Mail an `office@danapfel-digital.de` erhalten
   - Mit Kalender-Anhang (.ics Datei)

---

## 🐛 Fehlerbehebung

### Problem: "Es ist ein Fehler aufgetreten"

**Lösung 1: Passwort prüfen**
- Ist das SMTP_PASS in der .env Datei korrekt?
- Keine Leerzeichen vor/nach dem Passwort?

**Lösung 2: Server-Logs prüfen**
- Schau ins Terminal wo `npm run dev` läuft
- Siehst du Fehlermeldungen?
- Steht dort "SMTP-Verbindung erfolgreich"?

**Lösung 3: SMTP-Einstellungen prüfen**
- Ist `mail.danapfel-digital.de` der richtige Server?
- Ist Port 587 korrekt?
- Funktioniert die E-Mail-Adresse `office@danapfel-digital.de`?

### Problem: E-Mail kommt nicht an

**Prüfe:**
1. Spam-Ordner
2. Server-Logs (Terminal)
3. SMTP-Einstellungen beim Provider

### Problem: Plätze werden nicht abgezogen

**Lösung:**
- Prüfe ob der `data/` Ordner existiert
- Prüfe ob `data/bookings.json` erstellt wird
- Schau in die Browser-Konsole (F12) auf Fehler

---

## 📧 SMTP-Einstellungen für andere Provider

Falls `mail.danapfel-digital.de` nicht funktioniert, kannst du auch Gmail verwenden:

### Gmail:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deine-email@gmail.com
SMTP_PASS=app-passwort-hier
```

**Wichtig:** Bei Gmail brauchst du ein App-Passwort!
Siehe: https://myaccount.google.com/apppasswords

### Andere Provider:
Siehe `SMTP_EINRICHTUNG.md` für Details zu:
- Outlook/Hotmail
- Yahoo
- 1&1/IONOS
- Strato

---

## ✅ Checkliste

- [ ] SMTP_PASS in .env eingetragen
- [ ] Server neu gestartet
- [ ] Admin-Panel: Termin erstellt
- [ ] Hauptseite: Termin sichtbar
- [ ] Testbuchung durchgeführt
- [ ] E-Mail erhalten
- [ ] Kalender-Anhang funktioniert
- [ ] Plätze werden korrekt abgezogen

---

## 🚀 Deployment (später)

Wenn alles lokal funktioniert, kannst du die Seite deployen:

### Vercel/Netlify:
1. Environment Variables im Dashboard setzen:
   - `ADMIN_PASSWORD`
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `BOOKING_EMAIL`
   - `FROM_EMAIL`

2. **Wichtig:** Für Produktion brauchst du eine Datenbank!
   - Aktuell werden Daten in JSON-Dateien gespeichert
   - Das funktioniert nicht auf Serverless-Plattformen
   - Empfehlung: MongoDB, PostgreSQL, oder Supabase

---

## 📞 Support

Bei Problemen:
1. Prüfe die Server-Logs (Terminal)
2. Prüfe die Browser-Konsole (F12)
3. Siehe `SMTP_EINRICHTUNG.md` für Details
4. Siehe `CHANGELOG.md` für alle Änderungen

---

## 🎨 Nächste Schritte

Nach erfolgreicher Einrichtung:
- [ ] Echte Termine im Admin-Panel erstellen
- [ ] Testbuchungen durchführen
- [ ] E-Mail-Empfang testen
- [ ] Kalender-Import testen
- [ ] Backup-Strategie für `data/` Ordner
- [ ] Deployment vorbereiten

