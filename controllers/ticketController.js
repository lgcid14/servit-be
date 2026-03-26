const axios = require('axios');
const Ticket = require('../models/Ticket');
const n8nService = require('../services/n8nService');
const outlookService = require('../services/outlookService');
const OutlookService = require('../services/outlookService');
const ExcelJS = require('exceljs');
const { pool } = require('../config/db');

// POST /api/tickets
exports.createTicket = async (req, res) => {
    try {
        const payload = req.body;


        // Validate ticket_type_id if provided
        if (payload.ticket_type_id) {
            const typeCheck = await pool.query('SELECT id FROM ticket_types WHERE id = $1', [payload.ticket_type_id]);
            if (typeCheck.rowCount === 0) {
                return res.status(400).json({ success: false, error: 'Ticket type id does not exist' });
            }
        }

        // Abstract the specific request parsing. The frontend sends structured data.
        const ticketData = {
            rut: payload.rut,
            correo: payload.correo,
            category_id: payload.category_id,
            ticket_type_id: payload.ticket_type_id,
            type: payload.type, // Human label of category
            details: payload.details,
            payload: payload.dynamicData, // Dynamic fields values: { "Nombre": "Juan", ... }
            sheetData: {
                empresa: payload.dynamicData?.Empresa || 'Servit Internal',
                tienda: payload.dynamicData?.Tienda || 'Main Office',
                evaluacion: 'Pendiente'
            }
        };

        // 1. Save locally (Mock Google Sheets/DB)
        const newTicket = await Ticket.create(ticketData);

        // 2. Trigger n8n async
        // (n8n will handle Google Sheets writing and auto-responses to user)
        await n8nService.sendTicketCreated(newTicket);

        // 3. Trigger direct Outlook Email
        outlookService.sendTicketReceivedEmail(newTicket)
            .catch(err => console.warn('[Outlook] Could not send received email:', err.message));

        res.status(201).json({
            success: true,
            data: {
                id: newTicket.id,
                message: 'Ticket created successfully.'
            }
        });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ success: false, error: 'Failed to create ticket' });
    }
};

// GET /api/tickets
exports.getTickets = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            type: req.query.type,
            rut: req.query.rut
        };
        const tickets = await Ticket.findAll(filters);
        res.json({ success: true, count: tickets.length, data: tickets });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to retrieve tickets' });
    }
};

// GET /api/tickets/stats
exports.getStats = async (req, res) => {
    try {
        const stats = await Ticket.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Failed to get dashboard stats' });
    }
};

// GET /api/tickets/report
exports.getReport = async (req, res) => {
    try {
        const { days } = req.query;
        const report = await Ticket.getReportData(days || 30);
        res.json({ success: true, data: report });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
};

// GET /api/tickets/:id
exports.getTicketById = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
        res.json({ success: true, data: ticket });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to retrieve ticket' });
    }
};

// PATCH /api/tickets/:id/status
exports.updateTicketStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const oldTicket = await Ticket.findById(req.params.id);
        const ticket = await Ticket.updateStatus(req.params.id, status);

        if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

        // Trigger n8n async as usual
        if (oldTicket && oldTicket.status !== status) {
            n8nService.sendTicketStatusChanged(ticket.id, oldTicket.status, status)
                .catch(err => console.warn('[n8n] Could not send status change event:', err.message));

            // Trigger dedicated resolved email immediately via our direct Outlook integration
            if (status === 'resuelto') {
                outlookService.sendTicketResolvedEmail(ticket)
                    .catch(err => console.warn('[Outlook] Could not send resolved email:', err.message));
            }
        }

        res.json({ success: true, data: ticket });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update ticket status' });
    }
};

// POST /api/tickets/:id/reply
exports.replyTicket = async (req, res) => {
    try {
        const { message, userId } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }
        const agentName = userId || 'Admin';

        const ticket = await Ticket.addReply(req.params.id, { message, agent: agentName });
        if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

        // Trigger n8n async for email dispatch (fire-and-forget, never blocks)
        n8nService.sendTicketReply(ticket.id, message, agentName, ticket.email || ticket.correo)
            .catch(err => console.warn('[n8n] Could not send reply event:', err.message));

        // Priority trigger: Real Outlook Enterprise mail (also fire-and-forget)
        outlookService.sendTicketResponse(ticket, message)
            .catch(err => console.warn('[Outlook] Could not send email:', err.message));

        res.json({ success: true, data: ticket });
    } catch (error) {
        console.error('Error replying to ticket:', error);
        res.status(500).json({ success: false, error: 'Failed to reply to ticket' });
    }
};

// POST /api/tickets/:id/ai-suggest
exports.generateAiSuggestion = async (req, res) => {
    try {
        const ticketId = req.params.id;
        const ticket = await Ticket.findById(ticketId);

        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        // Call the local n8n webhook specifically designed for AI Keta 
        // This expects the user to have a workflow listening on this URL
        const n8nAiWebhookUrl = 'http://localhost:5678/webhook/ai-suggest';

        console.log(`Requesting AI suggestion from Keta via n8n: ${n8nAiWebhookUrl}`);

        // Optional timeout so the frontend doesn't hang forever if n8n is offline or slow
        const response = await axios.post(n8nAiWebhookUrl, {
            ticketId: ticket.id,
            category: ticket.type,
            details: ticket.details,
            payload: ticket.payload,
            user_rut: ticket.rut,
            user_email: ticket.correo || ticket.email,
        }, { timeout: 15000 });

        // Check if n8n returned a structured response
        const suggestion = response.data?.suggestion || response.data?.content || "El asistente Keta no retornó un mensaje claro. Por favor revisa la configuración del nodo de respuesta en n8n.";
        const sources = response.data?.sources || response.data?.internetSearch || "No se especificaron fuentes de búsqueda.";

        res.json({
            success: true,
            data: {
                content: suggestion,
                internetSearch: sources
            }
        });

    } catch (error) {
        console.error('Error contacting n8n for AI suggestion:', error.message);
        // Provide a graceful fallback error instead of crashing the UI
        res.json({
            success: false,
            error: 'No se pudo contactar al agente IA Keta en n8n.',
            data: {
                content: "Hubo un error de conexión con n8n alojado localmente. Asegúrate de que el flujo de Keta esté activo y el Webhook sea accesible.",
                internetSearch: "Error de red interno"
            }
        });
    }
};

// GET /api/tickets/:id/history
exports.getTicketHistory = async (req, res) => {
    try {
        const history = await Ticket.getHistory(req.params.id);
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to retrieve ticket history' });
    }
};

// GET /api/tickets/export
exports.exportTickets = async (req, res) => {
    try {
        const tickets = await Ticket.findAll(); // Get all tickets for export

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Tickets');

        // Define columns
        worksheet.columns = [
            { header: 'ID Ticket', key: 'display_id', width: 15 },
            { header: 'Fecha Creación', key: 'created_at', width: 20 },
            { header: 'Categoría', key: 'category', width: 20 },
            { header: 'Servicio', key: 'type', width: 30 },
            { header: 'Estado', key: 'status', width: 15 },
            { header: 'RUT', key: 'rut', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Prioridad', key: 'priority', width: 15 },
            { header: 'Detalles', key: 'details', width: 50 },
            { header: 'Datos Dinámicos', key: 'payload', width: 40 }
        ];

        // Add rows
        tickets.forEach(ticket => {
            const rowData = {
                ...ticket,
                created_at: new Date(ticket.created_at).toLocaleString(),
                payload: ticket.payload ? JSON.stringify(ticket.payload) : ''
            };
            worksheet.addRow(rowData);
        });

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { horizontal: 'center' };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Reporte_Tickets.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting tickets:', error);
        res.status(500).json({ success: false, error: 'Failed to export tickets' });
    }
};
