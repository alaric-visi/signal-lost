/* Fixed-timestep loop. The simulation always advances in STEP-sized ticks, so
   behaviour is identical at 30, 60 or 144 fps; the leftover fraction is handed
   to render() so it can draw moving things slightly ahead and stay smooth. */
export const STEP = 1 / 120;
const MAX_FRAME = 0.1; // after a long stall, slow down rather than spiral

export function startLoop(
  update: (dt: number) => void,
  render: (ahead: number) => void,
  before: () => void = () => {},
  after: (workMs: number) => void = () => {},
): void {
  let last = performance.now();
  let acc = 0;
  function frame(now: number): void {
    acc += Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    const t0 = performance.now();
    before();
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render(acc);
    after(performance.now() - t0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
