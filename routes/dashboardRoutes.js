const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// GET /api/dashboard/overview
router.get('/overview', dashboardController.getOverview);

module.exports = router;
