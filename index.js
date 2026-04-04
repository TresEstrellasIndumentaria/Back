const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const dbConnection = require("./src/config/db");

dotenv.config();

//creo admin 
const createAdmin = require('./src/boostrap/creaAdmin');

const authRoutes = require("./src/routes/auth");
const personaRoutes = require("./src/routes/persona");
const routerArticulo = require("./src/routes/articulo");
const routerArticuloProveedor = require("./src/routes/articuloProveedor");
const routerCategoria = require("./src/routes/categoria");
const ordenCompraRoutes = require('./src/routes/ordenCompra');


const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// DB
dbConnection();

//disparo createAdmin
createAdmin();

// Rutas
app.use("/auth", authRoutes);
app.use("/personas", personaRoutes);
app.use("/articulos", routerArticulo);
app.use("/articulosProveedor", routerArticuloProveedor);
app.use("/categorias", routerCategoria);
app.use('/ordenesCompraProv', ordenCompraRoutes);

// Puerto
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log("Servidor escuchando en puerto:", PORT);
});
