const jwt = require('jsonwebtoken');

// Ensure this matches the secret used in authController.js
const JWT_SECRET = process.env.JWT_SECRET || 'servit-super-secret-key';

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Se requiere token de autenticación.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('Token verification error:', err.message);
        return res.status(403).json({ success: false, message: 'Token inválido o expirado.' });
    }
};

/**
 * Middleware to check if the user has a specific role_id
 * @param {number} allowedRoleId - The ID of the role allowed to access the route
 */
const checkRole = (allowedRoleId) => {
    return (req, res, next) => {
        if (!req.user || req.user.role_id !== allowedRoleId) {
            return res.status(403).json({ 
                success: false, 
                message: 'No tienes permisos suficientes para realizar esta acción.' 
            });
        }
        next();
    };
};

module.exports = {
    verifyToken,
    checkRole,
    JWT_SECRET
};
