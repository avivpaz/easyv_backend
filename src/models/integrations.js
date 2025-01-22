const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const integrationSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  organization: { 
    type: Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true 
  },
  integrationType: {
    type: String,
    enum: ['email', 'social', 'jobPlatform'],
    required: true
  },
  provider: { 
    type: String,
    required: true
  },
  // Common fields across all integration types
  status: { 
    type: String, 
    enum: ['active', 'error', 'disconnected'], 
    default: 'active' 
  },
  lastSyncTime: { 
    type: Date, 
    default: Date.now 
  },
  lastError: String,
  
  // Email specific fields
  email: String,
  
  // Social specific fields
  socialHandle: String,
  socialProfile: String,
  
  // Job platform specific fields
  apiKey: String,
  platformEndpoint: String,
  
  // Generic fields for provider-specific data
  credentials: {
    type: Map,
    of: Schema.Types.Mixed,
    private: true // Ensures this field is not returned in queries by default
  },
  providerMetadata: {
    type: Map,
    of: Schema.Types.Mixed
  },
  settings: {
    type: Map,
    of: Schema.Types.Mixed
  }
}, {
  timestamps: true,
  discriminatorKey: 'integrationType' // Enables inheritance if needed
});

// Compound indexes
integrationSchema.index(
  { userId: 1, organization: 1, integrationType: 1, provider: 1 }, 
  { unique: true }
);
integrationSchema.index({ status: 1, lastSyncTime: 1 });

// Create the base model
const Integration = mongoose.model('Integration', integrationSchema);

// Create discriminator models for specific types if needed
const EmailIntegration = Integration.discriminator('email', new Schema({
  email: { type: String, required: true },
  refreshToken: { type: String, required: true }
}));

const SocialIntegration = Integration.discriminator('social', new Schema({
  socialHandle: { type: String, required: true },
  socialProfile: { type: String, required: true }
}));

const JobPlatformIntegration = Integration.discriminator('jobPlatform', new Schema({
  apiKey: { type: String, required: true },
  platformEndpoint: { type: String, required: true }
}));

module.exports = {
  Integration,
  EmailIntegration,
  SocialIntegration,
  JobPlatformIntegration
};