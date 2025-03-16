// src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cvRoutes = require('./src/routes/cvRoutes');
const jobRoutes = require('./src/routes/jobRoutes');
const authRoutes = require('./src/routes/authRoutes');
const connectDB = require('./src/config/database');
const organizationRoutes = require('./src/routes/organizationRoutes');
const publicRoutes = require('./src/routes/publicRoutes');
const billingRoutes = require('./src/routes/billingRoutes');
const helpRoutes = require('./src/routes/helpRoutes');
const integrationRoutes = require('./src/routes/integrationRoutes');
const supabaseAuth = require('./src/middleware/supabaseAuth');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// Increase payload size limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Supabase-Auth']
};

app.use(cors(corsOptions));

// Health check endpoint for AWS
app.get('/health', (req, res) => {
  res.status(200).send({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Apply Supabase auth middleware
app.use(supabaseAuth);

// Routes
app.use('/cvs', cvRoutes);
app.use('/jobs', jobRoutes);
app.use('/auth', authRoutes);
app.use('/organizations', organizationRoutes);
app.use('/public', publicRoutes);
app.use('/billing', billingRoutes);
app.use('/help', helpRoutes);
app.use('/integrations', integrationRoutes);

// Error handling
app.use(errorHandler);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

let server;

// Database connection
const startServer = async () => {
  try {
    await connectDB();
    const port = process.env.PORT || 8081;
    server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log('Routes available:');
      console.log('- POST /users/register');
      console.log('- POST /jobs/create');
      console.log('- POST /cv/analyze');
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM. Performing graceful shutdown...');
      shutdown();
    });

    process.on('SIGINT', () => {
      console.log('Received SIGINT. Performing graceful shutdown...');
      shutdown();
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

const shutdown = () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Start the server
startServer();

module.exports = app;