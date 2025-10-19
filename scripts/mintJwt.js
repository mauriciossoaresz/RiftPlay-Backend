// uso: node scripts/mintJwt.js SEU_USER_ID SEU_TEAM_ID SEU_JWT_SECRET
const jwt = require('jsonwebtoken');
const [userId, teamId, secret] = process.argv.slice(2);
if (!userId || !teamId || !secret) {
  console.error('uso: node scripts/mintJwt.js <userId> <teamId> <secret>');
  process.exit(1);
}
const token = jwt.sign({ sub: userId, teamId, role: 'captain', isCaptain: true }, secret, { expiresIn: '1h' });
console.log(token);
