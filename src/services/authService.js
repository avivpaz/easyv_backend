// services/authService.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Organization } = require('../models');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authService = {
  async login(email, password) {
    try {
      // Find user and populate organization details
      const user = await User.findOne({ email }).populate('organization');
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return { success: false, error: 'Invalid password' };
      }

      // Check if organization exists
      if (!user.organization) {
        return { success: false, error: 'User organization not found' };
      }

      // Generate JWT token
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
            plan: user.organization.plan || 'free',
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
      const { email, password, organizationName,fullName, role = 'admin' } = userData;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return { 
          success: false, 
          error: 'An account with this email already exists' 
        };
      }

      const organization = await Organization.create({ name: organizationName });
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await User.create({
        email,
        password: hashedPassword,
        organization: organization._id,
        fullName:fullName,
        role
      });

      // Generate JWT token - same as login
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
            plan: 'free'  // Default plan for new organizations
          }
        }
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  },
  async googleAuth(token) {
    try {
      // Verify the Google token
      const ticket = await googleClient.getTokenInfo(token);
    
      // Verify it's intended for your application
      if (ticket.aud !== process.env.GOOGLE_CLIENT_ID) {
        return { success: false, error: 'Invalid token audience' };
      }
  
      // Get user info using verified token
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
  
      if (!userInfoResponse.ok) {
        throw new Error('Failed to get user info from Google');
      }
  
      const userData = await userInfoResponse.json();
      const { sub: googleId, email, name } = userData;
      // Check if user exists
      let user = await User.findOne({ 
        $or: [
          { email: email },
          { googleId: googleId }
        ]
      }).populate('organization');
  
      if (user) {
        // Update existing user with Google ID if they don't have one
        if (!user.googleId) {
          user.googleId = googleId;
          user.authProvider = 'google';
          await user.save();
        }
      } else {
        // Create new user and organization
        const organization = await Organization.create({
          name: `My Company`,
          needsSetup: true
        });
  
        user = await User.create({
          email,
          fullName: name,
          googleId,
          authProvider: 'google',
          organization: organization._id,
          role: 'admin'
        });
  
        // Populate organization details
        user = await User.findById(user._id).populate('organization');
      }
  
      // Generate JWT token
      const jwtToken = jwt.sign(
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
          token: jwtToken,
          user: {
            email: user.email,
            role: user.role,
            fullName: user.fullName
          },
          organization: {
            id: user.organization._id,
            name: user.organization.name,
            plan: user.organization.plan || 'free',
            description: user.organization.description || '',
            website: user.organization.website || '',
            linkedinUrl: user.organization.linkedinUrl || '',
            logoUrl: user.organization.logoUrl || '',
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