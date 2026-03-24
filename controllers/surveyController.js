const Survey = require('../models/Survey');
const n8nService = require('../services/n8nService');

// GET /api/surveys/metrics
exports.getMetrics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const metrics = await Survey.getMetrics(startDate, endDate);
        res.json({ success: true, data: metrics });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to retrieve metrics' });
    }
};

// GET /api/surveys/export
exports.exportSurveys = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const metrics = await Survey.getMetrics(startDate, endDate);
        // In a real app, generate CSV. Returning JSON for now.
        res.json({ success: true, data: metrics.responses });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to export surveys' });
    }
};

// POST /api/surveys
exports.submitSurvey = async (req, res) => {
    try {
        const { ticketId, score, feedback } = req.body;
        const survey = await Survey.submit(ticketId, score, feedback);

        // n8n Hook
        await n8nService.sendSurveyResult(survey);

        res.status(201).json({ success: true, data: survey });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to submit survey' });
    }
};
