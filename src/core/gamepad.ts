import { pad, type InputHandlers } from './input';

/* Gamepad, standard mapping. Polled once a frame.
     left stick / d-pad   move, and navigate menus
     A or right trigger   fire, and confirm
     X, B or right bumper pulse
     Start                pause */
const DEADZONE = 0.3;
const A = 0, B = 1, X = 2, RB = 5, RT = 7, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;

let prev: boolean[] = [];
let prevStick = 0;

export function pollGamepad(h: InputHandlers): void {
  let gp: Gamepad | null = null;
  if (navigator.getGamepads) {
    for (const g of navigator.getGamepads()) {
      if (g && g.connected) {
        gp = g;
        break;
      }
    }
  }
  if (!gp) {
    pad.axis = 0;
    pad.fire = false;
    return;
  }
  const down = (i: number): boolean => !!gp.buttons[i] && gp.buttons[i].pressed;
  const edge = (i: number): boolean => down(i) && !prev[i];

  let ax = gp.axes[0] || 0;
  if (Math.abs(ax) < DEADZONE) ax = 0;
  if (down(LEFT)) ax = -1;
  if (down(RIGHT)) ax = 1;
  pad.axis = ax;
  pad.fire = down(A) || down(RT);

  if (edge(A)) h.press();
  if (edge(X) || edge(B) || edge(RB)) h.pulse();
  if (edge(START)) h.togglePause();
  if (edge(UP)) h.key('ArrowUp');
  if (edge(DOWN)) h.key('ArrowDown');
  if (edge(LEFT)) h.key('ArrowLeft');
  if (edge(RIGHT)) h.key('ArrowRight');
  /* a flick of the stick also steps through menus */
  const stick = Math.sign(Math.abs(gp.axes[0] || 0) > 0.6 ? gp.axes[0] : 0);
  if (stick && stick !== prevStick) h.key(stick < 0 ? 'ArrowLeft' : 'ArrowRight');
  prevStick = stick;

  prev = gp.buttons.map((b) => b.pressed);
}
