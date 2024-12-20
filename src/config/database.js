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
    const certPath = process.env.CA_CERT_PATH || './certs/rds-combined-ca-bundle.pem';
console.log('Certificate path:', certPath);
console.log('Certificate exists:', fs.existsSync(certPath));
    await mongoose.connect(process.env.MONGODB_URI, {
      tls: true,
      tlsCAFile: certPath,
      authSource: 'admin',
      authMechanism: 'SCRAM-SHA-1', // Required for DocumentDB
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

module.exports = connectDB;