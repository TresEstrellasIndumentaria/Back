const mongoose = require('mongoose');
const Usuario = require('../models/persona');
const UsuarioAuth = require('../models/usuarioAuth');
const CryptoJS = require('crypto-js');

const escaparRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizarTexto = (value) => String(value || '').trim();

const buscarPersonaDuplicada = async ({ idExcluir, nombre, apellido, email, dni }) => {
    const nombreNormalizado = normalizarTexto(nombre);
    const apellidoNormalizado = normalizarTexto(apellido);
    const emailNormalizado = normalizarTexto(email).toLowerCase();
    const dniTexto = normalizarTexto(dni);
    const dniNum = dniTexto ? Number(dniTexto) : null;
    const condiciones = [];

    if (emailNormalizado) condiciones.push({ email: emailNormalizado });
    if (Number.isFinite(dniNum)) condiciones.push({ dni: dniNum });
    if (nombreNormalizado && apellidoNormalizado) {
        condiciones.push({
            nombre: { $regex: `^${escaparRegex(nombreNormalizado)}$`, $options: 'i' },
            apellido: { $regex: `^${escaparRegex(apellidoNormalizado)}$`, $options: 'i' }
        });
    }

    if (!condiciones.length) return null;

    return Usuario.findOne({
        _id: { $ne: idExcluir },
        $or: condiciones
    });
};


//trae usuarios 
const traerPersonas = async (req, res) => {
    try {
        const usuarios = await Usuario.find();
        res.json(usuarios);
    } catch (error) {
        console.error('Error al traer los usuarios:', error);
        res.status(500).json({
            msg: 'Error al traer los usuarios'
        });
    }
}

// trae por ROL
const traePersonasRol = async (req, res) => {
    try {
        const { rol } = req.params; // ← ahora sí es string

        if (!rol) {
            return res.status(400).json({
                msg: "Debe enviar un rol",
            });
        }

        const usuarios = await Usuario.find({
            rol: rol.toUpperCase(), // IMPORTANTE
        });

        if (!usuarios.length) {
            return res.status(404).json({
                msg: `No se encontraron usuarios con el rol: ${rol}`,
            });
        }

        res.json(usuarios);
    } catch (error) {
        console.error("Error al traer usuarios por rol:", error);
        res.status(500).json({
            msg: "Error al traer usuarios por rol",
        });
    }
};

//traer usuario por id
const traerPersona = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar si el ID es válido
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'El ID proporcionado no es válido.' });
        }

        const usuario = await Usuario.findById(id);

        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.status(200).json(usuario);
    } catch (error) {
        console.error('Error al traer el usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

//trae usuario por DNI
const traerPersonaPorDni = async (req, res) => {
    const { dni } = req.params;
    try {
        const usuario = await Usuario.findOne({ dni });
        if (!usuario) {
            return res.status(404).json({ msg: 'El DNI no está registrado' });
        }
        res.json(usuario);
    } catch (error) {
        console.error('Error al traer el usuario:', error);
        res.status(500).json({
            msg: 'Error al traer el usuario'
        });
    }
}

//modificar usuario
const modificarPersona = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, dni, email, password, telefono, direccion, nota, } = req.body;

        const usuario = await Usuario.findById({ _id: id });
        if (!usuario) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const nombreFinal = nombre !== undefined ? normalizarTexto(nombre) : usuario.nombre;
        const apellidoFinal = apellido !== undefined ? normalizarTexto(apellido) : usuario.apellido;
        const emailFinal = email !== undefined ? normalizarTexto(email).toLowerCase() : usuario.email;
        const dniFinal = dni !== undefined ? Number(dni) : usuario.dni;

        if (!nombreFinal || !apellidoFinal || !emailFinal) {
            return res.status(400).json({ message: "Nombre, apellido y email son obligatorios" });
        }

        if (!Number.isFinite(Number(dniFinal))) {
            return res.status(400).json({ message: "DNI invalido" });
        }

        const duplicado = await buscarPersonaDuplicada({
            idExcluir: usuario._id,
            nombre: nombreFinal,
            apellido: apellidoFinal,
            email: emailFinal,
            dni: dniFinal
        });

        if (duplicado) {
            return res.status(400).json({
                message: "Ya existe una persona con ese nombre y apellido, DNI o email"
            });
        }

        // Password
        if (password && password.trim() !== "") {
            if (!process.env.PASS_SEC) {
                return res.status(500).json({ message: "Error de configuración" });
            }
            usuario.password = CryptoJS.AES.encrypt(
                password,
                process.env.PASS_SEC
            ).toString();
        }

        // Campos permitidos
        usuario.nombre = nombreFinal;
        usuario.apellido = apellidoFinal;
        usuario.email = emailFinal;
        usuario.dni = Number(dniFinal);
        usuario.nombreApellido = `${nombreFinal} ${apellidoFinal}`;
        if (telefono) usuario.telefono = telefono;
        if (direccion) usuario.direccion = direccion;
        if (nota) usuario.nota = nota;

        await usuario.save();
        await UsuarioAuth.findOneAndUpdate(
            { personaId: usuario._id },
            { email: emailFinal }
        );

        return res.status(200).json({
            message: "Usuario modificado correctamente",
        });

    } catch (error) {
        console.error("Error al modificar usuario:", error);
        return res.status(500).json({
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// modificar proveedor/cliente (sin password)
const modificarProveedorCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nombre,
            apellido,
            dni,
            email,
            telefono,
            direccion,
            nota,
            numeroCliente,
            numeroProveedor
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ msg: 'El ID proporcionado no es valido.' });
        }

        const usuario = await Usuario.findById(id);
        if (!usuario) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }

        if (!['CLIENTE', 'PROVEEDOR'].includes(usuario.rol)) {
            return res.status(400).json({
                msg: 'Este endpoint solo permite modificar CLIENTE o PROVEEDOR'
            });
        }

        if (req.body.password !== undefined) {
            return res.status(400).json({
                msg: 'No se permite modificar password en este endpoint'
            });
        }

        const nombreFinal = nombre !== undefined ? normalizarTexto(nombre) : usuario.nombre;
        const apellidoFinal = apellido !== undefined ? normalizarTexto(apellido) : usuario.apellido;
        const emailFinal = email !== undefined ? normalizarTexto(email).toLowerCase() : usuario.email;
        const dniTexto = dni !== undefined ? normalizarTexto(dni) : normalizarTexto(usuario.dni);
        const dniFinal = dniTexto ? Number(dniTexto) : undefined;

        if (!nombreFinal || !apellidoFinal) {
            return res.status(400).json({ msg: 'Nombre y apellido son obligatorios' });
        }

        if (dniTexto && !Number.isFinite(Number(dniFinal))) {
            return res.status(400).json({ msg: 'DNI invalido' });
        }

        const duplicado = await buscarPersonaDuplicada({
            idExcluir: usuario._id,
            nombre: nombreFinal,
            apellido: apellidoFinal,
            email: emailFinal || undefined,
            dni: dniTexto ? dniFinal : undefined
        });

        if (duplicado) {
            return res.status(400).json({
                msg: 'Ya existe una persona con ese nombre y apellido, DNI o email'
            });
        }

        usuario.nombre = nombreFinal;
        usuario.apellido = apellidoFinal;
        usuario.email = emailFinal || undefined;
        usuario.dni = dniTexto ? Number(dniFinal) : undefined;
        usuario.nombreApellido = `${nombreFinal} ${apellidoFinal}`;
        if (telefono !== undefined) usuario.telefono = telefono;
        if (direccion !== undefined) usuario.direccion = direccion;
        if (nota !== undefined) usuario.nota = nota;
        if (numeroCliente !== undefined) usuario.numeroCliente = numeroCliente;
        if (numeroProveedor !== undefined) usuario.numeroProveedor = numeroProveedor;

        await usuario.save();

        return res.status(200).json({
            msg: 'Proveedor/cliente modificado correctamente',
            usuario
        });
    } catch (error) {
        console.error('Error al modificar proveedor/cliente:', error);
        return res.status(500).json({
            msg: 'Error interno del servidor',
            error: error.message
        });
    }
};

const PERMISOS_VALIDOS = [
    'CLIENTES',
    'PROVEEDORES',
    'COMPRAS',
    'ARTICULOS',
    'INVENTARIO_AJUSTE',
    'INVENTARIO_HISTORIAL',
    'INVENTARIO_VALORACION',
    'VENTAS',
    'COBROS',
    'INFORMES',
];

const actualizarPermisosEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        const permisos = Array.isArray(req.body?.permisos) ? req.body.permisos : [];

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'El ID proporcionado no es valido.' });
        }

        const permisosNormalizados = [...new Set(permisos.map((permiso) => String(permiso || '').trim().toUpperCase()))];
        const permisosInvalidos = permisosNormalizados.filter((permiso) => !PERMISOS_VALIDOS.includes(permiso));

        if (permisosInvalidos.length) {
            return res.status(400).json({
                message: `Permisos invalidos: ${permisosInvalidos.join(', ')}`
            });
        }

        const empleado = await Usuario.findById(id);
        if (!empleado) {
            return res.status(404).json({ message: 'Empleado no encontrado' });
        }

        if (empleado.rol !== 'EMPLEADO') {
            return res.status(400).json({ message: 'Los permisos solo se pueden asignar a empleados' });
        }

        empleado.permisos = permisosNormalizados;
        await empleado.save();

        await UsuarioAuth.findOneAndUpdate(
            { personaId: empleado._id },
            { permisos: permisosNormalizados },
            { new: true }
        );

        return res.status(200).json({
            message: 'Permisos actualizados correctamente',
            empleado
        });
    } catch (error) {
        console.error('Error al actualizar permisos:', error);
        return res.status(500).json({
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

const resetPasswordEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'El ID proporcionado no es valido.' });
        }

        if (!password || String(password).length < 6) {
            return res.status(400).json({ message: 'La contrasena temporal debe tener al menos 6 caracteres.' });
        }

        const empleado = await Usuario.findById(id);
        if (!empleado) {
            return res.status(404).json({ message: 'Empleado no encontrado' });
        }

        if (!['ADMIN', 'EMPLEADO'].includes(empleado.rol)) {
            return res.status(400).json({ message: 'Solo se puede resetear password de usuarios del sistema.' });
        }

        if (!process.env.PASS_SEC) {
            return res.status(500).json({ message: 'Error de configuracion' });
        }

        const passwordEncriptada = CryptoJS.AES.encrypt(
            String(password),
            process.env.PASS_SEC
        ).toString();

        empleado.password = passwordEncriptada;
        await empleado.save();

        const auth = await UsuarioAuth.findOneAndUpdate(
            { personaId: empleado._id },
            { password: passwordEncriptada, email: empleado.email },
            { new: true }
        );

        if (!auth) {
            return res.status(404).json({ message: 'Usuario de acceso no encontrado para esa persona.' });
        }

        return res.status(200).json({
            message: 'Contrasena reseteada correctamente'
        });
    } catch (error) {
        console.error('Error al resetear password:', error);
        return res.status(500).json({
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// eliminar usuario
const eliminarPersona = async (req, res) => {
    try {
        const { id } = req.params;

        const usuario = await Usuario.findByIdAndDelete(id);

        if (!usuario) {
            return res.status(404).json({
                message: 'Usuario no encontrado'
            });
        }

        res.status(200).json({
            message: 'Usuario eliminado correctamente',
            idEliminado: id
        });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({
            message: 'Error al eliminar el usuario',
            error: error.message
        });
    }
};

//modificar datos personales - el usuario logueado PUEDE modif su pass y email
const modificarMisDatos = async (req, res) => {
    try {
        const { id } = req.user; // 👈 UsuarioAuth._id

        const { passwordActual, passwordNueva } = req.body;

        const usuario = await UsuarioAuth.findById(id);
        if (!usuario) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }

        // PASSWORD
        if (passwordNueva) {
            if (!passwordActual) {
                return res.status(400).json({
                    msg: 'Debe ingresar la contraseña actual'
                });
            }

            const passwordDB = CryptoJS.AES.decrypt(
                usuario.password,
                process.env.PASS_SEC
            ).toString(CryptoJS.enc.Utf8);

            if (passwordDB !== passwordActual) {
                return res.status(400).json({
                    msg: 'Contraseña actual incorrecta'
                });
            }

            usuario.password = CryptoJS.AES.encrypt(
                passwordNueva,
                process.env.PASS_SEC
            ).toString();
        }

        await usuario.save();

        res.json({ msg: 'Datos actualizados correctamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error del servidor' });
    }
};



module.exports = {
    traerPersonas,
    traePersonasRol,
    traerPersona,
    traerPersonaPorDni,
    modificarPersona,
    modificarProveedorCliente,
    actualizarPermisosEmpleado,
    resetPasswordEmpleado,
    eliminarPersona,
    modificarMisDatos
}



/* 

Próximo paso (vos elegís)

1️⃣ Agregar confirmación modal antes de guardar
2️⃣ Forzar logout si cambia el password
3️⃣ Validaciones fuertes (regex password)
4️⃣ Integrarlo con Redux


*/
