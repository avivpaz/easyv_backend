const authService = require('../services/authService');
const { generateTokens, refreshAccessToken } = require('../utils/authUtils');

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

module.exports = { login, createUser, googleCallback, googleAuth, refreshToken };