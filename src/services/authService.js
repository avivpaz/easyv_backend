// services/authService.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Organization } = require('../models');

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
            plan: user.organization.plan || 'free'
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
  }
};

module.exports = authService;