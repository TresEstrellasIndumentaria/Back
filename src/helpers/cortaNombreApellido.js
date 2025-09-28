//función corta el nombre apellido del usuario logeado con google
const cortaNombreApellido = (nombre) => {
    let nombreGooogle = nombre.split(" ");
    return {
        nombre: nombreGooogle[0],
        apellido: nombreGooogle[1],
    };
};

module.exports = cortaNombreApellido;