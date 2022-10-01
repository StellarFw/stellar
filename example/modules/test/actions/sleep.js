"use strict";
var __decorate =
	(this && this.__decorate) ||
	function (decorators, target, key, desc) {
		var c = arguments.length,
			r = c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
			d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
			r = Reflect.decorate(decorators, target, key, desc);
		else
			for (var i = decorators.length - 1; i >= 0; i--)
				if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@stellarfw/common");
let SleepAction = class SleepAction extends Action {
	async run() {
		const sleepDuration = this.params.sleepDuration;
		const sleepStarted = new Date().getTime();
		return new Promise((resolve) => {
			setTimeout(() => {
				const sleepEnded = new Date().getTime();
				const sleepDelta = sleepEnded - sleepStarted;
				resolve({
					sleepStarted,
					sleepEnded,
					sleepDelta,
					sleepDuration,
				});
			}, sleepDuration);
		});
	}
};
SleepAction = __decorate(
	[
		(0, common_1.ActionMetadata)({
			name: "sleep",
			description: "This action sleep for a while and then return",
			inputs: {
				sleepDuration: {
					required: true,
					default: 1000,
				},
			},
			outputExample: {
				sleepStarted: 1457265602,
				sleepEnded: 1457265615,
				sleepDelta: 13,
				sleepDuration: 10,
			},
		}),
	],
	SleepAction,
);
exports.default = SleepAction;
//# sourceMappingURL=sleep.js.map
