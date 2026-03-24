const { v4: uuidv4 } = require('uuid');
const { SurveyRepo } = require('./Repository');
const { pool } = require('../config/db');

class Survey {
    static async submit(ticketId, score, feedback) {
        const survey = {
            id: uuidv4(),
            ticket_id: ticketId,
            score,
            feedback,
            created_at: new Date().toISOString()
        };
        await SurveyRepo.insert(survey);
        return survey;
    }

    static async getMetrics(startDate, endDate) {
        let query = 'SELECT * FROM surveys';
        let vals = [];
        
        if (startDate && endDate) {
            query += ' WHERE created_at >= $1 AND created_at <= $2';
            vals = [startDate, endDate];
        }

        const result = await pool.query(query, vals);
        const surveys = result.rows;

        const totalReceived = surveys.length;
        const totalSent = totalReceived + 5; // Keep existing mock logic

        const promoters = surveys.filter(s => s.score >= 9).length;
        const passives = surveys.filter(s => s.score >= 7 && s.score <= 8).length;
        const detractors = surveys.filter(s => s.score <= 6).length;

        let nps = 0;
        if (totalReceived > 0) {
            nps = Math.round(((promoters - detractors) / totalReceived) * 100);
        }

        const satisfied = surveys.filter(s => s.score >= 8).length;
        let csat = 0;
        if (totalReceived > 0) {
            csat = Math.round((satisfied / totalReceived) * 100);
        }

        return {
            totalSent,
            totalReceived,
            nps,
            csat,
            responses: surveys
        };
    }
}

module.exports = Survey;
