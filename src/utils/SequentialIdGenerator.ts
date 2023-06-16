export class SequentialIDGenerator {
  count = 0;
  offset = 374;
  msb = 1295;
  power = 2;

  constructor() {}

  next() {
    const id = this.increment().toString(36);
    return id === "ad" ? this.increment().toString(36) : id;
  }

  increment() {
    const id = this.count + this.offset;
    if (id === this.msb) {
      this.offset += (this.msb + 1) * 9;
      this.msb = Math.pow(36, ++this.power) - 1;
    }
    this.count++;
    return id;
  }
}
