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
let StatusAction = class StatusAction extends Action {
	async run() {
		return {
			id: this.api.id,
			stellarVersion: this.api.stellarVersion,
			uptime: new Date().getTime() - this.api.bootTime,
		};
		// data.response.id = api.id
		// data.response.stellarVersion = api.stellarVersion
		// data.response.uptime = new Date().getTime() - api.bootTime
	}
};
StatusAction = __decorate(
	[
		(0, common_1.ActionMetadata)({
			name: "status",
			description: "This action returns some basic information about the API",
			outputExample: {
				id: "example",
				stellarVersion: "1.0.0",
				uptime: 10030,
			},
		}),
	],
	StatusAction,
);
exports.default = StatusAction;
//# sourceMappingURL=status.js.map
