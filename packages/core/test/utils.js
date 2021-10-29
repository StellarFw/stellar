"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startEngine = exports.buildEngineArgs = void 0;
const engine_1 = __importDefault(require("../lib/engine"));
const path_1 = require("path");
const pkg = require("../package.json");
const buildEngineArgs = () => {
    return {
        rootPath: (0, path_1.join)(process.cwd(), "/../../example"),
        stellarPackageJSON: pkg,
        args: {},
    };
};
exports.buildEngineArgs = buildEngineArgs;
const startEngine = async () => {
    const engine = new engine_1.default((0, exports.buildEngineArgs)());
    await engine.initialize();
    await engine.start();
    return engine;
};
exports.startEngine = startEngine;
//# sourceMappingURL=utils.js.map