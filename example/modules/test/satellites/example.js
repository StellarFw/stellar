/**
 * Satellite class.
 *
 * It's recommended use this class only to specify the Satellite function, other
 * logic must be written in another class.
 */
export default class {
	/**
	 * Satellite constructor.
	 *
	 * The developer must define the priority order for the Satellite's stages
	 * here.
	 */
	constructor() {
		// define satellite load priority.
		this.loadPriority = 10;
	}

	/**
	 * Satellite loading function.
	 *
	 * @param  {{}}}      api  API object reference.
	 */
	async load(api) {
		api.log("This is awesome!", "info");
	}
}
