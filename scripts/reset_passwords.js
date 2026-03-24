const db = require('./config/db');
const bcrypt = require('bcryptjs');

async function resetPasswords() {
  try {
    const hashedPassword = await bcrypt.hash('admin', 10);
    console.log('New hash for "admin":', hashedPassword);

    const query = 'UPDATE users SET password_hash = $1 WHERE email IN ($2, $3) RETURNING email';
    const result = await db.query(query, [hashedPassword, 'admin@servit.com', 'agente@servit.com']);
    
    console.log('Passwords reset for:');
    console.table(result.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error resetting passwords:', err);
    process.exit(1);
  }
}

resetPasswords();
