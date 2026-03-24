const bcrypt = require('bcryptjs');
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
        
        // For simplicity, we return a fake token as before, but linked to real DB user
        res.json({ 
            success: true, 
            token: 'authenticated-session-token', 
            user: {
                id: userData.id,
                name: userData.name,
                email: userData.email,
                role: userData.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Error en el servidor durante el login' });
    }
};
