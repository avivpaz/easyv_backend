const jwt = require('jsonwebtoken');

const jobPublicAccess = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token required' });
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== 'job-access' || decoded.jobId !== req.params.id) {
        return res.status(403).json({ error: 'Invalid access' });
      }
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  module.exports = jobPublicAccess;