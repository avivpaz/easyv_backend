// const mongoose = require('mongoose');

// async function connectDB() {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI);
//     console.log('MongoDB connected');
//   } catch (error) {
//     console.error('MongoDB connection error:', error);
//     process.exit(1);
//   }
// }

// module.exports = connectDB;

const mongoose = require('mongoose');

async function connectDB() {

  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      authMechanism: 'SCRAM-SHA-1', // Change from default SCRAM-SHA-256
      tls: true,
      tlsInsecure: true,
      directConnection: true,
      authSource: 'admin'
        });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

module.exports = connectDB;