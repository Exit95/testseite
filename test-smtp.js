import nodemailer from 'nodemailer';
import { readFileSync } from 'fs';

// .env manuell laden
const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});
process.env = { ...process.env, ...envVars };

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

// Teste verschiedene Ports
const ports = [
  { port: 993, secure: true, name: 'IMAPS (993)' },
  { port: 143, secure: false, name: 'IMAP (143)' },
  { port: 587, secure: false, name: 'STARTTLS (587)' },
  { port: 465, secure: true, name: 'SSL (465)' },
  { port: 25, secure: false, name: 'Standard (25)' },
];

async function testPort(portConfig) {
  console.log(`\n🔌 Teste ${portConfig.name}...`);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: portConfig.port,
    secure: portConfig.secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    debug: true,
    logger: true,
    // Selbstsigniertes Zertifikat des Mailservers akzeptieren
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
}

async function testSMTP() {
  let workingTransporter = null;

  // Teste alle Ports
  for (const portConfig of ports) {
    try {
      const transporter = await testPort(portConfig);
      await transporter.verify();
      console.log(`✅ ${portConfig.name} funktioniert!\n`);
      workingTransporter = transporter;
      break; // Ersten funktionierenden Port verwenden
    } catch (error) {
      console.log(`❌ ${portConfig.name} fehlgeschlagen:`, error.message);
    }
  }

  if (!workingTransporter) {
    console.error('\n❌ KEIN SMTP-Port funktioniert!');
    console.log('\n🔍 Mögliche Ursachen:');
    console.log('   - SMTP-Server ist down');
    console.log('   - Firewall blockiert alle SMTP-Ports');
    console.log('   - SMTP-Zugangsdaten sind falsch');
    console.log('   - Server-IP ist geblockt');
    return;
  }

  try {
    const transporter = workingTransporter;

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

