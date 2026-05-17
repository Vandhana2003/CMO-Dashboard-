const express = require('express');
const router = express.Router();
const { getB2CData } = require('../controllers/b2cController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getB2CData);

module.exports = router;
