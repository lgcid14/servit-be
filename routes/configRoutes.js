const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

// Categories & Dynamic Fields
router.get('/categories', configController.getCategories);
router.post('/categories', configController.updateCategories);

router.get('/fields', configController.getFields);
router.post('/fields', configController.updateFields);

// Metric Config
router.get('/metrics', configController.getMetricConfig);
router.post('/metrics', configController.updateMetricConfig);

// Email Config (Legacy)
router.get('/email', configController.getEmailConfig);
router.post('/email', configController.updateEmailConfig);

// Rich Email Templates (Workflow paired)
router.get('/email-template', configController.getEmailTemplate);
router.post('/email-template', configController.saveEmailTemplate);
router.delete('/email-template/:id', configController.deleteEmailTemplate);

// Ticket View Config
router.get('/ticket-view', configController.getTicketViewConfig);
router.post('/ticket-view', configController.updateTicketViewConfig);

module.exports = router;
