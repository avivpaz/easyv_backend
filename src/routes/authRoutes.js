const express = require('express');
const router = express.Router();
const { login,createUser ,googleAuth,refreshToken,googleCallback} = require('../controllers/authController');

router.post('/login', login);
router.post('/refresh', refreshToken);  // 
router.post('/register', createUser);
router.post('/google', googleAuth);
router.post('/google/callback', googleCallback); // Add this new route
module.exports = router;