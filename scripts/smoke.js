const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const http = require('http');
const base = process.env.API_URL || 'http://localhost:3000';
const url = new URL('/health', base).toString();

console.log('[SMOKE] GET', url);

const req = http.get(url, (res) => {
  console.log('[SMOKE] status:', res.statusCode);
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    console.log('[SMOKE] body:', body);
    if (res.statusCode === 200) {
      console.log('SMOKE ok');
      process.exit(0);
    } else {
      console.error('SMOKE falhou:', res.statusCode);
      process.exit(2);
    }
  });
});

req.on('error', (e) => {
  console.error('[SMOKE] erro:', e.message);
  process.exit(1);
});

// Fallback se nada responder
setTimeout(() => {
  console.error('[SMOKE] timeout sem resposta (3s)');
  process.exit(4);
}, 3000);
