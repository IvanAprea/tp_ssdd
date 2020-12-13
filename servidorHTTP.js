
const zmq = require('zeromq');
const express = require('express');
const app = express();
app.set('view engine', 'ejs');
const config = require('./config_http.json');

const PUERTO_LISTEN = config.puertoServidor;
const MOSTRAR_TOP = 4, MOSTRAR_MSJ = 5, BORRAR_MSJ = 6;

const brokers = new Map();
const PREFIJO = "message/";

function solicitarAlBroker(broker, operacion, topico) {
    const cb = function (resolve) {
        const requester = zmq.socket('req');
        requester.connect(`tcp://${broker.ip}:${broker.puerto}`);
        requester.on("message", function (reply) {
            const respuestaB = JSON.parse(reply);
            const respuestaD = { exito: respuestaB.exito, resultados: respuestaB.resultados, error: respuestaB.error };
            requester.close(); // si se pone despues de resolve no se ejecuta 
            resolve(JSON.stringify(respuestaD));
        });
        const mensaje = { idPeticion: 0, accion: operacion, topico: topico };
        requester.send(JSON.stringify(mensaje));
    }
    return new Promise(cb);
}




// configuramos la carpeta 'public' como una carpeta de contenido estatico, html, css, etc.
app.use(express.static('public'));

// index page
app.get('/', function (req, res) {
    const arrayBrokers = config.datosBroker;

    res.render('pages/index', {
        brokers: arrayBrokers
    });
});

app.get('/broker/:broker/topics', async function (req, res) {
    const idBroker = req.params.broker;
    let resultado = await solicitarAlBroker(brokers.get(idBroker), MOSTRAR_TOP, ""); //esta bien el ultimo parametro?
    res.setHeader("Content-Type", "text/html");
    res.writeHead(200);
    res.end(resultado);
});

app.get('/broker/:broker/topics/:topico', async function (req, res) {
    const idBroker = req.params.broker;
    const topico = req.params.topico;
    let resultado = await solicitarAlBroker(brokers.get(idBroker), MOSTRAR_MSJ, topico);
    res.setHeader("Content-Type", "text/plain");
    res.writeHead(200);
    res.end(resultado)
});

app.get('/broker/:broker/topics/message/:topico', async function (req, res) {
    const idBroker = req.params.broker;
    const topico = PREFIJO + req.params.topico;
    let resultado = await solicitarAlBroker(brokers.get(idBroker), MOSTRAR_MSJ, topico);
    res.setHeader("Content-Type", "text/plain");
    res.writeHead(200);
    res.end(resultado)
});

app.delete('/broker/:broker/topics/:topico', async function (req, res) {
    const idBroker = req.params.broker;
    const topico = req.params.topico;
    let resultado = await solicitarAlBroker(brokers.get(idBroker), BORRAR_MSJ, topico);
    res.setHeader("Content-Type", "text/plain");
    res.writeHead(200);
    res.end(resultado)

});

app.delete('/broker/:broker/topics/message/:topico', async function (req, res) {
    const idBroker = req.params.broker;
    const topico = PREFIJO + req.params.topico;
    let resultado = await solicitarAlBroker(brokers.get(idBroker), BORRAR_MSJ, topico);
    res.setHeader("Content-Type", "text/plain");
    res.writeHead(200);
    res.end(resultado)

});

function arranque() {
    config.datosBroker.forEach((broker) => { brokers.set(broker.id, { ip: broker.ip, puerto: broker.puerto }) });
}

arranque();

console.log("\x1b[32m", "Atendiendo en puerto " + PUERTO_LISTEN, "\x1b[0m");
app.listen(PUERTO_LISTEN);


