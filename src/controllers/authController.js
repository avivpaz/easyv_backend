const authService = require('../services/authService');
const { generateTokens, refreshAccessToken } = require('../utils/authUtils');
const { User } = require('../models');

async function createUser(req, res, next) {
   try {
     console.log('Creating user with data:', req.body);
     const result = await authService.createUserWithOrganization(req.body);
     if (!result.success) {
       const error = new Error(result.error);
       error.statusCode = 400;
       return next(error);
     }
     res.status(201).json(result.data);
   } catch (error) {
     console.error('User creation error:', error);
     next(error);
   }
}

async function refreshToken(req, res, next) {
   try {
     const { refreshToken } = req.body;
     const newAccessToken = await refreshAccessToken(refreshToken);
     res.json({ accessToken: newAccessToken });
   } catch (error) {
     error.statusCode = 401;
     next(error);
   }
}

async function googleCallback(req, res, next) {
   try {
     const { code } = req.body;
     
     if (!code) {
       const error = new Error('Authorization code is required');
       error.statusCode = 400;
       return next(error);
     }
 
     const result = await authService.googleCallback(code);
     
     if (!result.success) {
       const error = new Error(result.error);
       error.statusCode = 401;
       return next(error);
     }
 
     res.json(result.data);
   } catch (error) {
     console.error('Google callback error:', error);
     next(error);
   }
}
 
async function googleAuth(req, res, next) {
   try {
     const { token } = req.body;
     
     if (!token) {
       const error = new Error('Google token is required');
       error.statusCode = 400;
       return next(error);
     }
 
     const result = await authService.googleAuth(token);
     
     if (!result.success) {
       const error = new Error(result.error);
       error.statusCode = 401;
       return next(error);
     }
 
     res.json(result.data);
   } catch (error) {
     console.error('Google auth error:', error);
     next(error);
   }
}

async function login(req, res, next) {
   try {
     const { email, password } = req.body;
     
     if (!email || !password) {
       const error = new Error('Email and password are required');
       error.statusCode = 400;
       return next(error);
     }

     const result = await authService.login(email, password);
     
     if (!result.success) {
       const error = new Error(result.error);
       error.statusCode = 401;
       return next(error);
     }

     res.json(result.data);
   } catch (error) {
     console.error('Auth controller error:', error);
     next(error);
   }
}

async function registerSupabase(req, res, next) {
  try {
    const { email, organizationName, fullName, role, supabaseUserId } = req.body;
    
    if (!email || !organizationName || !fullName || !supabaseUserId) {
      const error = new Error('Required fields are missing');
      error.statusCode = 400;
      return next(error);
    }

    // First check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error('An account with this email already exists');
      error.statusCode = 409; // Conflict status code
      return next(error);
    }

    const result = await authService.createUserWithSupabase({
      email,
      organizationName,
      fullName,
      role: role || 'admin',
      supabaseUserId
    });

    if (!result.success) {
      const error = new Error(result.error);
      error.statusCode = 400;
      return next(error);
    }

    res.status(201).json(result.data);
  } catch (error) {
    console.error('Supabase registration error:', error);
    next(error);
  }
}

async function loginSupabase(req, res, next) {
  try {
    const { supabaseUserId } = req.body;
    
    if (!supabaseUserId) {
      const error = new Error('Supabase user ID is required');
      error.statusCode = 400;
      return next(error);
    }

    const result = await authService.loginWithSupabase(supabaseUserId);
    
    if (!result.success) {
      // If the user doesn't exist in our database, return a specific error
      if (result.error === 'USER_NOT_FOUND') {
        const error = new Error('User not found. Please register first.');
        error.statusCode = 404;
        error.code = 'USER_NOT_FOUND';
        return next(error);
      }
      
      // If the user exists but doesn't have an organization, return a specific error
      if (result.error === 'ORGANIZATION_NOT_FOUND') {
        const error = new Error('User organization not found.');
        error.statusCode = 404;
        error.code = 'ORGANIZATION_NOT_FOUND';
        return next(error);
      }
      
      // For other errors
      const error = new Error(result.message || result.error);
      error.statusCode = 401;
      return next(error);
    }

    res.json(result.data);
  } catch (error) {
    console.error('Supabase login error:', error);
    next(error);
  }
}

module.exports = { 
  login, 
  createUser, 
  googleCallback, 
  googleAuth, 
  refreshToken,
  registerSupabase,
  loginSupabase
};