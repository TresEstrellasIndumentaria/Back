const express = require('express');
const { login, googleLogin } = require('../controllers/auth');

const router = express.Router();

//login clásico
router.post('/login', login);

//log new google
router.post('/login/google', googleLogin);

module.exports = router;