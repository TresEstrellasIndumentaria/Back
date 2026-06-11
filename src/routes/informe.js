const express = require('express');
const { obtenerInformeFinanciero } = require('../controllers/informeFinanciero');
const verifyToken = require('../middlewares/verifyToken');

const router = express.Router();

router.get('/financiero', verifyToken, obtenerInformeFinanciero);

module.exports = router;
