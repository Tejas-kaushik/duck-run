// Runs fixed-size simulation ticks from variable frame times, and makes sure a fresh key press
// reaches exactly ONE tick: even when a frame runs several ticks, or none at all (ZUBAIR_BASE.md).

export class FixedStep {
  private accumulator = 0;
  private pendingPress = false;

  constructor(private readonly tickSec: number = 1 / 60) {}

  /**
   * Call once per frame. `tick(press)` is called for every whole tick that fits; `press` is true
   * on the first tick after a fresh press, and false on every other tick.
   */
  advance(dtSeconds: number, freshPress: boolean, tick: (press: boolean) => void): number {
    if (freshPress) this.pendingPress = true;
    this.accumulator += dtSeconds;
    let ran = 0;
    while (this.accumulator >= this.tickSec) {
      this.accumulator -= this.tickSec;
      const press = this.pendingPress;
      this.pendingPress = false;
      tick(press);
      ran++;
    }
    return ran;
  }
}
