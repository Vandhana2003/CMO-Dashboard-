const express = require('express');
const router = express.Router();
const { getB2BData } = require('../controllers/b2bController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getB2BData);

module.exports = router;
