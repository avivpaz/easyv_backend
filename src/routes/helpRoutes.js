// routes/helpRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { submitHelp } = require('../controllers/helpController');
const authMiddleware = require('../middleware/auth');

// Configure multer for screenshots
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB total limit
    files: 3 // Max 3 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.post('/', authMiddleware, upload.array('screenshots', 3), submitHelp);

module.exports = router;