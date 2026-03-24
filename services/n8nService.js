const axios = require('axios');
const { EmailConfigRepo } = require('../models/Repository');

class n8nService {
    constructor() {
        this.webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/ticket-events';
    }

    async sendEvent(eventName, dataPayload) {
        try {
            // Fetch latest email configuration to include in every notification
            const emailConfig = await EmailConfigRepo.getConfig();


            const response = await axios.post(this.webhookUrl, {
                event: eventName,
                timestamp: new Date().toISOString(),
                data: dataPayload,
                emailConfig: emailConfig // Include styles/templates for n8n to use
            });

            return { success: true, data: response.data };
        } catch (error) {
            console.error(`Failed to send ${eventName} to n8n:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async sendTicketCreated(ticket) {
        return this.sendEvent('ticket.created', ticket);
    }

    async sendTicketStatusChanged(ticketId, oldStatus, newStatus, agentId = 'admin_system') {
        return this.sendEvent('ticket.status_changed', {
            ticketId,
            oldStatus,
            newStatus,
            agentId
        });
    }

    async sendTicketReply(ticketId, message, agentId = 'admin_system', userEmail = '') {
        return this.sendEvent('ticket.reply_added', {
            ticketId,
            message,
            agentId,
            userEmail
        });
    }

    async sendSurveyResult(survey) {
        return this.sendEvent('survey.submitted', survey);
    }
}

module.exports = new n8nService();
