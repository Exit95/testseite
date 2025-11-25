# E-Mail-Benachrichtigungen für Buchungen einrichten

## Übersicht
Das Buchungssystem sendet automatisch E-Mail-Benachrichtigungen und erstellt Kalendereinträge (.ics Dateien) bei jeder neuen Buchung.

## Option 1: Resend (Empfohlen - Einfach & Kostenlos)

### 1. Resend Account erstellen
- Gehe zu https://resend.com
- Erstelle einen kostenlosen Account (100 E-Mails/Tag gratis)
- Verifiziere deine Domain oder nutze die Test-Domain

### 2. API-Key erhalten
- Im Resend Dashboard: API Keys → Create API Key
- Kopiere den API-Key

### 3. Resend installieren
```bash
npm install resend
```

### 4. Environment Variable setzen
Erstelle eine `.env` Datei im Projekt-Root:
```
RESEND_API_KEY=re_dein_api_key_hier
```

### 5. Code in `src/pages/api/booking.ts` aktivieren
Entferne die Kommentare (/* */) um den Resend-Code:
```typescript
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'buchungen@auszeit-keramik.de',
  to: 'info@auszeit-keramik.de',
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

---

## Option 2: SendGrid

### 1. SendGrid Account
- Gehe zu https://sendgrid.com
- Erstelle einen Account (100 E-Mails/Tag gratis)

### 2. API-Key erstellen
- Settings → API Keys → Create API Key

### 3. SendGrid installieren
```bash
npm install @sendgrid/mail
```

### 4. Code-Beispiel
```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(import.meta.env.SENDGRID_API_KEY);

await sgMail.send({
  to: 'info@auszeit-keramik.de',
  from: 'buchungen@auszeit-keramik.de',
  subject: emailData.subject,
  html: emailData.html,
  attachments: [
    {
      content: Buffer.from(icalEvent).toString('base64'),
      filename: 'termin.ics',
      type: 'text/calendar',
      disposition: 'attachment',
    },
  ],
});
```

---

## Option 3: Nodemailer (Eigener SMTP-Server)

### 1. Nodemailer installieren
```bash
npm install nodemailer
```

### 2. SMTP-Zugangsdaten
Du brauchst:
- SMTP Host (z.B. smtp.gmail.com)
- SMTP Port (z.B. 587)
- E-Mail-Adresse
- Passwort/App-Passwort

### 3. Code-Beispiel
```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: import.meta.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: import.meta.env.SMTP_USER,
    pass: import.meta.env.SMTP_PASS,
  },
});

await transporter.sendMail({
  from: '"Auszeit Keramik" <buchungen@auszeit-keramik.de>',
  to: 'info@auszeit-keramik.de',
  subject: emailData.subject,
  html: emailData.html,
  text: emailData.text,
  attachments: [
    {
      filename: 'termin.ics',
      content: icalEvent,
      contentType: 'text/calendar',
    },
  ],
});
```

---

## Kalender-Integration

Die `.ics` Datei wird automatisch erstellt und kann:
1. Als E-Mail-Anhang versendet werden
2. Direkt in Google Calendar, Outlook, Apple Calendar importiert werden
3. Automatisch vom E-Mail-Client erkannt werden

### Kalender-Event enthält:
- Datum und Uhrzeit
- Dauer (2 Stunden)
- Teilnehmer-Informationen
- Notizen
- Standort

---

## Nächste Schritte

1. Wähle einen E-Mail-Service (Resend empfohlen)
2. Installiere das entsprechende Package
3. Setze die Environment Variables
4. Aktiviere den Code in `src/pages/api/booking.ts`
5. Teste eine Buchung

## Wichtig für Produktion

- Ändere die E-Mail-Adresse in `src/pages/api/booking.ts` (Zeile 8)
- Setze eine verifizierte Absender-Adresse
- Teste gründlich vor dem Live-Gang
- Überwache die E-Mail-Zustellung

## Support

Bei Fragen zur Einrichtung, siehe:
- Resend Docs: https://resend.com/docs
- SendGrid Docs: https://docs.sendgrid.com
- Nodemailer Docs: https://nodemailer.com

