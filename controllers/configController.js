const db = require('../config/db');
const { 
    EmailConfigRepo, 
    EmailTemplateRepo, // <--- Import the new repo
    TicketViewConfigRepo, 
    CategoryRepo, 
    FieldRepo,
    MetricConfigRepo
} = require('../models/Repository');

// Email Configuration (Legacy global - keeping for fallback)
exports.getEmailConfig = async (req, res) => {
    try {
        const config = await EmailConfigRepo.getConfig();
        res.json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to retrieve email configuration' });
    }
};

exports.updateEmailConfig = async (req, res) => {
    try {
        const newConfig = req.body;
        const config = await EmailConfigRepo.updateConfig(newConfig);
        res.json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update email configuration' });
    }
};

// Rich Email Templates (Workflow specific)
exports.getEmailTemplate = async (req, res) => {
    try {
        const { workflow, id } = req.query;
        if (id) {
            const template = await EmailTemplateRepo.getById(id);
            return res.json({ success: true, data: template });
        }
        if (workflow) {
            const template = await EmailTemplateRepo.getByWorkflow(workflow);
            return res.json({ success: true, data: template });
        }
        
        // If neither, return all templates
        const templates = await EmailTemplateRepo.getAll();
        res.json({ success: true, data: templates });
    } catch (error) {
        console.error("Get Email Template Error:", error);
        res.status(500).json({ success: false, error: 'Failed to retrieve email template(s)' });
    }
};

exports.saveEmailTemplate = async (req, res) => {
    try {
        const { id, name, assigned_workflows, design_json, html_content } = req.body;
        if (!design_json || !html_content) {
            return res.status(400).json({ success: false, error: 'Missing required payload fields' });
        }
        
        const template = await EmailTemplateRepo.saveTemplate(id, {
            name: name || 'Plantilla Nueva',
            assigned_workflows: assigned_workflows || [],
            design_json,
            html_content
        });
        res.json({ success: true, data: template });
    } catch (error) {
        console.error("Save Email Template Error:", error);
        res.status(500).json({ success: false, error: 'Failed to save email template' });
    }
};

exports.deleteEmailTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        await EmailTemplateRepo.delete(id);
        res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
        console.error("Delete Email Template Error:", error);
        res.status(500).json({ success: false, error: 'Failed to delete email template' });
    }
};

// Categories Management (for Modal)
exports.getCategories = async (req, res) => {
    try {
        const categories = await CategoryRepo.getAll();
        res.json({ success: true, data: categories });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to retrieve categories' });
    }
};

exports.updateCategories = async (req, res) => {
    try {
        const categories = req.body;
        await CategoryRepo.syncItems(categories);
        res.json({ success: true });
    } catch (error) {
        console.error("Update Categories Error:", error);
        res.status(500).json({ success: false, error: 'Failed to update categories' });
    }
};

// Global Form Fields Management (Variables) - Scoped by category
exports.getFields = async (req, res) => {
    try {
        const { categoryId } = req.query;
        let fields;
        if (categoryId) {
            const result = await db.query(`SELECT * FROM "form_category_fields" WHERE "category_id" = $1 ORDER BY "order" ASC`, [categoryId]);
            fields = result.rows;
        } else {
            fields = await FieldRepo.getAll();
        }
        res.json({ success: true, data: fields });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to retrieve fields' });
    }
};

exports.updateFields = async (req, res) => {
    try {
        const { fields, categoryId } = req.body;
        if (!categoryId) {
            return res.status(400).json({ success: false, error: 'categoryId is required' });
        }
        await FieldRepo.syncItems(fields, 'category_id', categoryId);
        res.json({ success: true });
    } catch (error) {
        console.error("Update Fields Error:", error);
        res.status(500).json({ success: false, error: 'Failed to update fields' });
    }
};

// ... other existing controllers ...
exports.getMetricConfig = async (req, res) => {
    try {
        const config = await MetricConfigRepo.getConfig();
        res.json({ success: true, data: { cards: config } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to retrieve metrics' });
    }
};

exports.updateMetricConfig = async (req, res) => {
    try {
        const newConfig = req.body;
        const config = await MetricConfigRepo.updateConfig(newConfig);
        res.json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update metrics' });
    }
};

exports.getTicketViewConfig = async (req, res) => {
    try {
        const columns = await db.query('SELECT * FROM "ticket_view_columns" ORDER BY "order" ASC');
        const detailLayout = await db.query('SELECT * FROM "ticket_view_detail_layout" ORDER BY "order" ASC');
        
        res.json({ 
            success: true, 
            data: { 
                columns: columns.rows, 
                detailLayout: detailLayout.rows 
            } 
        });
    } catch (error) {
        console.error("Get Ticket View Config Error:", error);
        res.status(500).json({ success: false, error: 'Failed to retrieve ticket view config' });
    }
};

exports.updateTicketViewConfig = async (req, res) => {
    try {
        const { columns, detailLayout } = req.body;
        
        if (columns) {
            const ColumnRepo = new (require('../models/Repository')).Repository('ticket_view_columns');
            await ColumnRepo.syncItems(columns);
        }
        
        if (detailLayout) {
            const SectionRepo = new (require('../models/Repository')).Repository('ticket_view_detail_layout');
            await SectionRepo.syncItems(detailLayout);
        }
        
        res.json({ success: true, message: 'Ticket view configuration updated' });
    } catch (error) {
        console.error("Update Ticket View Config Error:", error);
        res.status(500).json({ success: false, error: 'Failed to update ticket view config' });
    }
};
