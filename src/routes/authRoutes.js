const express = require('express');
const router = express.Router();
const { login,createUser ,googleAuth} = require('../controllers/authController');

router.post('/login', login);
router.post('/register', createUser);
router.post('/google', googleAuth);
module.exports = router;