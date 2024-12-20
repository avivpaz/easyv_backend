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
const fs = require('fs');

async function connectDB() {
  const certPath = process.env.CA_CERT_PATH || '/var/app/current/certs/rds-combined-ca-bundle.pem';
  console.log('Certificate path:', certPath);
  console.log('Certificate exists:', fs.existsSync(certPath));

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      tls: true,
      tlsCAFile: certPath,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
      directConnection: true,
      retryWrites: true,
      authSource: 'admin',
      authMechanism: 'SCRAM-SHA-1'
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

module.exports = connectDB;