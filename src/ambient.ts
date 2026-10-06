
const vertex = `attribute vec2 aPosition; varying vec2 vUV; void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const fragment = `precision mediump float;
varying vec2 vUV; uniform sampler2D uArt; uniform float uTime; uniform float uAspect;
void main(){
 vec2 uv=vUV;
 float t=uTime*.045;
 uv+=vec2(sin(uv.y*3.8+t),cos(uv.x*3.2+t*.7))*.022;
 vec3 c=vec3(0.); float r=.105;
 for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){
  c+=texture2D(uArt,clamp(uv*.72+.14+vec2(float(x),float(y))*r,0.,1.)).rgb/9.;
 }}
 float lum=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(lum),c,.58);
 float ribbon=exp(-pow((uv.y-.43-.10*sin(uv.x*3.+t*.35)) * 3.9,2.));
 float vignette=1.-smoothstep(.15,.8,length((vUV-.5)*vec2(1.,.85)));
 vec3 base=vec3(.037,.039,.052);
 gl_FragColor=vec4(base+c*(.075+.075*vignette)+c*ribbon*.035,1.);
}`;
/** At most 640×360, 10 frames/second, stopped when hidden or closed. */
export class Ambient {
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private buffer: WebGLBuffer | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private frame: number | null = null;
  private active = false;
  private disposed = false;
  private generation = 0;
  private artwork = '';
  private started = performance.now();
  private flowSpeed = 1;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private resize = new ResizeObserver(() => this.draw());
  private visibility = () => this.schedule();
  private motionChange = () => this.schedule();
  constructor(private canvas: HTMLCanvasElement, private fallback: HTMLElement) {
    const attributes: WebGLContextAttributes = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' };
    this.gl = canvas.getContext('webgl', attributes);
    if (this.gl) this.initialize();
    if (!this.program) canvas.hidden = true;
    this.resize.observe(canvas);
    document.addEventListener('visibilitychange', this.visibility);
    this.motion.addEventListener('change', this.motionChange);
    canvas.addEventListener('webglcontextlost', this.lost);
  }
  private lost = (event: Event) => { event.preventDefault(); this.stop(); this.canvas.hidden = true; this.program = null; };
  private initialize() {
    const gl = this.gl!;
    const shaders: WebGLShader[] = [];
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader);
        shaders.push(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader unavailable');
      }
      const program = gl.createProgram()!;
      shaders.forEach(shader => gl.attachShader(program, shader)); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return; }
      this.program = program; gl.useProgram(program);
      this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'aPosition'); gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([82,111,145,255,111,86,128,255,75,118,122,255,133,99,115,255]));
    } catch { this.program = null; } finally { shaders.forEach(shader => gl.deleteShader(shader)); }
  }
  setArtwork(url: string) {
    if (url === this.artwork) return;
    this.artwork = url;
    const generation = ++this.generation;
    this.fallback.style.backgroundImage = url ? `url("${url}")` : '';
    if (!url || !this.program) { this.draw(); return; }
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (this.disposed || generation !== this.generation || !this.program) return;
      try {
        const tiny = document.createElement('canvas'); tiny.width = tiny.height = 32;
        tiny.getContext('2d')?.drawImage(image, 0, 0, 32, 32);
        const gl = this.gl!; gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tiny);
        this.draw();
      } catch { this.canvas.hidden = true; }
    };
    image.onerror = () => { if (generation === this.generation) this.draw(); };
    image.src = url;
  }
  setActive(active: boolean) { this.active = active; this.schedule(); }
  setFlowSpeed(speed: number) { this.flowSpeed = Math.max(0, speed); }
  private stop() {
    if (this.timer) clearTimeout(this.timer);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.timer = null; this.frame = null;
  }
  private schedule() {
    this.stop();
    if (!this.active || this.disposed || document.hidden || !this.program) return;
    this.draw();
    if (this.motion.matches) return;
    const tick = () => {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.frame = requestAnimationFrame(() => { this.frame = null; this.draw(); tick(); });
      }, 100);
    };
    tick();
  }
  private draw() {
    if (!this.active || !this.program || !this.gl || this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(640 / Math.max(1, rect.width), 360 / Math.max(1, rect.height), .5);
    const width = Math.max(1, Math.round(rect.width * scale)), height = Math.max(1, Math.round(rect.height * scale));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    const gl = this.gl;
    gl.viewport(0, 0, width, height); gl.useProgram(this.program);
    const time = this.motion.matches ? 0 : (performance.now() - this.started) / 1000 * this.flowSpeed;
    gl.uniform1f(gl.getUniformLocation(this.program, 'uTime'), time);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uAspect'), width / height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  destroy() {
    this.disposed = true; this.generation++; this.stop(); this.resize.disconnect();
    document.removeEventListener('visibilitychange', this.visibility);
    this.motion.removeEventListener('change', this.motionChange);
    this.canvas.removeEventListener('webglcontextlost', this.lost);
    if (this.gl) { this.gl.deleteTexture(this.texture); this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program); }
  }
}
