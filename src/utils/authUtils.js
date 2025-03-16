// authUtils.js or similar file
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const generateTokens = (user) => {
  console.log('generateTokens called with user:', JSON.stringify(user, null, 2));
  
  // Make sure we have all required properties
  if (!user) {
    console.error('No user object provided to generateTokens');
    throw new Error('Invalid user object provided to generateTokens');
  }

  if (!user._id) {
    console.error('User object missing _id:', user);
    throw new Error('User object missing _id');
  }

  // Create a payload with safe defaults
  const payload = { 
    userId: user._id.toString(), // Convert to string in case it's an ObjectId
    email: user.email || '',
    role: user.role || 'user'
  };

  // Only add organizationId if it exists
  if (user.organization && user.organization._id) {
    payload.organizationId = user.organization._id.toString(); // Convert to string
  } else if (user.organizationId) {
    payload.organizationId = user.organizationId.toString(); // Convert to string
  }

  console.log('Token payload:', JSON.stringify(payload, null, 2));

  // Access token - short lived
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '2h' }  // 2 hours
  );

  // Refresh token - long lived
  const refreshToken = jwt.sign(
    { userId: user._id.toString() },  // Minimal payload for security
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '14d' }   // 14 days
  );

  return { accessToken, refreshToken };
};

// Add a function to generate new access token using refresh token
const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    // Here you'd typically fetch the user from database to get fresh data
    const user = await User.findById(decoded.userId).populate('organization');
    
    if (!user) {
      throw new Error('User not found');
    }

    // Create a payload with safe defaults
    const payload = { 
      userId: user._id,
      email: user.email || '',
      role: user.role || 'user'
    };

    // Only add organizationId if it exists
    if (user.organization && user.organization._id) {
      payload.organizationId = user.organization._id;
    }

    // Generate new access token
    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return accessToken;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

module.exports = { generateTokens, refreshAccessToken };
