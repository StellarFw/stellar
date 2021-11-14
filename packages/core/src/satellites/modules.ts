import { LogLevel } from "@stellarfw/common/lib/enums/log-level.enum";
import ModuleInterface from "@stellarfw/common/lib/interfaces/module.interface";
import { Satellite } from "@stellarfw/common/lib";
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";
import { requireFile } from "@stellarfw/common/lib";

export default class ModulesSatellite extends Satellite {
  protected _name = "modules";
  public loadPriority = 1;

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
   * Dictionary with Typescript compiler base configurations.
   */
  private tsBaseConfigurations: ts.CompilerOptions = {};

  /**
   * Loads the base TypeScript configurations.
   */
  private loadBaseTsConfigs() {
    const baseOptionsPath = join(__dirname, "../../../../tsconfig.base.json");

    const buffer = readFileSync(baseOptionsPath, { encoding: "utf-8" });
    const tsConfigBase = JSON.parse(buffer.toString());
    this.tsBaseConfigurations = tsConfigBase.compilerOptions;
  }

  /**
   * Build the TypeScript files of the given module.
   *
   * @param modulePath Module path that needs to be compiled.
   */
  private buildModule(modulePath: string): boolean {
    const filesToCompile = this.api.utils.recursiveDirSearch(modulePath, ["ts"]);

    // TODO: maybe this can be moved into the loadBaseTsConfigs methods
    const options: ts.CompilerOptions = {
      ...this.tsBaseConfigurations,
      rootDir: modulePath,
      outDir: modulePath,
    };

    // Compile files
    const program = ts.createProgram(filesToCompile, options);
    const emitResult = program.emit();

    // Show any error that occurred
    const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    allDiagnostics.forEach((diagnostic) => {
      if (!diagnostic.file) {
        return;
      }

      if (diagnostic.file.fileName.indexOf(modulePath) !== 0) {
        return;
      }

      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");

      console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    });

    return emitResult.emitSkipped;
  }

  /**
   * Load all active modules into memory.
   *
   * The private module is always loaded even if not present on the
   * `activeModules` property.
   */
  private loadModules(): void {
    const modules = (this.api.configs.modules || []) as Array<string>;

    if (this.api.utils.dirExists(`${this.api.scope.rootPath}/modules/private`)) {
      modules.push("private");
    }

    if (modules.length === 0) {
      this.api.log("At least one module needs to be active.", LogLevel.Emergency);

      // NOTE: on this case there is no way to shutdown safely.
      process.exit();
    }

    for (const moduleName of modules) {
      const modulePath = `${this.api.scope.rootPath}/modules/${moduleName}`;

      // Read module manifest file. This file is required in order for it to work. Otherwise we need to shutdown the
      // engine with no change to recover.
      const manifestFile = requireFile(`${modulePath}/manifest.json`).run();
      manifestFile.tapErr(() => {
        this.api.log(
          `Impossible to load module(${moduleName}), fix this to start Stellar normally. Usually this means the module or the 'manifest.json' file doesn't exist.`,
          LogLevel.Emergency,
        );
        process.exit();
      });

      const manifest = manifestFile.unwrap();

      this.activeModules.set(manifest.id, manifest);
      this.modulesPaths.set(manifest.id, modulePath);

      // TODO: maybe always run this?
      // TODO: make this code secure
      try {
        if (manifest.isTypescript === true) {
          // Load TS base configurations if isn't already loaded
          if (Object.keys(this.tsBaseConfigurations).length === 0) {
            this.loadBaseTsConfigs();
          }

          this.buildModule(modulePath);
        }
      } catch (e) {
        this.api.log(e, LogLevel.Emergency);
        process.exit();
      }
    }
  }

  /**
   * Process all Node dependencies.
   *
   * The `install` command only happens when the `package.json`
   * isn't present.
   */
  private processNodeDependencies(): void {
    // Don't process dependencies on test environment,
    // otherwise the tests will fail.
    if (this.api.env === "test") {
      return;
    }

    const scope = this.api.scope;

    // Check if Stellar is starting in clean mode. If yes, we need remove all the
    // temporary files and process every thing again.
    if (scope.args.clean) {
      const tempFilesLocations = ["temp", "package.json", "package-lock.json", "node_modules"];

      tempFilesLocations.forEach((e) => this.api.utils.removePath(`${scope.rootPath}/${e}`));
    }

    // If the `package.json` file already exists and Stellar isn't starting with the
    // `update` flag, return now.
    if (this.api.utils.fileExists(`${scope.rootPath}/package.json`) && !scope.args.update) {
      return;
    }

    let nodeDependencies = {};

    this.activeModules.forEach((manifest) => {
      if (manifest.nodeDependencies === undefined) {
        return;
      }

      nodeDependencies = this.api.utils.hashMerge(nodeDependencies, manifest.nodeDependencies);
    });

    const projectJson = {
      private: true,
      name: "stellar-dependencies",
      version: "1.0.0",
      description: "This was automatically generated don't edit manually.",
      dependencies: nodeDependencies,
    };

    const packageJsonPath = `${this.api.scope.rootPath}/package.json`;
    this.api.utils.removePath(packageJsonPath);
    writeFileSync(packageJsonPath, JSON.stringify(projectJson, null, 2), "utf8");

    this.api.log("Updating Node dependencies", LogLevel.Info);

    // To install dependencies is possible to use NPM or Yarn.
    // By default NPM is used. To use Yarn instead, the argument
    // --yarn must be passed.
    const pkgManager = scope.args.yarn ? "yarn" : "npm";
    const commandToRun = scope.args.update ? `${pkgManager} update` : `${pkgManager} install`;

    try {
      execSync(commandToRun);
    } catch (error) {
      throw new Error("An error occurred during the Node dependencies install command.");
    }

    this.api.log("Node dependencies updated!", LogLevel.Info);
  }

  /**
   * Register a new action name for a module.
   *
   * @param moduleName Module name.
   * @param value Array of actions name to be stores.
   */
  public regModuleAction(moduleName: string, value: string | Array<string>): void {
    if (!this.moduleActions.has(moduleName)) {
      this.moduleActions.set(moduleName, []);
    }

    const arrayOfActions = this.moduleActions.get(moduleName);

    if (arrayOfActions && Array.isArray(value)) {
      this.moduleActions.set(moduleName, arrayOfActions.concat(value));
    } else if (arrayOfActions && this.api.utils.isNonEmptyString(value)) {
      arrayOfActions.push(value as string);
    } else {
      throw new Error("Value got an invalid state.");
    }
  }

  public async load(): Promise<void> {
    this.api.modules = this;

    this.loadModules();
    this.processNodeDependencies();
  }
}
