/* The game's view module looks up its canvas at import time. */
const canvas = document.createElement('canvas');
canvas.id = 'game';
document.body.appendChild(canvas);
