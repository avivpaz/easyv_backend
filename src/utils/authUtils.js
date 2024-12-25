// authUtils.js or similar file
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const generateTokens = (user) => {
  // Access token - short lived
  const accessToken = jwt.sign(
    { 
      userId: user._id,
      email: user.email,
      role: user.role,
      organizationId: user.organization._id
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }  // 15 minutes
  );

  // Refresh token - long lived
  const refreshToken = jwt.sign(
    { userId: user._id },  // Minimal payload for security
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '14d' }   // 7 days
  );

  return { accessToken, refreshToken };
};

// Add a function to generate new access token using refresh token
const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    // Here you'd typically fetch the user from database to get fresh data
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role,
        organizationId: user.organization._id
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return accessToken;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};



module.exports = { generateTokens, refreshAccessToken };
