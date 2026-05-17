const express = require('express');
const router = express.Router();
const { getReportData, downloadReport } = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('super_admin', 'admin'), getReportData);
router.get('/download', authenticate, authorize('super_admin', 'admin'), downloadReport);

module.exports = router;
