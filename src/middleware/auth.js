const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    // Check if Authorization header exists
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header found' });
    }

    // Verify token format
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Verify and decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check token expiration explicitly
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return res.status(401).json({ error: 'Token has expired' });
    }

    // Add user info to request
    req.user = decoded;
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    
    // Handle other unexpected errors
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = authMiddleware;