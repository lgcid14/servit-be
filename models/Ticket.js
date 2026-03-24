const { v4: uuidv4 } = require('uuid');
const { TicketRepo, LogRepo } = require('./Repository');
const { pool } = require('../config/db');

class Ticket {
    static async create(data) {
        const id = uuidv4();
        
        // Get next value from sequence for display_id
        const seqRes = await pool.query("SELECT nextval('ticket_id_seq')");
        const seqNum = seqRes.rows[0].nextval;
        const display_id = `TK${String(seqNum).padStart(6, '0')}`;

        const newTicket = {
            id,
            display_id,
            created_at: new Date().toISOString(),
            rut: data.rut,
            email: data.correo || data.email,
            type: data.type,
            category_id: data.category_id || null,
            subtype: data.subtype || null,
            status: 'Recibido',
            details: data.details,
            payload: data.payload, 
            priority: 'Normal',
            survey_sent: false,
            channel: 'web',
            category: data.category || data.type || 'General',
            sheet_data: data.sheet_data || data.sheetData || {}
        };

        const sql = `
            INSERT INTO tickets (id, display_id, created_at, rut, email, type, category_id, subtype, status, details, payload, priority, category, sheet_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `;

        const finalPayload = typeof newTicket.payload === 'string' ? newTicket.payload : JSON.stringify(newTicket.payload || {});
        const finalSheetData = typeof newTicket.sheet_data === 'string' ? newTicket.sheet_data : JSON.stringify(newTicket.sheet_data || {});

        const vals = [
            newTicket.id, newTicket.display_id, newTicket.created_at, newTicket.rut, 
            newTicket.email, newTicket.type, newTicket.category_id, newTicket.subtype, newTicket.status, 
            newTicket.details, finalPayload, newTicket.priority,
            newTicket.category, finalSheetData
        ];

        await pool.query(sql, vals);

        // Log history event
        await LogRepo.insert({
            id: uuidv4(),
            ticket_id: id,
            action: 'CREATED',
            details: 'Ticket generado desde formulario web',
            agent: 'System',
            created_at: new Date().toISOString()
        });

        return newTicket;
    }

    static async findAll(filters) {
        let query = 'SELECT * FROM tickets';
        let vals = [];
        let clauses = [];

        if (filters) {
            if (filters.status) {
                clauses.push(`status = $${vals.length + 1}`);
                vals.push(filters.status);
            }
            if (filters.type) {
                clauses.push(`type = $${vals.length + 1}`);
                vals.push(filters.type);
            }
            if (filters.rut) {
                clauses.push(`rut = $${vals.length + 1}`);
                vals.push(filters.rut);
            }
        }

        if (clauses.length > 0) {
            query += ' WHERE ' + clauses.join(' AND ');
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, vals);
        return result.rows;
    }

    static async findById(id) {
        const ticket = await TicketRepo.findById(id);
        if (ticket) {
            const result = await pool.query('SELECT * FROM replies WHERE ticket_id = $1 ORDER BY created_at ASC', [id]);
            ticket.replies = result.rows;
        }
        return ticket;
    }

    static async updateStatus(id, newStatus, agent = 'Admin') {
        const ticket = await TicketRepo.update(id, { status: newStatus });
        if (ticket) {
            await LogRepo.insert({
                id: uuidv4(),
                ticket_id: id,
                action: 'STATUS_CHANGED',
                details: `Estado cambiado a ${newStatus}`,
                agent,
                created_at: new Date().toISOString()
            });
        }
        return ticket;
    }

    static async addReply(id, replyData) {
        const ticket = await this.findById(id);
        if (ticket) {
            const reply = {
                id: uuidv4(),
                ticket_id: id,
                agent: replyData.agent || 'Admin',
                message: replyData.message,
                created_at: new Date().toISOString()
            };
            
            await pool.query(
                'INSERT INTO replies (id, ticket_id, agent, message, created_at) VALUES ($1, $2, $3, $4, $5)',
                [reply.id, reply.ticket_id, reply.agent, reply.message, reply.created_at]
            );

            await LogRepo.insert({
                id: uuidv4(),
                ticket_id: id,
                action: 'REPLY_ADDED',
                details: 'Respuesta enviada al solicitante',
                agent: reply.agent,
                created_at: new Date().toISOString()
            });

            return await this.findById(id);
        }
        return null;
    }

    static async getHistory(ticketId) {
        const result = await pool.query('SELECT * FROM ticket_logs WHERE ticket_id = $1 ORDER BY created_at DESC', [ticketId]);
        return result.rows;
    }

    static async getStats() {
        // Query multiple metrics in parallel from DB
        const queries = {
            total: 'SELECT COUNT(*) FROM tickets',
            today: "SELECT COUNT(*) FROM tickets WHERE created_at >= CURRENT_DATE",
            byStatus: 'SELECT status, COUNT(*) FROM tickets GROUP BY status',
            byCategory: 'SELECT category, COUNT(*) FROM tickets GROUP BY category',
            surveys: 'SELECT AVG(score) as avg_score, COUNT(*) as total_responses FROM surveys'
        };

        const results = {};
        for (const [key, sql] of Object.entries(queries)) {
            const res = await pool.query(sql);
            results[key] = res.rows;
        }

        // Format to match Dashboard expectation or simplified object
        return {
            total: parseInt(results.total[0].count),
            today: parseInt(results.today[0].count),
            byStatus: results.byStatus.reduce((acc, r) => ({ ...acc, [r.status]: parseInt(r.count) }), {}),
            avgScore: parseFloat(results.surveys[0].avg_score || 0).toFixed(1),
            totalSurveys: parseInt(results.surveys[0].total_responses)
        };
    }

    static async getReportData(days = 30) {
        // Daily volume
        const dailySql = `
            SELECT 
                TO_CHAR(created_at, 'DD/MM') as date, 
                COUNT(*) as recibidos,
                COUNT(*) FILTER (WHERE status = 'resuelto') as resueltos
            FROM tickets
            WHERE created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY TO_CHAR(created_at, 'DD/MM'), date
            ORDER BY MIN(created_at) ASC
        `;
        
        // Categorical breakdown
        const catSql = `
            SELECT category, COUNT(*) as count 
            FROM tickets 
            GROUP BY category
        `;

        const [dailyRes, catRes] = await Promise.all([
            pool.query(dailySql),
            pool.query(catSql)
        ]);

        return {
            daily: dailyRes.rows,
            categories: catRes.rows
        };
    }
}

module.exports = Ticket;
