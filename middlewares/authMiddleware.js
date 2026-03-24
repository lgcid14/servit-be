const jwt = require('jsonwebtoken');

// A placeholder secret for demo purposes. In production this comes from process.env.JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'servit_super_secret_key_2026';

const verifyToken = (req, res, next) => {
    // Check headers for authorization
    const authHeader = req.headers['authorization'];

    // Support "Bearer <token>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // For development/demo purposes, we might let this slide if it's explicitly allowed,
        // but for a strict SaaS auth we reject it.
        // We return 401 Unauthorized
        return res.status(401).json({ success: false, message: 'Se requiere token de autenticación.' });
    }

    try {
        // Here we would normally use jwt.verify()
        // const decoded = jwt.verify(token, JWT_SECRET);
        // req.user = decoded;

        // Simulated token logic for demo
        if (token === 'demo-jwt-token') {
            req.user = { name: 'Admin', role: 'admin' };
            next();
        } else {
            throw new Error('Token inválido');
        }
    } catch (err) {
        return res.status(403).json({ success: false, message: 'Token inválido o expirado.' });
    }
};

module.exports = {
    verifyToken,
    JWT_SECRET
};
