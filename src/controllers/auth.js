const Usuario = require('../models/usuario');
const CryptoJS = require('crypto-js');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require("google-auth-library");
const cortaNombreApellido = require('../helpers/cortaNombreApellido');

//login clásico
const login = async (req, res) => { 
    
    try {
        //busco user (tiene q existir para pooder log)
        const user = await Usuario.findOne({ email: req.body.email });
        
        if (!user) { 
            return res.json({ message: 'Email incorrecto' }); 
        }
        else {
            //si exist, desencripto pass q viene de la DB
            const hashedPassword = CryptoJS.AES.decrypt(user.password, process.env.PASS_SEC);
            //paso a string la pass antes desncrip
            const OriginalPassword = hashedPassword.toString(CryptoJS.enc.Utf8);
            //comparo la q viene de la DB con la del front
            //console.log("pass:", hashedPassword)
            if (OriginalPassword !== req.body.password) {
                return res.json({ message: 'Contraseña incorrecta' });
            }

            //si el user es correcto CREO el JWT, para mayor seguridad de mi aplicacion, q se asocia con el email del user
            const token = jwt.sign({ email: user.email }, process.env.JWT_SEC);
            
            //normailizo la info q quiero enviar
            const userLog = {
                id: user._id,
                email: user.email,
                nombre: user.nombre,
                apellido: user.apellido,
                telefono: user.telefono,
                direccion: user.direccion,
                rol: user.rol,
                token,
            };
            res.json({//res --> del login -->esta info esta alojada en -->user._doc CORROBORAR
                user: userLog,
                message: "ok"
            });
        }

    } catch (error) {
        console.log(error);
    }
};

//para log google
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
//log google
const googleLogin = async (req, res) => {
    const { tokenId } = req.body; 
    try {
        const ticket = await client.verifyIdToken({
            idToken: tokenId,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const { email, name, picture } = ticket.getPayload(); 
        
        //busco el usuario en la DB
        const buscoUsuario = await Usuario.findOne({ email: email });
        //sino existe lo REGISTRO
        if (!buscoUsuario) {
            const {nombre, apellido} = cortaNombreApellido(name);
            const usuario = new Usuario({
                email: email,
                nombre,
                apellido,
                password: "google",
                foto: picture,
                isAdmin: false,
                correoVerificado: true,
            });
            await usuario.save();
            userLog = {...usuario._doc, token: tokenId}; //atento a lo q retorna usuario !! -->user._doc
        } else {
            user = buscoUsuario;
            userLog = {
                id: user._id,
                email: user.email,
                nombre: user.nombre,
                apellido: user.apellido,
                foto: user.foto,
                telefono: user.telefono,
                direccion: user.direccion,
                isAdmin: user.isAdmin,
                favoritos: user.favoritos,
                correoVerificado: user.correoVerificado,
                token: tokenId,
            };
        }        
        //console.log("userLog:", userLog);
        res.status(200).json({ user: userLog, message: "ok" }); 
    } catch (error) {
        res.status(401).json({ message: "Invalid token", error: error.message });
    }
};


module.exports = {
    login,
    googleLogin
}
