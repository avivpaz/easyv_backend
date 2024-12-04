// routes/organizationRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { updateOrganization, getOrganization } = require('../controllers/organizationController');
const authMiddleware = require('../middleware/auth');

// Configure multer for logo uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG files are allowed'));
    }
  }
});

router.put('/:id', authMiddleware, upload.single('logo'), updateOrganization);
router.get('/:id', authMiddleware, getOrganization);

module.exports = router;