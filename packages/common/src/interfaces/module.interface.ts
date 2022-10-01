/**
 * Interface that represent a module.
 *
 * This is basically the information that a manifest file can contain.
 */
export interface ModuleInterface {
	/**
	 * Module unique identifier.
	 */
	id: string;

	/**
	 * Module human readable name.
	 */
	name: string;

	/**
	 * Short description about the module objective.
	 */
	description: string;

	/**
	 * Module's version.
	 */
	version: string;

	/**
	 * Module's author.
	 */
	author: string;

	/**
	 * Module's Node dependencies.
	 */
	nodeDependencies?: { [key: string]: string };
}
