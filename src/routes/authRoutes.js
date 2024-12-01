const express = require('express');
const router = express.Router();
const { login,createUser } = require('../controllers/authController');
const { searchFacebookJobs,searchAndCreateJob } = require('../controllers/googleController');

router.post('/login', login);
router.post('/register', createUser);
router.get('/', searchFacebookJobs);

module.exports = router;