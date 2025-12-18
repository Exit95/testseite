const nodemailer = require('nodemailer');

async function testSMTP() {
  console.log('Testing SMTP connection...');
  console.log('Host: 2a01:4f8:202:1129:2447:2447:1:80');
  console.log('Port: 587');
  console.log('User: info@keramik-auszeit.de');
  console.log('Pass: eatEnt,49,%');
  
  const transporter = nodemailer.createTransport({
    host: '2a01:4f8:202:1129:2447:2447:1:80',
    port: 587,
    secure: false,
    auth: {
      user: 'info@keramik-auszeit.de',
      pass: 'eatEnt,49,%',
    },
    tls: {
      rejectUnauthorized: false
    },
    debug: true,
    logger: true
  });

  try {
    console.log('\n=== Verifying connection ===');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    console.log('\n=== Sending test email ===');
    const info = await transporter.sendMail({
      from: '"Test" <info@keramik-auszeit.de>',
      to: 'info@keramik-auszeit.de',
      subject: 'SMTP Test',
      text: 'This is a test email',
    });
    
    console.log('✅ Email sent!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

testSMTP();

