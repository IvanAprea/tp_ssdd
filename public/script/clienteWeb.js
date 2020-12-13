
const OK = 200, OP_INV = 403, PATH_NF = 404;

//A falta de otra cosa:
var brokerAct; 
var topicoAct;
const PATH = window.location.origin;

/* FUNCIONES CALLBACK */

function callBackTopicos(response) {
    const rtaParseada = JSON.parse(response);
    document.getElementById('boxTopicos').style.display = "none";
    document.getElementById('boxMensajes').style.display = "none";
    if (rtaParseada.exito) {
            const listaTopicos = rtaParseada.resultados.listaTopicos;
            document.getElementById('listaTopicos').innerHTML = '';
            listaTopicos.forEach(element => document.getElementById('listaTopicos').innerHTML += ("<li><button aria-setsize='4' aria-posinset='1' onclick= mostrarMensajes('" + brokerAct + "','" + element + "') > " + element + "</button ></li > "));
            document.getElementById('boxTopicos').style.display = "block";
    }
    else {
        alert("Error obteniendo lista de topicos");
    }
}

function callBackMensajes(response) {
    const rtaParseada = JSON.parse(response);
    document.getElementById('boxMensajes').style.display = "none";
    if (rtaParseada.exito) {
        const mensajes = rtaParseada.resultados.mensajes;
        if (mensajes.length === 0) {
            document.getElementById('listaMensajes').innerHTML = "(vacio)";
        }
        else {
            document.getElementById('contenedorBoton').innerHTML = ("<button id='delete-image' onClick=eliminarMensajes('" + brokerAct + "','" + topicoAct + "')><img src='images/deleteIcon.jpg'></button>");
            document.getElementById('listaMensajes').innerHTML = '';
            mensajes.forEach(element => document.getElementById('listaMensajes').innerHTML += ("<li>" + "Mensaje: " + element.mensaje + " de: " + element.emisor + "</li>"));
        }
        document.getElementById('boxMensajes').style.display = "block";
    }
    else {
        alert("Error obteniendo lista de mensajes");
    }
}

function callBackElimMensajes(response) {
    const rtaParseada = JSON.parse(response);
    if (rtaParseada.exito) {
        document.getElementById('contenedorBoton').innerHTML = '';
        document.getElementById('listaMensajes').innerHTML = 'Mensajes eliminados correctamente.';
    }
    else {
        alert("Error eliminando los mensajes");
    }
}

function callBackListaBrokers(response) {
    document.getElementById('listaBrokers').innerHTML = response;
}




/* FUNCIONES ONCLICK */

function mostrarTopicos(idBroker) {
    //aca hacer aparecer la lista en si
    document.getElementById("CartelSeleccioneB").style.display = "none";
    document.getElementById('nombreBroker').innerHTML = ("Lista de topicos de " + idBroker);
    brokerAct = idBroker;
    httpGetAsync(`${PATH}/broker/${idBroker}/topics`, callBackTopicos);
}

function mostrarMensajes(idBroker, topico) {
    topicoAct = topico;
    document.getElementById('nombreTopico').innerHTML = ("Lista de mensajes de " + topico);
    httpGetAsync(`${PATH}/broker/${idBroker}/topics/${topico}`, callBackMensajes);
}

function eliminarMensajes(idBroker, topico) {
    httpDeleteAsync(`${PATH}/broker/${idBroker}/topics/${topico}`, callBackElimMensajes)
}


/* FUNCIONES XHR */

function httpGetAsync(theUrl, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    }
    xmlHttp.open("GET", theUrl, true); // true for asynchronous 
    xmlHttp.send(null);
}

function httpDeleteAsync(theUrl, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    }
    xmlHttp.open("DELETE", theUrl, true); // true for asynchronous 
    xmlHttp.send(null);
}