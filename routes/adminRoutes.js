const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');
const adminController = require('../controller/adminController');

router.get('/users', verifyToken, isAdmin, adminController.getAllUsers);

router.put('/users/:userId/make-usta', verifyToken, isAdmin, adminController.makeUsta);

router.delete('/users/:userId', verifyToken, isAdmin, adminController.deleteUser);




module.exports = router;
