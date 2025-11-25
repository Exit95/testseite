import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// .env laden
dotenv.config();

console.log('🔍 SMTP-Test wird gestartet...\n');

// Konfiguration anzeigen
console.log('📋 SMTP-Konfiguration:');
console.log('  Host:', process.env.SMTP_HOST);
console.log('  Port:', process.env.SMTP_PORT);
console.log('  User:', process.env.SMTP_USER);
console.log('  Pass:', process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-4) : 'NICHT GESETZT');
console.log('  From:', process.env.FROM_EMAIL);
console.log('  To (Admin):', process.env.BOOKING_EMAIL);
console.log('');

// Transporter erstellen
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  debug: true, // Debug-Modus aktivieren
  logger: true, // Logging aktivieren
});

async function testSMTP() {
  try {
    // 1. Verbindung testen
    console.log('🔌 Teste SMTP-Verbindung...');
    await transporter.verify();
    console.log('✅ SMTP-Verbindung erfolgreich!\n');

    // 2. Test-E-Mail an Admin senden
    console.log('📧 Sende Test-E-Mail an Admin:', process.env.BOOKING_EMAIL);
    const adminResult = await transporter.sendMail({
      from: `"Test Atelier Auszeit" <${process.env.FROM_EMAIL}>`,
      to: process.env.BOOKING_EMAIL,
      subject: 'SMTP Test - Admin E-Mail',
      text: 'Dies ist eine Test-E-Mail an die Admin-Adresse.',
      html: '<h1>SMTP Test</h1><p>Dies ist eine Test-E-Mail an die Admin-Adresse.</p>',
    });

    console.log('✅ Admin-E-Mail gesendet!');
    console.log('📨 Response:', {
      messageId: adminResult.messageId,
      accepted: adminResult.accepted,
      rejected: adminResult.rejected,
      response: adminResult.response,
    });
    console.log('');

    // 3. Test-E-Mail an eine andere Adresse (Gmail zum Testen)
    console.log('📧 Sende Test-E-Mail an Gmail-Test-Adresse...');
    const testResult = await transporter.sendMail({
      from: `"Test Atelier Auszeit" <${process.env.FROM_EMAIL}>`,
      to: 'danapfelmichael7@gmail.com',
      subject: 'SMTP Test - Kunden E-Mail',
      text: 'Dies ist eine Test-E-Mail an eine Gmail-Adresse.',
      html: '<h1>SMTP Test</h1><p>Dies ist eine Test-E-Mail an eine Gmail-Adresse.</p>',
    });

    console.log('✅ Test-E-Mail gesendet!');
    console.log('📨 Response:', {
      messageId: testResult.messageId,
      accepted: testResult.accepted,
      rejected: testResult.rejected,
      response: testResult.response,
    });
    console.log('');

    console.log('🎉 Alle Tests erfolgreich!');
    console.log('');
    console.log('⚠️  WICHTIG: Überprüfen Sie jetzt:');
    console.log('   1. Posteingang von:', process.env.BOOKING_EMAIL);
    console.log('   2. Posteingang von: danapfelmichael7@gmail.com');
    console.log('   3. SPAM-Ordner beider Adressen!');
    console.log('');
    console.log('💡 Wenn die E-Mails nicht ankommen, obwohl "accepted" angezeigt wird,');
    console.log('   liegt das Problem beim SMTP-Server oder den E-Mail-Adressen.');

  } catch (error) {
    console.error('❌ FEHLER beim SMTP-Test:');
    console.error(error);
    console.log('');
    console.log('🔍 Mögliche Ursachen:');
    console.log('   - SMTP-Zugangsdaten falsch');
    console.log('   - SMTP-Server blockiert Verbindungen');
    console.log('   - Port 587 ist blockiert');
    console.log('   - Firewall-Problem');
  }
}

testSMTP();

