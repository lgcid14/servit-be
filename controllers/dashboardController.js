const { pool } = require('../config/db');
const Survey = require('../models/Survey');

// Helper para calcular la fecha de inicio según el rango
const getStartDateFromRange = (range) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Inicio del día actual para "hoy"

    if (range === 'hoy' || range === '1') {
        return today;
    }

    // Extraemos el número del rango (ej. '7d' -> 7, '30' -> 30), default 7
    const days = parseInt(String(range).replace(/\D/g, ''), 10) || 7;
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - days);
    return targetDate;
};

exports.getOverview = async (req, res) => {
    try {
        const { range = '7d' } = req.query;
        let startDate = req.query.startDate;
        let endDate = req.query.endDate;

        // Si no vienen fechas exactas, usamos el rango predefinido
        if (!startDate) {
            startDate = getStartDateFromRange(range);
        } else {
            startDate = new Date(startDate);
        }

        if (!endDate) {
            endDate = new Date(); // Hasta ahora
        } else {
            endDate = new Date(endDate);
        }

        // Consultas a BD para tickets
        // 1. Total de tickets creados en el periodo
        const totalResult = await pool.query(
            'SELECT COUNT(*) FROM tickets WHERE created_at >= $1 AND created_at <= $2',
            [startDate.toISOString(), endDate.toISOString()]
        );
        const total = parseInt(totalResult.rows[0].count, 10);

        // 2. Tickets recibidos hoy (independiente del rango, pero útil como métrica general si el dashboard lo pide, o restringido. Aquí lo hacemos globalmente "hoy" o relativo al endDate si fuera necesario. Se asume hoy absoluto)
        const startOfToday = new Date();
        startOfToday.setHours(0,0,0,0);
        const todayResult = await pool.query(
            'SELECT COUNT(*) FROM tickets WHERE created_at >= $1',
            [startOfToday.toISOString()]
        );
        const receivedToday = parseInt(todayResult.rows[0].count, 10);

        // 3. Tickets por estado en el periodo (recibido, pendiente, resuelto)
        // Normalizamos los estados
        const statusResult = await pool.query(
            `SELECT 
                LOWER(status) as status_name, 
                COUNT(*) 
             FROM tickets 
             WHERE created_at >= $1 AND created_at <= $2 
             GROUP BY LOWER(status)`,
            [startDate.toISOString(), endDate.toISOString()]
        );

        let byStatus = {
            recibido: 0,
            pendiente: 0,
            resuelto: 0
        };

        const resolvedStatuses = ['cerrado', 'resuelto', 'completado', 'closed', 'resolved'];
        const inProgressStatuses = ['pendiente', 'en curso', 'en proceso', 'in progress', 'open', 'abierto'];

        statusResult.rows.forEach(row => {
            const status = row.status_name.trim();
            const count = parseInt(row.count, 10);
            
            if (resolvedStatuses.includes(status)) {
                byStatus.resuelto += count;
            } else if (inProgressStatuses.includes(status)) {
                byStatus.pendiente += count;
            } else {
                // Asumimos 'recibido' o 'nuevo'
                byStatus.recibido += count;
            }
        });

        // 4. Métricas de Encuestas (NPS y CSAT) usando el método existente en el modelo Survey
        // Nota: Survey.getMetrics filtra por created_at de las surveys.
        const surveyMetrics = await Survey.getMetrics(startDate.toISOString(), endDate.toISOString());

        // 5. Últimos 10 Feedbacks (con comentario) en el rango de fecha (o histórico reciente si el filtro es amplio)
        const feedbackResult = await pool.query(
            `SELECT score, feedback, created_at 
             FROM surveys 
             WHERE created_at >= $1 AND created_at <= $2 
               AND feedback IS NOT NULL 
               AND trim(feedback) != '' 
             ORDER BY created_at DESC 
             LIMIT 10`,
            [startDate.toISOString(), endDate.toISOString()]
        );
        const recentFeedbacks = feedbackResult.rows;

        // Respuesta final
        res.json({
            success: true,
            data: {
                range,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                tickets: {
                    total,
                    receivedToday,
                    byStatus
                },
                experience: {
                    nps: surveyMetrics.nps,
                    csat: surveyMetrics.csat,
                    responses: surveyMetrics.totalReceived,
                    recentFeedbacks
                }
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard overview:', error);
        res.status(500).json({ success: false, error: 'Error al obtener métricas del dashboard' });
    }
};
