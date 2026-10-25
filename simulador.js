// ================= 1. Elementos de la página =================
const inputCarga = document.getElementById("carga");
const inputMasa = document.getElementById("masa");
const inputVelocidad = document.getElementById("velocidad");
const inputCampo = document.getElementById("campo");
const selectDireccion = document.getElementById("direccionCampo");
const sliderEscala = document.getElementById("escala");
const sliderRapidez = document.getElementById("rapidez");
const btnIniciar = document.getElementById("btnIniciar");
const btnPausar = document.getElementById("btnPausar");
const btnReiniciar = document.getElementById("btnReiniciar");

const salidaError = document.getElementById("mensajeError");
const salidaEscala = document.getElementById("valorEscala");
const salidaRapidez = document.getElementById("valorRapidez");
const salidaFuerza = document.getElementById("resFuerza");
const salidaRadio = document.getElementById("resRadio");
const salidaPeriodo = document.getElementById("resPeriodo");
const salidaFrecuencia = document.getElementById("resFrecuencia");
const salidaSentido = document.getElementById("resSentido");

const lienzo = document.getElementById("lienzo");
const ctx = lienzo.getContext("2d");

// ================= 2. Estado de la simulación =================
let escala = 25;           // píxeles por metro (slider)
let rapidez = 0.3;         // cámara lenta: 1 = tiempo real (slider)
let animando = false;      // ¿se está moviendo?
let pausado = false;       // ¿está en pausa?
let theta = 0;             // ángulo actual de la partícula (rad)
let thetaInicial = 0;      // ángulo donde arranca
let sentido = 1;           // +1 = horario, -1 = antihorario (en pantalla)
let omega = 0;             // velocidad angular (rad/s)
let radioM = 0;            // radio de la trayectoria en metros
let radioPx = 0;           // radio de la trayectoria en píxeles
let direccionActual = "saliente";
let ultimoTiempo = null;   // tiempo del cuadro anterior (ms)

// ================= 3. Dibujo =================
function dibujarSimboloSaliente(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.strokeStyle = "#5b31bd";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.fillStyle = "#5b31bd";
    ctx.fill();
}

function dibujarSimboloEntrante(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.strokeStyle = "#5b31bd";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 5, y - 5);
    ctx.lineTo(x + 5, y + 5);
    ctx.moveTo(x - 5, y + 5);
    ctx.lineTo(x + 5, y - 5);
    ctx.stroke();
}

function dibujarGrilla(direccion) {
    for (let x = 25; x < lienzo.width; x += 50) {
        for (let y = 25; y < lienzo.height; y += 50) {
            if (direccion === "saliente") {
                dibujarSimboloSaliente(x, y);
            } else {
                dibujarSimboloEntrante(x, y);
            }
        }
    }
}

function dibujarTrayectoria() {
    const cx = lienzo.width / 2;
    const cy = lienzo.height / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, radioPx, 0, 2 * Math.PI);
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
}

function dibujarFlecha(x1, y1, x2, y2, color, etiqueta) {
    const angulo = Math.atan2(y2 - y1, x2 - x1);
    const punta = 10;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - punta * Math.cos(angulo - Math.PI / 6), y2 - punta * Math.sin(angulo - Math.PI / 6));
    ctx.lineTo(x2 - punta * Math.cos(angulo + Math.PI / 6), y2 - punta * Math.sin(angulo + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;

    ctx.font = "bold 16px Segoe UI";
    ctx.fillText(etiqueta, x2 + 6, y2 - 6);
}

function dibujarParticula() {
    const cx = lienzo.width / 2;
    const cy = lienzo.height / 2;

    // posición a partir del ángulo
    const x = cx + radioPx * Math.cos(theta);
    const y = cy + radioPx * Math.sin(theta);

    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();

    // v: tangente al círculo, en el sentido de giro
    const vx = -Math.sin(theta) * sentido;
    const vy = Math.cos(theta) * sentido;
    dibujarFlecha(x, y, x + vx * 50, y + vy * 50, "yellow", "v");

    // F: siempre hacia el centro
    const fx = (cx - x) / radioPx;
    const fy = (cy - y) / radioPx;
    dibujarFlecha(x, y, x + fx * 50, y + fy * 50, "lime", "F");
}

function dibujarEscena() {
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    dibujarGrilla(direccionActual);
    dibujarTrayectoria();
    dibujarParticula();
}

// ================= 4. Física =================
function calcular() {
    const q = Number(inputCarga.value) * 1e-6;   // µC → C
    const m = Number(inputMasa.value) * 1e-6;    // mg → kg
    const v = Number(inputVelocidad.value);      // m/s
    const B = Number(inputCampo.value);          // T

    // validación: la carga puede ser negativa, pero no cero
    if (q === 0 || m <= 0 || v <= 0 || B <= 0) {
        salidaError.textContent = "La carga no puede ser cero. Masa, velocidad y campo deben ser mayores a cero.";
        return false;
    }
    salidaError.textContent = "";   // todo bien: borrar el mensaje

    const F = Math.abs(q) * v * B;                   // F = |q|·v·B
    const r = (m * v) / (Math.abs(q) * B);           // r = m·v / (|q|·B)
    const T = (2 * Math.PI * m) / (Math.abs(q) * B); // T = 2π·m / (|q|·B)
    const f = 1 / T;                                 // f = 1/T

    salidaFuerza.textContent = F.toExponential(3) + " N";
    salidaRadio.textContent = r.toFixed(4) + " m";
    salidaPeriodo.textContent = T.toFixed(4) + " s";
    salidaFrecuencia.textContent = f.toFixed(4) + " Hz";

    // datos para la animación
    omega = 2 * Math.PI / T;   // = |q|·B/m
    radioM = r;
    radioPx = radioM * escala;
    direccionActual = selectDireccion.value;

    // la tabla: dónde arranca y hacia dónde gira
    if ((q > 0 && direccionActual === "saliente") || (q < 0 && direccionActual === "entrante")) {
        thetaInicial = -Math.PI / 2;   // arriba
        sentido = 1;                   // horario
        salidaSentido.textContent = "Horario";
    } else {
        thetaInicial = Math.PI / 2;    // abajo
        sentido = -1;                  // antihorario
        salidaSentido.textContent = "Antihorario";
    }
    theta = thetaInicial;
    return true;
}

// ================= 5. Animación =================
function animar(tiempo) {
    if (!animando) return;   // si pausaron, el bucle se corta acá

    if (ultimoTiempo !== null) {
        const dt = (tiempo - ultimoTiempo) / 1000;   // ms → s
        theta += sentido * omega * dt * rapidez;
    }
    ultimoTiempo = tiempo;

    dibujarEscena();
    requestAnimationFrame(animar);   // pedir el próximo cuadro
}

function iniciar() {
    if (!pausado) {               // solo si arrancamos de cero
        if (!calcular()) return;  // datos inválidos: no arranca
        dibujarEscena();
    }
    pausado = false;
    btnIniciar.textContent = "Iniciar";

    if (!animando) {              // evita arrancar dos bucles a la vez
        animando = true;
        ultimoTiempo = null;
        requestAnimationFrame(animar);
    }
}

function pausar() {
    if (!animando) return;    // si ya está quieto, no hace nada
    animando = false;
    pausado = true;
    btnIniciar.textContent = "Reanudar";
}

function reiniciar() {
    animando = false;
    pausado = false;
    btnIniciar.textContent = "Iniciar";
    if (!calcular()) return;  // toma los valores actuales de los inputs
    dibujarEscena();
}

// ================= 6. Botones y sliders =================
btnIniciar.addEventListener("click", iniciar);
btnPausar.addEventListener("click", pausar);
btnReiniciar.addEventListener("click", reiniciar);

sliderEscala.addEventListener("input", function () {
    escala = Number(sliderEscala.value);
    salidaEscala.textContent = escala;
    radioPx = radioM * escala;   // mismo radio físico, otro tamaño en pantalla
    dibujarEscena();
});

sliderRapidez.addEventListener("input", function () {
    rapidez = Number(sliderRapidez.value);
    salidaRapidez.textContent = rapidez;
    // no hace falta redibujar: animar() usa el valor nuevo en el próximo cuadro
});

// Al abrir la página, mostrar el estado inicial
if (calcular()) {
    dibujarEscena();
}