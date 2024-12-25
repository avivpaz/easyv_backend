const authService = require('../services/authService');
const { generateTokens, refreshAccessToken } = require('../utils/authUtils');
async function createUser(req, res) {
    try {
      console.log('Creating user with data:', req.body);
      const result = await authService.createUserWithOrganization(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(201).json(result.data);
    } catch (error) {
      console.error('User creation error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  async function refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      const newAccessToken = await refreshAccessToken(refreshToken);
      res.json({ accessToken: newAccessToken });
    } catch (error) {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  };
  async function googleAuth(req, res) {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: 'Google token is required' });
      }
  
      const result = await authService.googleAuth(token);
      
      if (!result.success) {
        return res.status(401).json({ error: result.error });
      }
  
      res.json(result.data);
    } catch (error) {
      console.error('Google auth error:', error);
      res.status(500).json({ error: error.message });
    }
  }
async function login(req, res) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.login(email, password);
    
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error('Auth controller error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = { login,createUser,googleAuth,refreshToken };