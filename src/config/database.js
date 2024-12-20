const mongoose = require('mongoose');

async function connectDB() {
  try {
    // Different connection options based on environment
    const isProd = process.env.NODE_ENV === 'production';
    
    const connectionOptions = isProd ? {
      authMechanism: 'SCRAM-SHA-1',
      tls: true,
      tlsInsecure: true,
      directConnection: true,
      authSource: 'admin'
    } : {};

    console.log(`Attempting to connect to MongoDB in ${isProd ? 'production' : 'development'} mode...`);
    
    await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    if (process.env.NODE_ENV === 'production') {
      throw error;
    } else {
      process.exit(1);
    }
  }
}

module.exports = connectDB;