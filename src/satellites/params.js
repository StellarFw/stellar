/**
 * Manage the application secure params.
 */
class Params {
	/**
	 * API reference object
	 *
	 * @type {null}
	 */
	api = null;

	/**
	 * Special params we will always accept.
	 *
	 * @type {string[]}
	 */
	globalSafeParams = ["file", "apiVersion", "callback", "action"];

	/**
	 * List with all save params.
	 */
	postVariables;

	/**
	 * Create a new instance of this class.
	 *
	 * @param api API reference.
	 */
	constructor(api) {
		this.api = api;
	}

	/**
	 * Build the hash map with all safe application params.
	 *
	 * @returns {*}
	 */
	buildPostVariables() {
		let i, j;
		let postVariables = [];

		// push the global safe params for the 'postVariables'
		this.globalSafeParams.forEach((p) => postVariables.push(p));

		// iterate all actions files
		for (i in this.api.actions.actions) {
			// iterate all actions definitions
			for (j in this.api.actions.actions[i]) {
				// get current action
				let action = this.api.actions.actions[i][j];

				// iterate all inputs keys and add it to postVariables
				for (let key in action.inputs) {
					postVariables.push(key);
				}
			}
		}

		// remove the duplicated entries
		this.postVariables = this.api.utils.arrayUniqueify(postVariables);

		return this.postVariables;
	}
}

export default class {
	/**
	 * Initializer load priority.
	 *
	 * @type {number}
	 */
	loadPriority = 420;

	/**
	 * Action to the executed on the initializer loading.
	 *
	 * @param api   Api reference.
	 */
	async load(api) {
		api.params = new Params(api);
		api.params.buildPostVariables();
	}
}
