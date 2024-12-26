const express = require('express');
const router = express.Router();
const { login,createUser ,googleCallback,refreshToken} = require('../controllers/authController');

router.post('/login', login);
router.post('/refresh', refreshToken);  // 
router.post('/register', createUser);
router.post('/google/callback', googleCallback); // Add this new route
module.exports = router;