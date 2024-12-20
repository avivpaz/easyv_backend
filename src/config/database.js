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
    await mongoose.connect(process.env.MONGODB_URI, {
      tls: true,
      tlsCAFile: process.env.CA_CERT_PATH || './certs/rds-combined-ca-bundle.pem',
      useNewUrlParser: true,
      useUnifiedTopology: true,
      authSource: 'admin',
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

module.exports = connectDB;