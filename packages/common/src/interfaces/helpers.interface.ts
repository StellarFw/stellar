export interface IHelpersSatellite {
	// TODO: set current return type
	/**
	 * Build and return a test connection.
	 */
	buildConnection(): any;

	/**
	 * Init test server.
	 */
	// TODO: make return a generic server type, we need to move it to the common package
	initServer(options: any): any;

	/**
	 * Run an action.
	 *
	 * This creates a fake connection to process the action and return the result on the callback function.
	 *
	 * @param actionName  Action to be executed.
	 * @param input       Action parameters.
	 */
	// TODO: improve type
	runAction(actionName: string, input?: { [key: string]: any }): Promise<any>;

	/**
	 * Execute a task.
	 *
	 * @param taskName  Task to be executed.
	 * @param params    Task parameters.
	 */
	// TODO: check what is the right type to return
	runTask(taskName: string, params?: { [key: string]: string }): any;
}
