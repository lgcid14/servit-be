const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');

router.post('/upload', (req, res, next) => {
    mediaController.uploadMiddleware(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
        next();
    });
}, mediaController.uploadFile);

router.get('/', mediaController.getGallery);
router.delete('/:id', mediaController.deleteFile);

module.exports = router;
