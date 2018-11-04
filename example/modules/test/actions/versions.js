"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var common_1 = require("@stellarfw/common");
let VersionedAction1 = class VersionedAction1 extends common_1.Action {
    async run() { }
};
VersionedAction1 = __decorate([
    common_1.ActionMetadata({
        name: "versionedAction",
        description: "Is just a dummy action with a version property",
        version: 1
    })
], VersionedAction1);
exports.VersionedAction1 = VersionedAction1;
let VersionedAction2 = class VersionedAction2 extends common_1.Action {
    async run() {
        return {
            news: "new version"
        };
    }
};
VersionedAction2 = __decorate([
    common_1.ActionMetadata({
        name: "versionedAction",
        description: "Is just a dummy action with a version property",
        version: 2,
        outputExample: {
            news: "new version"
        }
    })
], VersionedAction2);
exports.VersionedAction2 = VersionedAction2;
//# sourceMappingURL=versions.js.map