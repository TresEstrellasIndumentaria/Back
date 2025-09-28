const express = require('express');
const { registrarse } = require('../controllers/registrarse');

const router = express.Router();

router.post('/', registrarse);



module.exports = router;