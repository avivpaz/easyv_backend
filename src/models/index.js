const mongoose = require('mongoose');
const { Integration, EmailIntegration, SocialIntegration, JobPlatformIntegration } = require('./integrations');

// Existing schemas remain the same
const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  website: { type: String },
  linkedinUrl: { type: String },
  logoUrl: { type: String },
  brandColor: { type: String },
  customerId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  fullName: { type: String, required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  googleId: { type: String },
  supabaseUserId: { type: String },
  authProvider: { type: String, enum: ['local', 'google', 'supabase'], default: 'local' }, 
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
  salaryMin: { type: Number },
  salaryMax: { type: Number },
  salaryCurrency: { 
    type: String, 
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    default: 'USD'
  },
  salaryPeriod: {
    type: String,
    enum: ['hour', 'month', 'year'],
    default: 'year'
  },
  status: { 
    type: String, 
    enum: ['active', 'draft', 'closed', 'deleted'], 
    default: 'active' 
  },
  // Add reference to source integration
  sourceIntegration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Integration'
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
  // Update source enum to be more generic
  source: { 
    type: String, 
    enum: ['landing_page', 'careers_page', 'email_integration', 'social_integration', 'job_platform_integration', 'api'], 
    default: 'landing_page' 
  },
  // Add reference to source integration
  sourceIntegration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Integration'
  },
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
    required: true
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
    paypalOrderId: String,
    description: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

creditTransactionSchema.index({ 'metadata.paddleEventId': 1 }, { 
  unique: true, 
  sparse: true
});

module.exports = {
  Organization: mongoose.model('Organization', organizationSchema),
  User: mongoose.model('User', userSchema),
  Job: mongoose.model('Job', jobSchema),
  CV: mongoose.model('CV', cvSchema),
  CreditTransaction: mongoose.model('CreditTransaction', creditTransactionSchema),
  // Export all integration models
  Integration,
  EmailIntegration,
  SocialIntegration,
  JobPlatformIntegration
};