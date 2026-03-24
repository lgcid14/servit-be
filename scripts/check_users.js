const db = require('./config/db');

async function checkUsers() {
  try {
    const result = await db.query('SELECT id, email, role FROM users');
    console.log('Registered Users:');
    console.table(result.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error querying users:', err);
    process.exit(1);
  }
}

checkUsers();
