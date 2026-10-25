/** Reloj del mundo: ciclo de día y noche. No depende de Phaser. */
export class DayNight {
  /** Segundos acumulados. */
  time: number;

  /**
   * @param dayLength duración real de un día completo, en segundos
   * @param startFraction momento del día al empezar (0 = medianoche, 0.5 = mediodía)
   */
  constructor(
    readonly dayLength = 200,
    startFraction = 0.3,
  ) {
    this.time = startFraction * dayLength;
  }

  update(dt: number): void {
    this.time += dt;
  }

  /** Posición dentro del día: 0 = medianoche, 0.5 = mediodía. */
  get fraction(): number {
    return (this.time / this.dayLength) % 1;
  }

  /** Número de día, empezando en 1. */
  get day(): number {
    return Math.floor(this.time / this.dayLength) + 1;
  }

  /** 0 = pleno día, 1 = noche cerrada (transición suave). */
  get darkness(): number {
    const c = Math.cos((this.fraction - 0.5) * 2 * Math.PI);
    return Math.max(0, Math.min(1, (0.25 - c) / 0.9));
  }

  get isNight(): boolean {
    return this.darkness > 0.55;
  }

  /** Hora del juego en formato HH:MM. */
  get clockText(): string {
    const total = this.fraction * 24;
    const h = Math.floor(total);
    const m = Math.floor((total - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Salta al atardecer del día actual (o del siguiente si ya pasó). */
  skipToDusk(): void {
    const target = 0.74;
    const base = Math.floor(this.time / this.dayLength);
    let t = (base + target) * this.dayLength;
    if (t < this.time) t += this.dayLength;
    this.time = t;
  }

  /** Fija la hora del día (fracción 0..1) sin cambiar el número de día. */
  setFraction(f: number): void {
    const base = Math.floor(this.time / this.dayLength);
    this.time = (base + f) * this.dayLength;
  }
}
