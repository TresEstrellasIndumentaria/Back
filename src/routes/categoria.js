const express = require("express");
const router = express.Router();

const {
    getCategorias,
    crearCategoria,
    editarCategoria,
    eliminarCategoria
} = require("../controllers/categoria");

router.get("/", getCategorias);
router.post("/", crearCategoria);
router.put("/:id", editarCategoria);
router.delete("/:id", eliminarCategoria);

module.exports = router;
