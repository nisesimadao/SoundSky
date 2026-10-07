type Point = { x: number; y: number };
/** Continuous random route: five seconds per leg, accelerated by bass attacks. */
export class SceneFlow {
  private points: Point[] = [];
  private phase = 0;
  private slow = 0;
  private fast = 0;
  private previous = 0;
  private lastHit = -Infinity;
  constructor(private random: () => number = Math.random) { this.reset(); }
  private point(): Point { return { x: (this.random() * 2 - 1) * .8, y: (this.random() * 2 - 1) * .8 }; }
  reset() {
    this.points = [{x:0,y:0}, {x:0,y:0}, this.point(), this.point()];
    this.phase = this.slow = this.fast = this.previous = 0; this.lastHit = -Infinity;
  }
  sample(bassOnset: number, now: number) {
    const bass = Number.isFinite(bassOnset) ? Math.max(0, bassOnset) : 0;
    if (bass > .001 && bass > this.previous * 1.08 + .0005 && now - this.lastHit >= 90) {
      const impulse = Math.min(Math.max(0, 1.2 - this.slow), 1 - Math.exp(-bass * 12));
      // Adding equally leaves current speed continuous, then accelerates in ~20ms.
      this.slow += impulse; this.fast += impulse; this.lastHit = now;
    }
    this.previous = bass;
  }
  step(dt: number): Point {
    const time = Math.max(0, Math.min(100, dt));
    const slowDecay = Math.exp(-time / 350), fastDecay = Math.exp(-time / 20);
    const distance = time + 125 * (this.slow * 350 * (1 - slowDecay) - this.fast * 20 * (1 - fastDecay));
    this.slow *= slowDecay; this.fast *= fastDecay;
    this.phase += distance / 5000;
    while (this.phase >= 1) { this.phase--; this.points.shift(); this.points.push(this.point()); }
    const [a,b,c,d] = this.points, t=this.phase;
    const curve=(key: keyof Point)=>.5*(2*b[key]+(-a[key]+c[key])*t+(2*a[key]-5*b[key]+4*c[key]-d[key])*t*t+(-a[key]+3*b[key]-3*c[key]+d[key])*t*t*t);
    return {x:curve('x'),y:curve('y')};
  }
}
