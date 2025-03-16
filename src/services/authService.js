// services/authService.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Organization } = require('../models');
const billingService = require('./billingService');
const { OAuth2Client } = require('google-auth-library');
const { generateTokens, refreshAccessToken } = require('../utils/authUtils');
const { supabaseClient, supabaseAdmin } = require('../config/supabase');
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
        50,
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
  
      // Track if this is a new user
      let isNewUser = false;
  
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
        isNewUser = true;
        const organization = await Organization.create({
          name: `My Company`,
          needsSetup: true
        });
  
        await billingService.addCreditsManually(
          organization._id,
          50,
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
          isNewUser,
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
          50,
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
  },

  async createUserWithSupabase(userData) {
    try {
      const { email, organizationName, fullName, role = 'admin', supabaseUserId } = userData;

      // Check if user already exists in our database
      const existingUser = await User.findOne({ 
        $or: [
          { email },
          { supabaseUserId }
        ]
      });

      if (existingUser) {
        // If user exists but doesn't have supabaseUserId, update it
        if (existingUser.email === email && !existingUser.supabaseUserId) {
          existingUser.supabaseUserId = supabaseUserId;
          await existingUser.save();
          
          // Return existing user data using this.loginWithSupabase
          return await this.loginWithSupabase(supabaseUserId);
        }
        
        return { 
          success: false, 
          error: 'An account with this email already exists' 
        };
      }

      // Create new organization
      const organization = await Organization.create({ 
        name: organizationName
      });

      // Add initial credits using billing service
      await billingService.addCreditsManually(
        organization._id,
        50,
        null,
        'Initial signup bonus credits'
      );

      // Create user with Supabase ID
      const user = await User.create({
        email,
        supabaseUserId,
        organization: organization._id,
        fullName: fullName,
        role,
        authProvider: 'supabase'
      });

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens({
        userId: user._id,
        email: user.email,
        role: user.role,
        organizationId: organization._id
      });

      // Get credits balance
      const { credits } = await billingService.getCreditsBalance(organization._id);

      return {
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: {
            email: user.email,
            role: user.role,
            fullName: user.fullName || ''
          },
          organization: {
            id: organization._id,
            name: organization.name,
            credits: credits,
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
      console.error('Supabase registration error:', error);
      return { success: false, error: error.message };
    }
  },

  async loginWithSupabase(supabaseUserId) {
    try {
      console.log('loginWithSupabase called with supabaseUserId:', supabaseUserId);
      
      // First try to find by supabaseUserId
      let user = await User.findOne({ supabaseUserId }).populate('organization');
      
      // If not found by supabaseUserId, try to get the user's email from Supabase
      if (!user) {
        const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(supabaseUserId);
        if (userError || !userData) {
          return { 
            success: false, 
            error: 'USER_NOT_FOUND',
            message: 'User not found in Supabase'
          };
        }

        // Try to find user by email
        user = await User.findOne({ email: userData.email }).populate('organization');
        
        // If found by email, update their supabaseUserId
        if (user && !user.supabaseUserId) {
          user.supabaseUserId = supabaseUserId;
          await user.save();
        } else if (!user) {
          return { 
            success: false, 
            error: 'USER_NOT_FOUND',
            message: 'User not found in database'
          };
        }
      }
      
      console.log('User organization:', user.organization ? 'Yes' : 'No');
      
      // If user exists but doesn't have an organization, create a default one
      if (!user.organization) {
        console.log('Creating default organization for user');
        try {
          // Create a default organization
          const organization = await Organization.create({ 
            name: 'My Organization',
            needsSetup: true
          });

          console.log('Default organization created:', organization._id);

          // Add initial credits
          await billingService.addCreditsManually(
            organization._id,
            50,
            null,
            'Initial signup bonus credits'
          );

          // Update user with organization
          user.organization = organization._id;
          await user.save();

          console.log('User updated with organization');

          // Reload user with organization
          const updatedUser = await User.findOne({ supabaseUserId }).populate('organization');
          
          console.log('User reloaded with organization:', updatedUser.organization ? 'Yes' : 'No');
          
          // Continue with the updated user
          return this.loginWithSupabase(supabaseUserId);
        } catch (orgError) {
          console.error('Failed to create default organization:', orgError);
          return { 
            success: false, 
            error: 'ORGANIZATION_CREATION_FAILED',
            message: 'Failed to create default organization'
          };
        }
      }

      // Get credits balance from billing service
      const { credits } = await billingService.getCreditsBalance(user.organization._id);

      // Generate tokens with a plain object instead of the Mongoose document
      const tokenData = {
        _id: user._id,
        email: user.email,
        role: user.role,
        organization: {
          _id: user.organization._id
        }
      };

      const { accessToken, refreshToken } = generateTokens(tokenData);

      return {
        success: true,
        data: {
          accessToken,
          refreshToken,
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
            brandColor: user.organization.brandColor || '',
            needsSetup: !user.organization.description && !user.organization.logoUrl
          }
        }
      };
    } catch (error) {
      console.error('Supabase login error:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = authService;