"use strict";

/**
 * Satellite class.
 *
 * It's recommended use this class only to specify the Satellite function, other
 * logic must be written in another class.
 */
exports.default = class ExampleSatellite extends Satellite {
	/**
	 * Satellite constructor.
	 *
	 * The developer must define the priority order for the Satellite's stages
	 * here.
	 */
	constructor(api) {
		super(api);

		this.loadPriority = 10;
		this._name = "Example";
	}

	/**
	 * Satellite loading function.
	 */
	async load() {
		this.api.log("This is awesome!", "info");
	}
};
