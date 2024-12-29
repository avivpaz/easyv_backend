// src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cvRoutes = require('./src/routes/cvRoutes');
const jobRoutes = require('./src/routes/jobRoutes');  // Add this line
const authRoutes = require('./src/routes/authRoutes');
const connectDB = require('./src/config/database');
const organizationRoutes = require('./src/routes/organizationRoutes');
const publicRoutes = require('./src/routes/publicRoutes');
const billingRoutes = require('./src/routes/billingRoutes');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();



const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/cvs', cvRoutes);
app.use('/jobs', jobRoutes);  // Add this line
app.use('/auth', authRoutes);
app.use('/organizations', organizationRoutes);
app.use('/public', publicRoutes);
app.use('/billing', billingRoutes);

// Error handling
app.use(errorHandler);
app.get('/', (req, res) => {
  res.status(200).send('OK');
});
// Database connection
connectDB()
  .then(() => {
    app.listen(process.env.PORT || 3000, () => {
      console.log(`Server running on port ${process.env.PORT || 3000}`);
      console.log('Routes available:');
      console.log('- POST /users/register');
      console.log('- POST /jobs/create');
      console.log('- POST /cv/analyze');
    });
  })
  .catch(async error => {
    console.error('Failed to start server:', error);
    await logtail.error("Server Start Failed", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date()
    });
    await logtail.flush();
    process.exit(1);
  }); 

module.exports = app;