const axios = require('axios');
require('dotenv').config();
const { EmailTemplateRepo } = require('../models/Repository');

class OutlookService {
    constructor() {
        this.clientId = process.env.OUTLOOK_CLIENT_ID;
        this.tenantId = process.env.OUTLOOK_TENANT_ID;
        this.clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
        this.senderEmail = process.env.OUTLOOK_USER_EMAIL;
    }

    async getAccessToken() {
        const url = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
        const params = new URLSearchParams();
        params.append('client_id', this.clientId);
        params.append('scope', 'https://graph.microsoft.com/.default');
        params.append('client_secret', this.clientSecret);
        params.append('grant_type', 'client_credentials');

        try {
            const response = await axios.post(url, params);
            return response.data.access_token;
        } catch (error) {
            console.error('Error fetching Outlook access token:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Microsoft Graph');
        }
    }

    async sendEmail({ to, subject, body, isHtml = true }) {
        try {
            const token = await this.getAccessToken();
            const url = `https://graph.microsoft.com/v1.0/users/${this.senderEmail}/sendMail`;

            const emailData = {
                message: {
                    subject: subject,
                    body: {
                        contentType: isHtml ? 'HTML' : 'Text',
                        content: body
                    },
                    toRecipients: [
                        {
                            emailAddress: {
                                address: to
                            }
                        }
                    ]
                }
            };

            await axios.post(url, emailData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`Email sent successfully to ${to} via Outlook`);
            return true;
        } catch (error) {
            console.error('Error sending Outlook email:', error.response?.data || error.message);
            return false;
        }
    }

    // 1. Reply (Agent to User)
    async sendTicketResponse(ticket, message) {
        try {
            const templateConf = await EmailTemplateRepo.getByWorkflow('ticket_update');
            let subject = `Respuesta a tu Ticket #${ticket.display_id || ticket.id.substring(0, 8).toUpperCase()} - Servit`;
            let body = "";

            if (templateConf && templateConf.html_content) {
                body = templateConf.html_content;
                body = body.replace(/{{ticketId}}/g, ticket.display_id || ticket.id.substring(0, 8));
                body = body.replace(/{{ticketCategory}}/g, ticket.type || "General");
                // The dynamic message from the agent editing the reply
                body = body.replace(/{{cuerpo_correo}}/g, message.replace(/\n/g, '<br>'));
            } else {
                body = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #7c3aed;">Actualización de tu caso</h2>
                        <p>Hola,</p>
                        <p>Nuestro equipo ha respondido a tu requerimiento:</p>
                        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
                            ${message.replace(/\n/g, '<br>')}
                        </div>
                        <p>Puedes ver el detalle completo en nuestro portal.</p>
                    </div>
                `;
            }

            return await this.sendEmail({ to: ticket.email || ticket.correo, subject, body });
        } catch (error) {
            console.error('Error sending Outlook response:', error);
            return false;
        }
    }

    // 2. Ticket Resolved Status
    async sendTicketResolvedEmail(ticket) {
        try {
            const templateConf = await EmailTemplateRepo.getByWorkflow('ticket_resolved_status');
            
            let subject = `Tu requerimiento #${ticket.display_id || ticket.id.substring(0, 8)} ha sido resuelto`;
            let body = "";
            let defaultMessage = `Te informamos que tu caso ha sido marcado como Resuelto. Si tienes cualquier duda, no dudes en contactarnos de nuevo.`;

            if (templateConf && templateConf.html_content) {
                body = templateConf.html_content;
                body = body.replace(/{{ticketId}}/g, ticket.display_id || ticket.id.substring(0, 8));
                body = body.replace(/{{ticketCategory}}/g, ticket.type || "General");
                body = body.replace(/{{cuerpo_correo}}/g, defaultMessage);
            } else {
                body = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #10b981;">Ticket Resuelto</h2>
                        <p>Hola,</p>
                        <p>${defaultMessage}</p>
                    </div>
                `;
            }

            return await this.sendEmail({ to: ticket.email || ticket.correo, subject, body });
        } catch (error) {
            console.error('Error sending resolved email via Outlook:', error);
            return false;
        }
    }

    // 3. Ticket Received (Auto-response)
    async sendTicketReceivedEmail(ticket) {
        try {
            const templateConf = await EmailTemplateRepo.getByWorkflow('ticket_received');
            
            let subject = `Hemos recibido tu solicitud #${ticket.display_id || ticket.id.substring(0, 8)}`;
            let body = "";
            let defaultMessage = `Gracias por contactar con nuestro equipo de Servit. Hemos registrado tu ${ticket.type || 'requerimiento'} exitosamente y lo revisaremos a la brevedad.`;

            if (templateConf && templateConf.html_content) {
                body = templateConf.html_content;
                body = body.replace(/{{ticketId}}/g, ticket.display_id || ticket.id.substring(0, 8));
                body = body.replace(/{{ticketCategory}}/g, ticket.type || "General");
                body = body.replace(/{{cuerpo_correo}}/g, defaultMessage);
            } else {
                body = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #7c3aed;">Solicitud Recibida</h2>
                        <p>Hola,</p>
                        <p>${defaultMessage}</p>
                    </div>
                `;
            }

            return await this.sendEmail({ to: ticket.email || ticket.correo, subject, body });
        } catch (error) {
            console.error('Error sending received email via Outlook:', error);
            return false;
        }
    }
}

module.exports = new OutlookService();
