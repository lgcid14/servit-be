const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');

// Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '../public/media');
        // Ensure directory exists just in case
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        // Fallback for svg if multer misses the mapping
        let secureExt = ext;
        if (file.mimetype === 'image/svg+xml' && !ext.includes('svg')) {
            secureExt = '.svg';
        }
        cb(null, `media-${uniqueSuffix}${secureExt}`);
    }
});

// File filter (png, svg, mpg)
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'image/png', 
        'image/svg+xml', 
        'video/mpeg', 
        'video/mp4' // sometimes mapped loosely
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PNG, SVG, and MPG are allowed.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // 20 MB limit
});

exports.uploadMiddleware = upload.single('file');

exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file provided or invalid type' });
        }

        const filename = req.file.filename;
        const port = process.env.PORT || 3001;
        // Construct the accessible URL 
        // Assumes frontend uses localhost:3001/media/...
        const url = `http://localhost:${port}/media/${filename}`;
        const type = req.file.mimetype;

        const result = await db.query(
            `INSERT INTO media_gallery (filename, url, type) VALUES ($1, $2, $3) RETURNING *`,
            [filename, url, type]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ success: false, error: 'Failed to save media file' });
    }
};

exports.getGallery = async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM media_gallery ORDER BY created_at DESC`);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Gallery Error:", error);
        res.status(500).json({ success: false, error: 'Failed to retrieve media gallery' });
    }
};

exports.deleteFile = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(`SELECT * FROM media_gallery WHERE id = $1`, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Media not found' });
        }

        const media = result.rows[0];
        const filePath = path.join(__dirname, '../public/media', media.filename);

        // Delete from DB
        await db.query(`DELETE FROM media_gallery WHERE id = $1`, [id]);

        // Delete from FS
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({ success: true, message: 'Media deleted' });
    } catch (error) {
        console.error("Delete Media Error:", error);
        res.status(500).json({ success: false, error: 'Failed to delete media file' });
    }
};
