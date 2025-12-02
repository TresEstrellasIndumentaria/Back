const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const dbConnection = require('./src/config/db');

dotenv.config();

//importo rutas
const registrarseRoutes = require('./src/routes/registrarse');
const routerAuth = require('./src/routes/auth');
const routerUsuario = require('./src/routes/usuario');
const routerArticulo = require('./src/routes/articulo');


const app = express();

//middlewares
app.use(express.json());
app.use(cors());

// Configuración de la base de datos
dbConnection();

//declaro rutas
app.use('/registrarse', registrarseRoutes);
app.use('/auth', routerAuth);
app.use('/usuario', routerUsuario);
app.use('/articulo', routerArticulo);


//puerto
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log("Puerto escuchando en:", PORT);
});