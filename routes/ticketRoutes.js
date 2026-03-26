const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');

// Get all tickets (with optional filters)
router.get('/', ticketController.getTickets);

// Get dashboard stats
router.get('/stats', ticketController.getStats);

// Get reports data
router.get('/report', ticketController.getReport);

// Export tickets to Excel
router.get('/export', ticketController.exportTickets);

// Get available ticket types
router.get('/types', ticketController.getTicketTypes);

// Get specific ticket detail
router.get('/:id', ticketController.getTicketById);

// Create ticket (public form submission)
router.post('/', ticketController.createTicket);

// Update ticket status
router.patch('/:id/status', ticketController.updateTicketStatus);

// Generate AI Reply Suggestion via n8n
router.post('/:id/ai-suggest', ticketController.generateAiSuggestion);

// Reply to ticket
router.post('/:id/reply', ticketController.replyTicket);

// Get ticket history
router.get('/:id/history', ticketController.getTicketHistory);

module.exports = router;
