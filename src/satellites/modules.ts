import { Satellite } from '../satellite';
import { writeFileSync } from 'fs';
import { LogLevel } from '../log-level.enum';
import { execSync } from 'child_process';
import ModuleInterface from '../module.interface';

export default class ModulesSatellite extends Satellite {
  public name: string = 'modules';
  public loadPriority: number = 1;

  /**
   * Map with the active modules.
   *
   * Keys are the modules slugs and the values are their
   * manifests.
   */
  public activeModules: Map<string, ModuleInterface> = new Map();

  /**
   * Map with the modules paths associated with each correspondent
   * module slug.
   */
  public modulesPaths: Map<string, string> = new Map();

  /**
   * Contains all the actions who are part of each module.
   */
  public moduleActions: Map<string, Array<string>> = new Map();

  /**
   * Load all active modules into memory.
   *
   * The private module is always loaded even if not present on the
   * `activeModules` property.
   */
  private loadModules(): void {
    const modules = this.api.configs.modules as Array<string>;

    if (this.api.utils.dirExists(`${this.api.scope.rootPath}/modules/private`)) {
      modules.push('private');
    }

    if (modules.length === 0) {
      throw new Error('At least one module needs to be active.');
    }

    for (const moduleName of modules) {
      const path = `${this.api.scope.rootPath}/modules/${moduleName}`;

      try {
        const manifest = require(`${path}/manifest.json`);
        this.activeModules.set(manifest.id, manifest);
        this.modulesPaths.set(manifest.id, path);
      } catch (e) {
        throw new Error(`There is an invalid module active, named "${moduleName}", fiz this to start Stellar normally.`);
      }
    }
  }

  /**
   * Process all NPM dependencies.
   *
   * The `npm install` command only is executed if the `package.json` file
   * isn't present.
   */
  private processNpmDependencies(): void {
    // Don't use NPM on test environment, otherwise the tests will fail.
    if (this.api.env === 'test') {
      return;
    }

    const scope = this.api.scope;

    // Check if Stellar is starting in clean mode. If yes, we need remove all the
    // temporary files and process every thing again.
    if (scope.args.clean) {
      const tempFilesLocations = [
        'temp',
        'package.json',
        'package.json.lock',
        'node_modules',
      ];

      tempFilesLocations
        .forEach(e => this.api.utils.removePath(`${scope.rootPath}/${e}`));
    }

    // If the `package.json` file already exists and Stellar isn't starting with the
    // `update` flag, return now.
    if (this.api.utils.fileExists(`${scope.rootPath}/package.json`) &&
      !scope.args.update) {
      return;
    }

    let npmDependencies = {};

    this.activeModules.forEach(manifest => {
      if (manifest.npmDependencies === undefined) {
        return;
      }

      npmDependencies = this.api.utils.hashMerge(npmDependencies, manifest.npmDependencies);
    });

    const projectJson = {
      private: true,
      name: 'stellar-dependencies',
      version: '1.0.0',
      description: `This was automatically generated don't edit manually.`,
      dependencies: npmDependencies,
    };

    const packageJsonPath = `${this.api.scope.rootPath}/package.json`;
    this.api.utils.removePath(packageJsonPath);
    writeFileSync(packageJsonPath, JSON.stringify(projectJson, null, 2), 'utf8');

    this.api.log('Updating NPM packages', LogLevel.Info);

    const npmCommand = scope.args.update
      ? 'npm update'
      : 'npm install';

    try {
      execSync(npmCommand);
    } catch (error) {
      throw new Error('An error occurred during the NPM install command.');
    }

    this.api.log('NPM dependencies updated!', LogLevel.Info);
  }

  /**
   * Register a new action name for a module.
   *
   * @param moduleName Module name.
   * @param value Array of actions name to be stores.
   */
  public regModuleActive(moduleName: string, value: string|Array<string>): void {
    if (!this.moduleActions.has(moduleName)) {
      this.moduleActions.set(moduleName, []);
    }

    const arrayOfActions = this.moduleActions.get(moduleName);

    if (Array.isArray(value)) {
      this.moduleActions.set(moduleName, arrayOfActions.concat(value));
    } else if (this.api.utils.isNonEmptyString(value)) {
      arrayOfActions.push(value);
    } else {
      throw new Error('Value got an invalid state.');
    }
  }

  public async load(): Promise<void> {
    this.api.modules = this;

    this.loadModules();
    this.processNpmDependencies();
  }
}
