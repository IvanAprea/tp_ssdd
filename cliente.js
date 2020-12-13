const readline = require('readline');
const Mediador = require('./mediador.js');
const AlmacenMensajes = require('./almacenMensajes.js');
const Reloj = require('./reloj.js');
const ListaConectados = require('./listaConectados.js');

const zmq = require('zeromq');

const configCliente = require('./config_cliente.json');

const ID_CLIENTE = process.argv[2];

const FIN = "bye";
const MOSTRAR_USUARIOS = "showusers";
const ESCRIBIR_MSJ = "write";
const ESCRIBIR_MSJ_TODOS = "writeall";
const ESCRIBIR_EN_GRUPO = "writegroup";
const UNIRSE_GRUPO = "group";

const TOPICO_HB = "heartbeat";
const TOPICO_ALL = "message/all";
const PREFIJO_TOPICO = "message/";
const PREFIJO_GRUPO = "g_";

const socketAll = zmq.socket('sub'), socketHeartbeat = zmq.socket('sub'), socketCliente = zmq.socket('sub');

const listaSockets = new Map();
const cacheBroker = new Map(); // [idCliente, broker]
var reloj;
var almacenMensajes;
var mediador;
var listaConectados;

async function arranque() {

    console.log('\x1b[33m%s\x1b[0m', "Bienvenido " + ID_CLIENTE + "!.");

    reloj = new Reloj(configCliente.ipNTP, configCliente.puertoNTP, configCliente.periodoReloj,"false");
    mediador = new Mediador(configCliente.ipCoordinador, configCliente.puertoCoordinador);
    almacenMensajes = new AlmacenMensajes(ID_CLIENTE);
    listaConectados = new ListaConectados(reloj, configCliente.plazoMaxHeart, configCliente.periodoListaHeart);

    const msjInicioSesion = {
        "idPeticion": "",
        "accion": "2",
        "topico": PREFIJO_TOPICO + ID_CLIENTE
    }

    let respuestaSesion = await mediador.iniciarSesion(msjInicioSesion);

    if (respuestaSesion.exito) {

        let datosAll = recuperarDatos(TOPICO_ALL, respuestaSesion.resultados.datosBroker);

        socketAll.connect('tcp://' + datosAll.ip + ":" + datosAll.puerto);
        socketAll.subscribe(TOPICO_ALL);

        let datosHB = recuperarDatos(TOPICO_HB, respuestaSesion.resultados.datosBroker);

        socketHeartbeat.connect('tcp://' + datosHB.ip + ":" + datosHB.puerto);
        socketHeartbeat.subscribe(TOPICO_HB);

        let datosCliente = recuperarDatos(PREFIJO_TOPICO + ID_CLIENTE, respuestaSesion.resultados.datosBroker);

        socketCliente.connect('tcp://' + datosCliente.ip + ":" + datosCliente.puerto);
        socketCliente.subscribe(PREFIJO_TOPICO + ID_CLIENTE);

        socketAll.on('message', recibirMensaje);
        socketHeartbeat.on('message', recibirHB);
        socketCliente.on('message', recibirMensaje);

        const request = {
            "idPeticion": "", // este valor se setea en el mediador
            "accion": "1",
            "topico": TOPICO_HB,
        }

        function callback(respuesta)  // la respuesta es la del formato oficial 
        {
            cacheBroker.set(TOPICO_HB, {
                "ip": respuesta.resultados.datosBroker[0].ip,
                "puerto": respuesta.resultados.datosBroker[0].puerto
            });
            setInterval(emitirHeartbeat, configCliente.periodoHeartbeat);
        }
        mediador.pedirAlCoord(request, callback);
    }
    else {
        //hay que ver si se agrega algun error que pueda llegar aca.
    }
    
}

function recuperarDatos(topico,arregloBrokers) {

    return arregloBrokers.find(broker => broker.topico == topico);

}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', function (comando) {
    const comandoAct = comando.split(' ');
    if (comandoAct[0] != FIN) {
        if (comandoAct[0] === MOSTRAR_USUARIOS) {
            showusers();
        }
        else
        if (comandoAct[0] === ESCRIBIR_MSJ){
            write(comandoAct);
        }
        else
        if (comandoAct[0] === ESCRIBIR_MSJ_TODOS) {
            writeall(comandoAct);
        }
        else
        if (comandoAct[0] === ESCRIBIR_EN_GRUPO) {
            if (comandoAct.length === 2) {
                writeGroup(comandoAct);
            }
            else {
                logearError("Cantidad invalida de argumentos");
            }
        }
        else
        if (comandoAct[0] === UNIRSE_GRUPO) {
            if (comandoAct.length === 2) {
                grupo(PREFIJO_GRUPO + comandoAct[1]);
            }
            else {
                logearError("Cantidad invalida de argumentos");
            }
        }
        else {
            logearError("Comando erroneo... intente nuevamente");
        }
    }
    else {
        cerrar();
    }
});

function cerrar() {
    rl.close();
    socketAll.close();
    socketHeartbeat.close();
    socketCliente.close();
    Array.from(listaSockets.values()).forEach((socket) => { socket.close(); });
    logearTexto(`Hasta luego ${ID_CLIENTE}!`);
    process.exit();
}

function logearError(mensaje) {
    console.log("\033[31m" + mensaje + "\x1b[37m")
}

function logearTexto(mensaje) {
    console.log("\x1b[33m" + mensaje + "\x1b[37m"); 
}

function nuevaOperacionConsola() {
    console.log('\x1b[33m%s\x1b[0m', "/*---------------------------------------*/");
    console.log('\x1b[33m%s\x1b[0m', "Escriba un comando para continuar...");
}

function preguntar(pregunta) {
    return new Promise((resolve, reject) => {
        rl.question(pregunta, (input) => resolve(input));
    });
}

async function writeGroup(comandoAct) {
    const topico = PREFIJO_GRUPO + comandoAct[1];

    if (listaSockets.has(topico)) {
        let mensaje = await preguntar("Mensaje: ");
        if (mensaje === "") {
            logearError("No se puede enviar un mensaje vacio!");
        }
        else {
            prepararMensaje(topico, mensaje);
        }
    }
    else {
        logearError("Usted no pertenece al grupo al que quiere escribir.");
    }
    nuevaOperacionConsola();
}

async function write(comandoAct) {
    if (comandoAct.length === 2) {

        const idReceptor = comandoAct[1];

        if (listaConectados.existeCliente(idReceptor)) {


            let mensaje = await preguntar("Mensaje: ");
            if (mensaje === "") {
                logearError("No se puede enviar un mensaje vacio!")
            }
            else {
                prepararMensaje(idReceptor, mensaje);
            }
        }
        else {
            logearError("El cliente " + idReceptor + " no existe.");
        }
    }
    else {
        logearError("Cantidad invalida de argumentos");
    }
    nuevaOperacionConsola();
}

async function writeall(comandoAct) {
    let mensaje = await preguntar("Mensaje: ");
    if (mensaje == "") {
        logearError("No se puede enviar un mensaje vacio!")
    }
    else {
        prepararMensaje("all", mensaje);
    }
    nuevaOperacionConsola();
}

function showusers() {
    const listaUsuarios = listaConectados.obtenerLista(); //devuelve entries
    console.log('\x1b[33m%s\x1b[0m', "/*---------------------------------------*/");
    console.log("Usuarios conectados: ");
    console.log('\x1b[33m%s\x1b[0m', " ");
    for (let [key, value] of listaUsuarios) {
        if (value.online)
            console.log(key + " - ONLINE");
        else
            console.log(key + " - OFFLINE");
    }
    console.log('\x1b[33m%s\x1b[0m', "/*---------------------------------------*/");
    nuevaOperacionConsola();
}

function grupo(idGrupo) {
    const request = {
        "idPeticion": "", // este valor se setea en el mediador
        "accion": "2",
        "topico": PREFIJO_TOPICO + idGrupo
    }

    function callbackGrupo(rtaCoord) {

        logearTexto("Se lo ha agregado al grupo correctamente!");

        const brokerGrupo = recuperarDatos(PREFIJO_TOPICO + idGrupo, rtaCoord.resultados.datosBroker);
        const socket = zmq.socket('sub');

        socket.connect(`tcp://${brokerGrupo.ip}:${brokerGrupo.puerto}`);
        socket.subscribe(PREFIJO_TOPICO + idGrupo);
        socket.on("message", recibirMensaje);
        listaSockets.set(idGrupo, socket); // agrego el socket a la lista de grupos
    }

    logearTexto("Solicitando operacion...");
    mediador.pedirAlCoord(request, callbackGrupo);
    nuevaOperacionConsola();
}

function enviarMensaje(broker, topico, mensaje) {
    const socket = zmq.socket('pub');

    socket.connect(`tcp://${broker.ip}:${broker.puerto}`);

    socket.on('connect', function (fd, ep) {
        socket.send([topico, JSON.stringify(mensaje)]);
        socket.unmonitor();
        socket.close();
    });
    socket.monitor(100, 0);
}

function prepararMensaje(idReceptor, stringMensaje) {
    const topico = PREFIJO_TOPICO + idReceptor;
    const objMensaje = {
        "emisor": ID_CLIENTE,
        "mensaje": stringMensaje,
        "fecha": new Date(reloj.solicitarTiempo()).toISOString()
    };
    if (cacheBroker.has(idReceptor)) {
        enviarMensaje(cacheBroker.get(idReceptor), topico, objMensaje); 
    }
    else {
        const request = {
            "idPeticion": "", // este valor se setea en el mediador
            "accion": "1",
            "topico": PREFIJO_TOPICO + idReceptor,
        }

        function callback(respuesta)  // la respuesta es la del formato oficial 
        {
            cacheBroker.set(idReceptor, {
                "ip": respuesta.resultados.datosBroker[0].ip,
                "puerto": respuesta.resultados.datosBroker[0].puerto
            }); 
            enviarMensaje(cacheBroker.get(idReceptor), topico, objMensaje);
        }
        mediador.pedirAlCoord(request, callback);
    }
} 

function recibirMensaje(topico, mensajeJSON) {
    const mensaje = JSON.parse(mensajeJSON);
    if (mensaje.emisor != ID_CLIENTE) {
        almacenMensajes.almacenarMensaje(topico, mensaje);
        console.log("\x1b[32m", "[" + topico + " | " + mensaje.emisor + " | " + mensaje.fecha + " | " + mensaje.mensaje + "]" ,"\x1b[0m")
    }
}


function recibirHB(topico, mensaje) {
    const msjHB = JSON.parse(mensaje);
    listaConectados.actualizarHeartbeat(msjHB);
}

function emitirHeartbeat() {

    const msjHB = {
        "emisor": ID_CLIENTE,
        "fecha": new Date(reloj.solicitarTiempo()).toISOString()
    }

    enviarMensaje(cacheBroker.get(TOPICO_HB), TOPICO_HB, msjHB);
}

arranque();
nuevaOperacionConsola();