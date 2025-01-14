// models/integrations.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// models/integrations.js
const emailIntegrationSchema = new Schema({
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
  provider: { 
    type: String, 
    enum: ['gmail', 'outlook'], 
    required: true 
  },
  email: { 
    type: String, 
    required: true 
  },
  refreshToken: { 
    type: String, 
    required: true 
  },
  lastSyncTime: { 
    type: Date, 
    default: Date.now 
  },
  status: { 
    type: String, 
    enum: ['active', 'error', 'disconnected'], 
    default: 'active' 
  },
  lastError: String,
  providerMetadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Add compound index for unique integrations per user/org
emailIntegrationSchema.index(
  { userId: 1, organization: 1, email: 1, provider: 1 }, 
  { unique: true }
);

// Add index for faster queries
emailIntegrationSchema.index({ status: 1, lastSyncTime: 1 });

module.exports = {
  EmailIntegration: mongoose.model('EmailIntegration', emailIntegrationSchema)
};