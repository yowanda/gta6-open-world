// input.js — keyboard + mouse input for Solara Bay.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.pressed = {};   // edge-triggered, cleared each frame by main loop
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys[e.key.toLowerCase()] && !e.repeat) this.pressed[e.key.toLowerCase()] = true;
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; } });
    // right-click must not open the browser menu while aiming with the mouse
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.down = false; });
  }
  down(k) { return !!this.keys[k]; }
  hit(k) { return !!this.pressed[k]; }
  axis() {
    let x = 0, y = 0;
    if (this.down('a') || this.down('arrowleft')) x -= 1;
    if (this.down('d') || this.down('arrowright')) x += 1;
    if (this.down('w') || this.down('arrowup')) y -= 1;
    if (this.down('s') || this.down('arrowdown')) y += 1;
    return { x, y };
  }
  endFrame() { this.pressed = {}; this.mouse.clicked = false; }
}
