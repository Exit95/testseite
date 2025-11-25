# Buchungssystem mit E-Mail-Benachrichtigungen

## ✅ Was wurde implementiert?

Das Buchungssystem wurde erweitert um:

1. **Automatische E-Mail-Benachrichtigungen** bei jeder neuen Buchung
2. **Kalender-Einträge (.ics Dateien)** die automatisch erstellt werden
3. **API-Endpoint** (`/api/booking`) für die Verarbeitung von Buchungen
4. **Fehlerbehandlung** mit Benutzer-Feedback

## 📋 Wie funktioniert es?

### Ablauf einer Buchung:

1. Kunde wählt Datum und Uhrzeit im Kalender
2. Kunde füllt das Buchungsformular aus
3. Beim Absenden wird die Buchung an `/api/booking` gesendet
4. Der Server:
   - Erstellt eine E-Mail-Benachrichtigung
   - Generiert einen Kalender-Eintrag (.ics Datei)
   - Sendet beides per E-Mail an deine Adresse
5. Kunde erhält Bestätigungsmeldung

## 🚀 Einrichtung (Schritt für Schritt)

### Schritt 1: E-Mail-Service wählen

Ich empfehle **Resend** (kostenlos, einfach, zuverlässig):

#### Resend einrichten:

1. **Account erstellen:**
   - Gehe zu https://resend.com
   - Registriere dich (kostenlos - 100 E-Mails/Tag)

2. **API-Key erhalten:**
   - Im Dashboard: "API Keys" → "Create API Key"
   - Kopiere den Key (beginnt mit `re_`)

3. **Resend installieren:**
   ```bash
   npm install resend
   ```

4. **Environment-Variable setzen:**
   - Kopiere `.env.example` zu `.env`:
     ```bash
     cp .env.example .env
     ```
   - Öffne `.env` und füge ein:
     ```
     RESEND_API_KEY=re_dein_api_key_hier
     BOOKING_EMAIL=info@auszeit-keramik.de
     FROM_EMAIL=buchungen@auszeit-keramik.de
     ```

5. **Code aktivieren:**
   - Öffne `src/pages/api/booking.ts`
   - Füge ganz oben hinzu:
     ```typescript
     import { Resend } from 'resend';
     ```
   - Ersetze den Kommentar-Block (Zeile 68-83) mit:
     ```typescript
     const resend = new Resend(import.meta.env.RESEND_API_KEY);
     
     await resend.emails.send({
       from: emailData.from,
       to: emailData.to,
       subject: emailData.subject,
       html: emailData.html,
       attachments: [
         {
           filename: 'termin.ics',
           content: Buffer.from(icalEvent).toString('base64'),
         },
       ],
     });
     ```

### Schritt 2: Testen

1. **Development-Server starten:**
   ```bash
   npm run dev
   ```

2. **Testbuchung durchführen:**
   - Öffne http://localhost:4321
   - Scrolle zum Kalender
   - Wähle ein Datum und eine Uhrzeit
   - Fülle das Formular aus
   - Klicke "Verbindlich buchen"

3. **Prüfen:**
   - Du solltest eine E-Mail erhalten
   - Die E-Mail enthält alle Buchungsdetails
   - Der Kalender-Eintrag (.ics) ist angehängt

### Schritt 3: Deployment

Wenn du auf Vercel, Netlify oder einem anderen Host deployst:

1. **Environment-Variablen setzen:**
   - Im Hosting-Dashboard: Settings → Environment Variables
   - Füge hinzu:
     - `RESEND_API_KEY`
     - `BOOKING_EMAIL`
     - `FROM_EMAIL`

2. **Deployen:**
   ```bash
   git add .
   git commit -m "Add email notifications for bookings"
   git push
   ```

## 📧 E-Mail-Inhalt

Jede Buchungs-E-Mail enthält:

- **Name** des Kunden
- **E-Mail-Adresse** des Kunden
- **Telefonnummer** (falls angegeben)
- **Anzahl Personen**
- **Datum** und **Uhrzeit**
- **Notizen** (falls angegeben)
- **Kalender-Eintrag** (.ics Datei zum Importieren)

## 📅 Kalender-Eintrag

Der automatisch erstellte Kalender-Eintrag:

- **Dauer:** 2 Stunden
- **Titel:** "Keramik-Termin: [Kundenname]"
- **Beschreibung:** Alle Buchungsdetails
- **Ort:** Auszeit Keramik Malatelier
- **Status:** Bestätigt

Kann importiert werden in:
- Google Calendar
- Outlook
- Apple Calendar
- Alle anderen iCal-kompatiblen Kalender

## 🔧 Anpassungen

### E-Mail-Adresse ändern:

In `.env`:
```
BOOKING_EMAIL=deine-neue-email@example.com
```

### E-Mail-Design anpassen:

In `src/pages/api/booking.ts` → `emailData.html`

### Kalender-Dauer ändern:

In `src/pages/api/booking.ts`, Zeile 42:
```typescript
const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // 2 Stunden
// Ändere zu 3 Stunden:
const endDate = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000);
```

## ❓ Häufige Fragen

**Q: Kostet das etwas?**
A: Resend ist kostenlos für bis zu 100 E-Mails pro Tag.

**Q: Was passiert, wenn die E-Mail nicht gesendet werden kann?**
A: Der Kunde sieht eine Fehlermeldung und kann es erneut versuchen.

**Q: Kann ich mehrere E-Mail-Adressen benachrichtigen?**
A: Ja, ändere in `booking.ts`:
```typescript
to: ['email1@example.com', 'email2@example.com']
```

**Q: Wie kann ich die E-Mails testen ohne echte E-Mails zu senden?**
A: Nutze Resend's Test-Modus oder schaue in die Browser-Konsole (die Daten werden geloggt).

## 📚 Weitere Optionen

Detaillierte Anleitungen für andere E-Mail-Services findest du in `EMAIL_SETUP.md`.

## 🆘 Support

Bei Problemen:
1. Prüfe die Browser-Konsole auf Fehler
2. Prüfe die Server-Logs
3. Stelle sicher, dass alle Environment-Variablen gesetzt sind
4. Teste den API-Endpoint direkt mit einem Tool wie Postman

