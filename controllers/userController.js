const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { UserRepo } = require('../models/Repository');

const sanitize = (user) => {
    if (!user) return null;
    const { password_hash, ...safe } = user;
    return safe;
};

// GET /api/users
exports.getAll = async (req, res) => {
    try {
        const users = await UserRepo.findAll();
        res.json({ success: true, data: users.map(sanitize) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener usuarios' });
    }
};

// POST /api/users
exports.create = async (req, res) => {
    try {
        const { name, email, password, role, active } = req.body;
        if (!name || !email || !password || !role) {
            return res.status(400).json({ success: false, error: 'Nombre, email, contraseña y rol son obligatorios' });
        }

        const exists = await UserRepo.findByEmail(email.toLowerCase());
        if (exists) {
            return res.status(409).json({ success: false, error: 'Ya existe un usuario con ese email' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newUser = {
            id: uuidv4(),
            name,
            email: email.toLowerCase(),
            password_hash,
            role,
            active: active !== undefined ? active : true,
            created_at: new Date().toISOString() // SQL uses created_at (snake_case)
        };

        await UserRepo.insert(newUser);
        res.status(201).json({ success: true, data: sanitize(newUser) });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ success: false, error: 'Error al crear usuario' });
    }
};

// PUT /api/users/:id
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password, role, active } = req.body;

        const current = await UserRepo.findById(id);
        if (!current) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }

        if (email && email.toLowerCase() !== current.email) {
            const conflict = await UserRepo.findByEmail(email.toLowerCase());
            if (conflict && conflict.id !== id) {
                return res.status(409).json({ success: false, error: 'Ya existe un usuario con ese email' });
            }
        }

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email.toLowerCase();
        if (password && password !== '') {
            const salt = await bcrypt.genSalt(10);
            updates.password_hash = await bcrypt.hash(password, salt);
        }
        if (role !== undefined) updates.role = role;
        if (active !== undefined) updates.active = active;

        const updated = await UserRepo.update(id, updates);
        res.json({ success: true, data: sanitize(updated) });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, error: 'Error al actualizar usuario' });
    }
};

// DELETE /api/users/:id
exports.remove = async (req, res) => {
    try {
        const { id } = req.params;
        const all = await UserRepo.findAll();

        const target = all.find(u => u.id === id);
        if (!target) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }

        const admins = all.filter(u => u.role === 'admin');
        if (target.role === 'admin' && admins.length <= 1) {
            return res.status(400).json({ success: false, error: 'No puedes eliminar el único administrador del sistema' });
        }

        await UserRepo.delete(id);
        res.json({ success: true, message: 'Usuario eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al eliminar usuario' });
    }
};
