// models/index.js
const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  website: { type: String },
  linkedinUrl: { type: String },
  logoUrl: { type: String },
  brandColor: { type: String },
  customerId: { type: String },          // Paddle customer ID
  createdAt: { type: Date, default: Date.now }
});

// In models/index.js, update userSchema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Remove required: true since Google users won't have a password
  fullName: { type: String, required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  googleId: { type: String }, // Add this field
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' }, 
  refreshToken: { type: String },  
  createdAt: { type: Date, default: Date.now }
});

const jobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    description: String,
    location: { type: String },
    workType: { 
      type: String, 
      enum: ['remote', 'hybrid', 'onsite'], 
      default: 'hybrid' 
    },
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship'],
      default: 'full-time'
    },
    requiredSkills: [{ type: String }],
    niceToHaveSkills: [{ type: String }],
    status: { 
      type: String, 
      enum: ['active', 'draft', 'closed', 'deleted'], 
      default: 'active' 
    },
    createdAt: { type: Date, default: Date.now }
});


const cvSchema = new mongoose.Schema({
  candidate: {
    fullName: String,
    email: String,
    phone: String,
    summary: String,
    education: [{
      degree: String,
      institution: String,
      year: String
    }],
    experience: [{
      company: String,
      position: String,
      dates: String,
      responsibilities: [String],
      isRelevant: { type: Boolean, default: false } 
    }],
    skills: [String]
  },
  ranking: {
    category: {
      type: String,
      enum: ['Highly Relevant', 'Relevant', 'Not Relevant'],
      default: 'Not Relevant'
    },
    justification: {
      type: String,
      required: true
    }
  },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  fileUrl: { type: String, required: false },
  submissionType: { type: String, enum: ['file', 'text'], required: true },
  rawText: { type: String },
  status: { type: String, enum: ['pending', 'reviewed', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  visibility: {
    type: String,
    enum: ['locked', 'unlocked'],
    default: 'locked'
  },
  unlockedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    unlockedAt: { type: Date, default: Date.now }
  }]
});
const creditTransactionSchema = new mongoose.Schema({
  organization: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['purchase', 'deduction', 'refund', 'adjustment'],
    required: true 
  },
  amount: { 
    type: Number, 
    required: true  // Positive for purchases/refunds, negative for deductions
  },
  balanceAfter: { 
    type: Number, 
    required: true 
  },
  relatedEntity: {
    entityType: { 
      type: String, 
      enum: ['cv', 'other'] 
    },
    entityId: { 
      type: mongoose.Schema.Types.ObjectId, 
      refPath: 'relatedEntity.entityType' 
    }
  },
  metadata: {
    paypalOrderId: String,     // For PayPal purchases
    description: String,            // Optional description
    performedBy: {                  // User who performed the action
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Add a unique index for paddleEventId
creditTransactionSchema.index({ 'metadata.paddleEventId': 1 }, { 
  unique: true, 
  sparse: true  // Allows null values
});
module.exports = {
  Organization: mongoose.model('Organization', organizationSchema),
  User: mongoose.model('User', userSchema),
  Job: mongoose.model('Job', jobSchema),
  CV: mongoose.model('CV', cvSchema),
  CreditTransaction: mongoose.model('CreditTransaction', creditTransactionSchema)
};