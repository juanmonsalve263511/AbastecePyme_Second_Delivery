export class LatestRequest {
  constructor() { this.Generation = 0; }
  Cancel() { this.Generation += 1; }
  async Run(Load, OnValue, OnError) {
    const Generation = ++this.Generation;
    try {
      const Value = await Load();
      if (Generation === this.Generation) OnValue(Value);
    } catch (Error) {
      if (Generation === this.Generation) OnError(Error);
    }
  }
}

