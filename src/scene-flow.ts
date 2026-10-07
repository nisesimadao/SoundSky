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
  private point(): Point { return { x: (this.random() * 2 - 1) * .7, y: (this.random() * 2 - 1) * .7 }; }
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
    // Shared velocity and acceleration at each waypoint keep the join C2 smooth.
    const curve=(key: keyof Point)=>{
      const delta=c[key]-b[key], v0=(c[key]-a[key])*.5, v1=(d[key]-b[key])*.5;
      const a0=c[key]-2*b[key]+a[key], a1=d[key]-2*c[key]+b[key];
      const k3=10*delta-6*v0-4*v1-1.5*a0+.5*a1;
      const k4=-15*delta+8*v0+7*v1+1.5*a0-a1;
      const k5=6*delta-3*v0-3*v1-.5*a0+.5*a1;
      return b[key]+v0*t+a0*.5*t*t+k3*t**3+k4*t**4+k5*t**5;
    };
    return {x:curve('x'),y:curve('y')};
  }
}
