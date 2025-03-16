const { supabaseClient } = require('../config/supabase');
const { User } = require('../models');
const jwt = require('jsonwebtoken');

/**
 * Middleware to handle Supabase authentication
 * This will check for a Supabase token in the headers and verify it
 * If valid, it will attach the user to the request object
 */
const supabaseAuth = async (req, res, next) => {
  try {
    // Check if there's a Supabase token in the headers
    const supabaseToken = req.headers['supabase-auth'];
    
    if (!supabaseToken) {
      // No Supabase token, continue to next middleware
      return next();
    }
    
    // Verify the Supabase token
    const { data, error } = await supabaseClient.auth.getUser(supabaseToken);
    
    if (error || !data.user) {
      // Invalid token, continue to next middleware
      return next();
    }
    
    // Token is valid, find the user in our database
    const user = await User.findOne({ supabaseUserId: data.user.id }).populate('organization');
    
    if (!user) {
      // User not found in our database, continue to next middleware
      return next();
    }
    
    // Create a JWT token for our system
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role,
        organizationId: user.organization._id
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Attach the token to the request
    req.headers.authorization = `Bearer ${token}`;
    
    // Continue to next middleware
    next();
  } catch (error) {
    console.error('Supabase auth middleware error:', error);
    next();
  }
};

module.exports = supabaseAuth; 