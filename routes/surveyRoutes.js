const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');

// Get survey metrics (NPS, CSAT)
router.get('/metrics', surveyController.getMetrics);

// Export survey report
router.get('/export', surveyController.exportSurveys);

// Submit a survey (external endpoint)
router.post('/', surveyController.submitSurvey);

module.exports = router;
