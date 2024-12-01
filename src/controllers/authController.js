const authService = require('../services/authService');
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

module.exports = { login,createUser };