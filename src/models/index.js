// models/index.js
const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
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
    education: [{
      degree: String,
      institution: String,
      year: String
    }],
    experience: [{
      company: String,
      position: String,
      dates: String,
      responsibilities: [String]
    }],
    skills: [String]
  },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  fileUrl: { type: String, required: true },
  status: { type: String, enum: ['pending', 'reviewed', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  Organization: mongoose.model('Organization', organizationSchema),
  User: mongoose.model('User', userSchema),
  Job: mongoose.model('Job', jobSchema),
  CV: mongoose.model('CV', cvSchema)
};