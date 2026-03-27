const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UserRepo } = require('../models/Repository');

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email y contraseña son obligatorios' });
        }

        const user = await UserRepo.findByEmail(email);

        
        if (!user) {

            return res.status(401).json({ success: false, error: 'Credenciales inválidas o cuenta desactivada' });
        }



        const isMatch = await bcrypt.compare(password, user.password_hash);


        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
        }

        // Return user data (excluding password_hash)
        const { password_hash, ...userData } = user;
        
        const jwtSecret = process.env.JWT_SECRET || 'servit-super-secret-key';
        const token = jwt.sign(
            { id: userData.id, role_id: userData.role_id || userData.role },
            jwtSecret,
            { expiresIn: '24h' }
        );

        res.json({ 
            success: true, 
            token: token, 
            user: {
                id: userData.id,
                roleId: userData.role_id || userData.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Error en el servidor durante el login' });
    }
};
