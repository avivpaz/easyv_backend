const express = require('express');
const router = express.Router();
const { 
  login, 
  createUser, 
  googleAuth, 
  googleCallback, 
  refreshToken,
  registerSupabase,
  loginSupabase
} = require('../controllers/authController');

router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/register', createUser);
router.post('/google', googleAuth);
router.post('/google/callback', googleCallback);

// New Supabase routes
router.post('/register-supabase', registerSupabase);
router.post('/login-supabase', loginSupabase);

module.exports = router;