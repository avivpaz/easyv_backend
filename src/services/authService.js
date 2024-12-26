// services/authService.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Organization } = require('../models');
const billingService = require('./billingService');
const { OAuth2Client ,} = require('google-auth-library');
const { generateTokens, refreshAccessToken } = require('../utils/authUtils');
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
    );

const authService = {
  async login(email, password) {
    try {
      const user = await User.findOne({ email }).populate('organization');
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return { success: false, error: 'Invalid password' };
      }

      if (!user.organization) {
        return { success: false, error: 'User organization not found' };
      }

      // Get credits balance from billing service
      const { credits } = await billingService.getCreditsBalance(user.organization._id);

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

      return {
        success: true,
        data: {
          token,
          user: {
            email: user.email,
            role: user.role,
            fullName: user.fullName || ''
          },
          organization: {
            id: user.organization._id,
            name: user.organization.name,
            credits: credits,
            customerId: user.organization.customerId || null,
            description: user.organization.description || '',
            website: user.organization.website || '',
            linkedinUrl: user.organization.linkedinUrl || '',
            logoUrl: user.organization.logoUrl || '',
            needsSetup: !user.organization.description && !user.organization.logoUrl
          }
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  },

  async createUserWithOrganization(userData) {
    try {
      const { email, password, organizationName, fullName, role = 'admin' } = userData;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return { 
          success: false, 
          error: 'An account with this email already exists' 
        };
      }

      const organization = await Organization.create({ 
        name: organizationName
      });

      // Add initial credits using billing service
      await billingService.addCreditsManually(
        organization._id,
        5,
        null,
        'Initial signup bonus credits'
      );

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        email,
        password: hashedPassword,
        organization: organization._id,
        fullName: fullName,
        role
      });

      const token = jwt.sign(
        { 
          userId: user._id,
          email: user.email,
          role: user.role,
          organizationId: organization._id
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return {
        success: true,
        data: {
          token,
          user: {
            email: user.email,
            role: user.role,
            fullName: user.fullName || ''
          },
          organization: {
            id: organization._id,
            name: organization.name,
            credits: 5, // Initial credits
            customerId: null,
            description: '',
            website: '',
            linkedinUrl: '',
            logoUrl: '',
            needsSetup: true
          }
        }
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  },

  
  async googleCallback(code) {
    try {
      // Create OAuth2 client
   
  
      // Exchange code for tokens
    const { tokens } = await googleClient.getToken(code);
      
      // Get user info using the access token
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
  
      if (!userInfoResponse.ok) {
        throw new Error('Failed to get user info from Google');
      }
  
      const userData = await userInfoResponse.json();
      const { sub: googleId, email, name } = userData;
  
      // Rest of your existing user creation/update logic
      let user = await User.findOne({ 
        $or: [
          { email: email },
          { googleId: googleId }
        ]
      }).populate('organization');
  
      if (user) {
        if (!user.googleId) {
          user.googleId = googleId;
          user.authProvider = 'google';
          await user.save();
        }
      } else {
        const organization = await Organization.create({
          name: `My Company`,
          needsSetup: true
        });
  
        await billingService.addCreditsManually(
          organization._id,
          10,
          null,
          'Initial Google signup bonus credits'
        );
  
        user = await User.create({
          email,
          fullName: name,
          googleId,
          authProvider: 'google',
          organization: organization._id,
          role: 'admin'
        });
  
        user = await User.findById(user._id).populate('organization');
      }
  
      const { credits } = await billingService.getCreditsBalance(user.organization._id);
  
      // Generate tokens using authUtils
      const { accessToken, refreshToken } = generateTokens(user);
  
      // Store refresh token in user document
      user.refreshToken = refreshToken;
      await user.save();
  
      return {
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: {
            email: user.email,
            role: user.role,
            fullName: user.fullName
          },
          organization: {
            id: user.organization._id,
            name: user.organization.name,
            credits: credits,
            customerId: user.organization.customerId || null,
            description: user.organization.description || '',
            website: user.organization.website || '',
            linkedinUrl: user.organization.linkedinUrl || '',
            logoUrl: user.organization.logoUrl || '',
            brandColor: user.organization.brandColor || '',
            needsSetup: !user.organization.description && !user.organization.logoUrl
          }
        }
      };
    } catch (error) {
      console.error('Google callback error:', error);
      return { success: false, error: 'Failed to authenticate with Google' };
    }
  },
  
async googleAuth(token) {
  try {
    const ticket = await googleClient.getTokenInfo(token);
  
    if (ticket.aud !== process.env.GOOGLE_CLIENT_ID) {
      return { success: false, error: 'Invalid token audience' };
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to get user info from Google');
    }

    const userData = await userInfoResponse.json();
    const { sub: googleId, email, name } = userData;

    let user = await User.findOne({ 
      $or: [
        { email: email },
        { googleId: googleId }
      ]
    }).populate('organization');

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
        await user.save();
      }
    } else {
      const organization = await Organization.create({
        name: `My Company`,
        needsSetup: true
      });

      await billingService.addCreditsManually(
        organization._id,
        10,
        null,
        'Initial Google signup bonus credits'
      );

      user = await User.create({
        email,
        fullName: name,
        googleId,
        authProvider: 'google',
        organization: organization._id,
        role: 'admin'
      });

      user = await User.findById(user._id).populate('organization');
    }

    const { credits } = await billingService.getCreditsBalance(user.organization._id);

    // Generate tokens using authUtils
    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token in user document
    user.refreshToken = refreshToken;
    await user.save();

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          email: user.email,
          role: user.role,
          fullName: user.fullName
        },
        organization: {
          id: user.organization._id,
          name: user.organization.name,
          credits: credits,
          customerId: user.organization.customerId || null,
          description: user.organization.description || '',
          website: user.organization.website || '',
          linkedinUrl: user.organization.linkedinUrl || '',
          logoUrl: user.organization.logoUrl || '',
          brandColor: user.organization.brandColor || '',
          needsSetup: !user.organization.description && !user.organization.logoUrl
        }
      }
    };
  } catch (error) {
    console.error('Google auth error:', error);
    return { success: false, error: 'Failed to authenticate with Google' };
  }
}
};

module.exports = authService;