const db = require('../config/db');

class Repository {
    constructor(tableName, mapping = {}) {
        this.tableName = tableName;
        this.mapping = mapping; // Maps JS fields to SQL columns if needed
    }

    async getAll() {
        const result = await db.query(`SELECT * FROM "${this.tableName}"`);
        return result.rows;
    }

    async findById(id) {
        const result = await db.query(`SELECT * FROM "${this.tableName}" WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }

    async findByEmail(email) {
        const result = await db.query(`SELECT * FROM "${this.tableName}" WHERE email = $1`, [email]);
        return result.rows[0] || null;
    }

    async insert(data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const quotedKeys = keys.map(k => `"${k}"`).join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const query = `INSERT INTO "${this.tableName}" (${quotedKeys}) VALUES (${placeholders}) RETURNING *`;
        const result = await db.query(query, values);
        return result.rows[0];
    }

    async update(id, partialData) {
        const keys = Object.keys(partialData);
        const values = Object.values(partialData);
        const sets = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
        const query = `UPDATE "${this.tableName}" SET ${sets} WHERE id = $1 RETURNING *`;
        const result = await db.query(query, [id, ...values]);
        return result.rows[0];
    }

    async delete(id) {
        const result = await db.query(`DELETE FROM "${this.tableName}" WHERE id = $1 RETURNING *`, [id]);
        return result.rows[0];
    }

    // Direct access to singleton config objects (assumes id=1 for config tables)
    async getConfig() {
        const result = await db.query(`SELECT * FROM "${this.tableName}" ORDER BY id ASC`);
        return result.rows;
    }

    async updateConfig(newConfig) {
        // If it's a list (like form fields), we sync the list
        if (Array.isArray(newConfig.items)) {
            // For simplicity, delete and re-insert for the demo if it's a clean sync
            // Logic would vary in production
        }
        return newConfig;
    }

    async syncItems(items, foreignKey = null, foreignId = null) {
        if (!items) return;
        
        if (foreignKey && foreignId) {
            await db.query(`DELETE FROM "${this.tableName}" WHERE "${foreignKey}" = $1`, [foreignId]);
        } else {
            await db.query(`DELETE FROM "${this.tableName}"`);
        }

        for (const item of items) {
            const { id, created_at, ...data } = item;
            if (foreignKey && foreignId) {
                data[foreignKey] = foreignId;
            }
            await this.insert(data);
        }
    }
}

// Map the repos to their SQL tables
const TicketRepo = new Repository('tickets');
const LogRepo = new Repository('ticket_logs');
const UserRepo = new Repository('users');
const SurveyRepo = new Repository('surveys');

const EmailTemplateRepo = {
    async getAll() {
        const result = await db.query("SELECT * FROM email_templates ORDER BY id ASC");
        return result.rows;
    },
    async getById(id) {
        const result = await db.query("SELECT * FROM email_templates WHERE id = $1", [id]);
        return result.rows[0] || null;
    },
    async getByWorkflow(workflowName) {
        // Note: For backwards compatibility with services that request by workflowName.
        const result = await db.query(
            "SELECT * FROM email_templates WHERE assigned_workflows @> $1::jsonb LIMIT 1", 
            [JSON.stringify([workflowName])]
        );
        return result.rows[0] || null;
    },
    async saveTemplate(id, data) {
        const { name, assigned_workflows, design_json, html_content } = data;
        let query, params;
        if (id) {
            query = `
                UPDATE email_templates 
                SET name = $1, assigned_workflows = $2, design_json = $3, html_content = $4, updated_at = CURRENT_TIMESTAMP
                WHERE id = $5 RETURNING *;
            `;
            params = [name, JSON.stringify(assigned_workflows || []), design_json, html_content, id];
        } else {
            query = `
                INSERT INTO email_templates (name, assigned_workflows, design_json, html_content)
                VALUES ($1, $2, $3, $4) RETURNING *;
            `;
            params = [name, JSON.stringify(assigned_workflows || []), design_json, html_content];
        }
        const result = await db.query(query, params);
        return result.rows[0];
    },
    async delete(id) {
        const result = await db.query("DELETE FROM email_templates WHERE id = $1 RETURNING *", [id]);
        return result.rows[0];
    }
};

const EmailConfigRepo = new Repository('email_config');
const FormConfigRepo = new Repository('form_config');
const TicketViewConfigRepo = new Repository('ticket_view_columns');
const CategoryRepo = new Repository('form_categories');
const FieldRepo = new Repository('form_category_fields');
const MetricConfigRepo = new Repository('metric_config');

module.exports = {
    Repository,
    TicketRepo,
    LogRepo,
    UserRepo,
    SurveyRepo,
    EmailConfigRepo,
    EmailTemplateRepo,
    FormConfigRepo,
    TicketViewConfigRepo,
    CategoryRepo,
    FieldRepo,
    MetricConfigRepo
};
