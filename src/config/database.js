const mongoose = require('mongoose');
const fs = require('fs');

// Add connection event listeners
mongoose.connection.on('connecting', () => {
  console.log('MongoDB: Initiating connection...');
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB: Successfully connected');
});

mongoose.connection.on('disconnecting', () => {
  console.log('MongoDB: Disconnecting...');
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB: Disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB: Connection error:', err);
});

async function connectDB() {
  // Enable mongoose debug mode in non-production
  if (process.env.NODE_ENV !== 'production') {
    mongoose.set('debug', true);
  }

  try {
    // Different connection options based on environment
    if (process.env.NODE_ENV === 'production') {
      const certPath = process.env.CA_CERT_PATH || '/var/app/current/certs/eu-west-1-bundle.pem';
      
      console.log('Checking certificate at:', certPath);
      if (!fs.existsSync(certPath)) {
        console.error(`Certificate file not found at ${certPath}`);
        process.exit(1);
      }

      console.log('Reading certificate file...');
      const cert = fs.readFileSync(certPath);
      console.log('Certificate loaded successfully');
      console.log('MongoDB URI:', process.env.MONGODB_URI);
      await mongoose.connect(process.env.MONGODB_URI, {
        tlsCAFile: certPath,
        tlsAllowInvalidCertificates: true,
      });

      // Log connection details (sanitized)
      const connectedHost = new URL(mongoose.connection.host).hostname;
      console.log('Connected to host:', mongoose.connection.host); // Direct use of host
      console.log('Database name:', mongoose.connection.name);

    } else {
      // Local development connection
      await mongoose.connect(process.env.MONGODB_URI);
    }

    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    if (error.name === 'MongooseServerSelectionError') {
      console.error('\nDetailed error analysis:');
      console.error('1. Server Selection Error - This usually means:');
      console.error('   - The MongoDB URI is incorrect or server is unreachable');
      console.error('   - SSL/TLS certificate issues');
      console.error('   - Authentication problems');

      if (process.env.NODE_ENV === 'production') {
        console.error('\n2. Certificate details:');
        const certPath = process.env.CA_CERT_PATH || '/var/app/current/certs/eu-west-1-bundle.pem';
        console.error(`   - Path: ${certPath}`);
        console.error(`   - Exists: ${fs.existsSync(certPath)}`);
        try {
          const certStats = fs.statSync(certPath);
          console.error(`   - Size: ${certStats.size} bytes`);
          console.error(`   - Last modified: ${certStats.mtime}`);
        } catch (statError) {
          console.error('   - Unable to read certificate stats:', statError.message);
        }
      }
    }
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB: Connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during connection closure:', err);
    process.exit(1);
  }
});

module.exports = connectDB;