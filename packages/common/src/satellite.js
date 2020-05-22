"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Satellite {
  constructor(api) {
    this.loadPriority = 100;
    this.startPriority = 100;
    this.stopPriority = 100;
    this.api = null;
    this._name = null;
    this.api = api;
  }
  get name() {
    return this._name;
  }
  load() {
    throw new Error("Method not implemented.");
  }
}
exports.Satellite = Satellite;
//# sourceMappingURL=satellite.js.map