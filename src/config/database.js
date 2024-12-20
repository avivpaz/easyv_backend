const mongoose = require('mongoose');
const fs = require('fs');

// Enable mongoose debug mode to log all operations
mongoose.set('debug', {
  color: true,
  debug: true,
  shell: true,
  verbose: true
});

// Add custom debug logging for connection events
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
  const certPath = process.env.CA_CERT_PATH || '/var/app/current/certs/eu-west-1-bundle.pem';
  
  // Add more detailed certificate checking
  console.log('Checking certificate at:', certPath);
  if (!fs.existsSync(certPath)) {
    console.error(`Certificate file not found at ${certPath}`);
    process.exit(1);
  }

  try {
    console.log('Reading certificate file...');
    const cert = fs.readFileSync(certPath);
    console.log('Certificate loaded successfully');
    
    console.log('Attempting MongoDB connection...');
    await mongoose.connect(process.env.MONGODB_URI, {
      tls: true,
      tlsCAFile: certPath,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
      directConnection: true,
      retryWrites: true,
      authSource: 'admin',
      authMechanism: 'SCRAM-SHA-1',
      serverSelectionTimeoutMS: 5000, // Lower timeout for faster feedback
      // Debug options
      debug: true,
      loggerLevel: 'debug'
    });
    
    console.log('MongoDB connection established successfully');
    
    // Log connection details (sanitized)
    const connectedHost = new URL(mongoose.connection.host).hostname;
    console.log('Connected to host:', connectedHost);
    console.log('Database name:', mongoose.connection.name);
    console.log('MongoDB version:', mongoose.version);
    
  } catch (error) {
    console.error('MongoDB connection error:', error);
    if (error.name === 'MongooseServerSelectionError') {
      console.error('\nDetailed error analysis:');
      console.error('1. Server Selection Error - This usually means:');
      console.error('   - The MongoDB URI is incorrect or server is unreachable');
      console.error('   - SSL/TLS certificate issues');
      console.error('   - Authentication problems');
      console.error('\n2. Certificate details:');
      console.error(`   - Path: ${certPath}`);
      console.error(`   - Exists: ${fs.existsSync(certPath)}`);
      try {
        const certStats = fs.statSync(certPath);
        console.error(`   - Size: ${certStats.size} bytes`);
        console.error(`   - Last modified: ${certStats.mtime}`);
      } catch (statError) {
        console.error('   - Unable to read certificate stats:', statError.message);
      }
      console.error('\n3. Connection settings:');
      console.error('   - TLS enabled: true');
      console.error('   - Direct connection: true');
      console.error('   - Auth source: admin');
      console.error('   - Auth mechanism: SCRAM-SHA-1');
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