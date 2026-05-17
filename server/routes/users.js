const express = require('express');
const router = express.Router();
const { getUsers, createUser, deleteUser } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('super_admin', 'admin'), getUsers);
router.post('/', authenticate, authorize('super_admin', 'admin'), createUser);
router.delete('/:id', authenticate, authorize('super_admin'), deleteUser);

module.exports = router;
