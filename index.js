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
const routerCategoria = require("./src/routes/categoria");
const ordenCompraRoutes = require('./src/routes/ordenCompra');
const remitoRoutes = require('./src/routes/remito');
const reciboRoutes = require('./src/routes/recibo');
const pagoProveedorRoutes = require('./src/routes/pagoProveedor');
const cuentaCorrienteRoutes = require('./src/routes/cuentaCorriente');
const informeRoutes = require('./src/routes/informe');


const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

const startServer = async () => {
  // DB
  await dbConnection();

  //disparo createAdmin
  await createAdmin();

  // Rutas
  app.use("/auth", authRoutes);
  app.use("/personas", personaRoutes);
  app.use("/articulos", routerArticulo);
  app.use("/categorias", routerCategoria);
  app.use('/ordenesCompraProv', ordenCompraRoutes);
  app.use('/remitos', remitoRoutes);
  app.use('/recibos', reciboRoutes);
  app.use('/pagos-proveedor', pagoProveedorRoutes);
  app.use('/cuentas-corrientes', cuentaCorrienteRoutes);
  app.use('/informes', informeRoutes);

  // Puerto
  const PORT = process.env.PORT || 3001;

  app.listen(PORT, () => {
    console.log("Servidor escuchando en puerto:", PORT);
  });
};

startServer();
