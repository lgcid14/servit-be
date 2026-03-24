const db = require('./config/db');

async function run() {
    try {
        console.log("Creating media_gallery table...");
        const query = `
            CREATE TABLE IF NOT EXISTS media_gallery (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                url VARCHAR(500) NOT NULL,
                type VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await db.query(query);
        console.log("Migration done!");
    } catch(err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
run();
