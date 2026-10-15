// Ejecutar: node --test tests/matrix-rain.test.cjs (sin dependencias).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
let matrixSource = source.slice(source.indexOf('    function initMatrixRain()'), source.indexOf('    function initNavScroll()'));
const end = matrixSource.lastIndexOf('\n    }');
// Observar el cierre privado sólo en esta prueba, sin API de depuración en el sitio.
matrixSource = matrixSource.slice(0, end)
    + '\nwindow.probe = () => ({ rainTime, streams, settings });'
    + matrixSource.slice(end);

function createScene({ width = 1440, height = 900, reduced = false, scrollY = 0 } = {}) {
    let sequence = 0;
    let time = 0;
    let draws = [];
    let renders = 0;
    const pending = new Map();
    const events = {};
    const documentEvents = {};
    const mediaEvents = {};
    const media = { matches: reduced, addEventListener: (name, cb) => { mediaEvents[name] = cb; } };
    const context = {
        setTransform() {},
        clearRect() { draws = []; renders++; },
        fillText(char, x, y) {
            draws.push({ char, x, y, font: this.font, alpha: this.globalAlpha, blur: this.shadowBlur });
        }
    };
    const canvas = {
        getContext: () => context,
        getBoundingClientRect: () => ({ width: window.innerWidth, height: window.innerHeight })
    };
    const window = {
        innerWidth: width, innerHeight: height, devicePixelRatio: 3, scrollY,
        matchMedia: () => media,
        addEventListener: (name, cb) => { events[name] = cb; }
    };
    const document = {
        hidden: false, getElementById: () => canvas,
        addEventListener: (name, cb) => { documentEvents[name] = cb; }
    };
    vm.runInNewContext(matrixSource + ';initMatrixRain();', {
        window, document,
        requestAnimationFrame(cb) {
            pending.set(++sequence, cb);
            assert.equal(pending.size, 1, 'un solo requestAnimationFrame pendiente');
            return sequence;
        },
        cancelAnimationFrame(id) { pending.delete(id); }
    });
    return {
        window, document, events, documentEvents, media, mediaEvents, canvas, pending,
        get draws() { return draws; }, get renders() { return renders; },
        get state() { return window.probe(); },
        step(ms = 1000 / 60) {
            time += ms;
            const callbacks = [...pending.values()];
            pending.clear();
            callbacks.forEach(cb => cb(time));
        },
        settle() { for (let i = 0; i < 110; i++) this.step(1000 / 60); }
    };
}

test('el scroll conserva tamaño y posición de las columnas sin zoom', () => {
    const scene = createScene();
    scene.state.streams.forEach(stream => { stream.speed = 0; });
    const initial = scene.draws;
    assert(initial.length > 100);
    assert(new Set(initial.map(d => d.font)).size > 8, 'varias profundidades proyectadas');
    for (const scrollY of [250, 1900, 9300, 80, -50, 0]) {
        scene.window.scrollY = scrollY;
        scene.settle();
        assert.deepEqual(scene.draws, initial, 'el scroll no modifica la proyección');
    }
    assert.deepEqual(createScene({ scrollY: 2000 }).draws, initial, 'misma vista al cargar con scroll restaurado');
});

test('la lluvia sigue cayendo al hacer scroll con límites de tamaño y brillo', () => {
    const scene = createScene();
    for (const scrollY of [100, 800, 1900, 5000, 9300, 80, -50]) {
        scene.window.scrollY = scrollY;
        scene.settle();
        assert(scene.draws.length > 0 && scene.draws.length <= 192 * 24);
        assert(scene.draws.every(d => Number.isFinite(d.x + d.y) && parseFloat(d.font) <= 53 && d.alpha <= 0.95));
    }
    const { rainTime } = scene.state;
    const before = scene.draws;
    scene.settle();
    assert(scene.state.rainTime > rainTime, 'la lluvia sigue animada');
    assert.notDeepEqual(scene.draws, before, 'los caracteres siguen cayendo');
});

test('resize conserva la escena, limita resolución móvil y mantiene un solo ciclo', () => {
    const scene = createScene();
    const streams = scene.state.streams;
    const original = JSON.stringify(streams);
    assert.equal(scene.canvas.width, 1440 * 1.75);
    scene.window.innerWidth = 390; scene.window.innerHeight = 844;
    scene.events.resize(); scene.step(); scene.step(50);
    assert.equal(scene.canvas.width, 390 * 1.5);
    assert.equal(scene.state.streams, streams);
    assert.equal(JSON.stringify(streams), original);
    assert.equal(scene.pending.size, 1);
    assert(scene.draws.length > 0);
    scene.window.innerWidth = 3840; scene.window.innerHeight = 2160;
    scene.events.resize(); scene.step(50);
    assert(scene.canvas.width * scene.canvas.height < 4005000, 'presupuesto de píxeles en pantallas grandes');
    assert.equal(scene.state.streams, streams);
});

test('pausa oculta, reanudación y movimiento reducido estático incluso con scroll', () => {
    const scene = createScene();
    scene.document.hidden = true; scene.documentEvents.visibilitychange();
    assert.equal(scene.pending.size, 0);
    const rainTime = scene.state.rainTime;
    scene.step(30000);
    assert.equal(scene.state.rainTime, rainTime);
    scene.document.hidden = false; scene.documentEvents.visibilitychange();
    scene.documentEvents.visibilitychange();
    assert.equal(scene.pending.size, 1);
    scene.media.matches = true; scene.mediaEvents.change();
    assert.equal(scene.pending.size, 0);
    const image = scene.draws;
    scene.window.scrollY = 2000; scene.step(1000);
    assert.deepEqual(scene.draws, image);
    scene.events.resize();
    assert.deepEqual(scene.draws, image);
    scene.media.matches = false; scene.mediaEvents.change();
    assert.equal(scene.pending.size, 1);
    const staticScene = createScene({ reduced: true });
    assert(staticScene.draws.length > 0);
    assert.equal(staticScene.pending.size, 0);
});

test('brillo localizado en las posiciones proyectadas, salida suave y táctil independiente', () => {
    const scene = createScene();
    const baseline = createScene();
    const sample = scene.draws[Math.floor(scene.draws.length / 2)];
    scene.events.pointermove({ pointerType: 'mouse', clientX: sample.x, clientY: sample.y });
    for (let i = 0; i < 30; i++) { scene.step(); baseline.step(); }
    const delta = () => scene.draws.map((d, i) => d.alpha - baseline.draws[i].alpha);
    assert(Math.max(...delta()) > 0.1);
    assert(delta().some(value => value === 0));
    scene.events.pointerout({ relatedTarget: null });
    scene.step(); baseline.step();
    assert(Math.max(...delta()) > 0.01, 'el brillo no desaparece de golpe');
    for (let i = 0; i < 100; i++) { scene.step(); baseline.step(); }
    assert(Math.max(...delta()) < 0.001);
    const touch = createScene(); const control = createScene();
    touch.events.pointermove({ pointerType: 'touch', clientX: sample.x, clientY: sample.y });
    for (let i = 0; i < 30; i++) { touch.step(); control.step(); }
    assert.deepEqual(touch.draws, control.draws);
});
