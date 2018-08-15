export default interface ModuleInterface {
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
  version: number;

  /**
   * Module's NPM dependencies.
   */
  npmDependencies?: any;
};
