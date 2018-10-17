import { Satellite } from "@stellarfw/common/satellite";
import { readFileSync, writeFileSync } from "fs";
import * as Handlebars from "handlebars";
import { IAction } from "@stellarfw/common/interfaces/action.interface";
import { Action } from "@stellarfw/common/action";

export default class DocumentationSatellite extends Satellite {
  protected _name: string = "documentation";
  public loadPriority: number = 710;

  /**
   * Docs folder path.
   */
  private docsFolder!: string;

  private templateFolder!: string;

  constructor(api: any) {
    super(api);

    this.api.utils.createDir(this.api.configs.general.paths.public);
    this.docsFolder = `${this.api.configs.general.paths.public}/docs`;
    this.templateFolder = `${__dirname}/../../static-files/docs`;
  }

  public async load(): Promise<void> {
    if (!this.api.configs.general.generateDocumentation) {
      return;
    }

    this.generateDocumentation();
  }

  /**
   * Get all actions who have toDocument different than false.
   */
  private getActionToGenerateDoc() {
    const actions = {};

    for (const actionName in this.api.actions.actions) {
      if (!this.api.actions.actions.hasOwnProperty(actionName)) {
        continue;
      }

      let count = 0;

      actions[actionName] = {};

      for (const versionNumber in this.api.actions.actions[actionName]) {
        if (
          this.api.actions.actions[actionName][versionNumber].toDocument !==
          false
        ) {
          count++;
          actions[actionName][versionNumber] = this.api.actions.actions[
            actionName
          ][versionNumber];
        }
      }

      if (count === 0) {
        delete actions[actionName];
      }
    }

    return actions;
  }

  /**
   * Generate documentation
   */
  private generateDocumentation() {
    this.api.utils.removeDir(this.docsFolder);
    this.api.utils.createDir(this.docsFolder);

    const actions = this.getActionToGenerateDoc();

    // This dictionary will contain all template data
    const data: any = {
      actions: Object.keys(actions),
    };

    const templateBase = readFileSync(
      `${this.templateFolder}/action.html`,
    ).toString();

    for (const actionName in actions) {
      if (!actions.hasOwnProperty(actionName)) {
        continue;
      }

      data.actionName = actionName;

      data.actionVersions = [];

      for (const versionNumber in actions[actionName]) {
        if (!actions[actionName].hasOwnProperty(versionNumber)) {
          continue;
        }

        const action = this.prepareActionToPrint(
          actions[actionName][versionNumber],
        );

        action.version = versionNumber;
        data.actionVersions.push(action);
      }

      const template = Handlebars.compile(templateBase);

      writeFileSync(
        `${this.docsFolder}/action_${actionName}.html`,
        template(data),
        "utf8",
      );
    }

    this.buildIndexFile();
    this.copyResourceFiles();
  }

  /**
   * Generate an array with all information needed to build the list of tasks.
   */
  private getTasksInformation(): Array<any> {
    // array to store all the tasks
    const tasks = [];

    // iterate all registered tasks
    Object.keys(this.api.tasks.tasks).forEach(key => {
      const task = this.api.tasks.tasks[key];
      tasks.push({
        name: task.name,
        description: task.description || "N/A",
        frequency: task.frequency || "-",
      });
    });

    return tasks;
  }

  /**
   * Build index.html file.
   */
  private buildIndexFile() {
    const data = {
      actions: Object.keys(this.getActionToGenerateDoc()),
      project: {
        name: this.api.config.name,
        description: this.api.config.description,
        version: this.api.config.version,
      },
      tasks: this.getTasksInformation(),
    };

    const templateFile = readFileSync(
      `${this.templateFolder}/index.html`,
    ).toString();

    const template = Handlebars.compile(templateFile);

    writeFileSync(`${this.docsFolder}/index.html`, template(data), "utf8");
  }

  /**
   * Copy resource files to final docs folder.
   */
  private copyResourceFiles() {
    this.api.utils.copyFile(
      `${this.templateFolder}/reset.css`,
      `${this.docsFolder}/reset.css`,
    );
    this.api.utils.copyFile(
      `${this.templateFolder}/style.css`,
      `${this.docsFolder}/style.css`,
    );
    this.api.utils.copyFile(
      `${this.templateFolder}/highlight.js`,
      `${this.docsFolder}/highlight.js`,
    );
  }

  /**
   * Prepare the action to be printed.
   *
   * @param action Action to be prepared
   */
  private prepareActionToPrint(action: IAction): any {
    // create a new object with the data prepared to be printed
    const output: any = {};

    // action name
    output.name = action.id;

    // action description
    output.description = action.description;

    // action output example
    if (action.outputExample !== undefined) {
      output.outputExample = JSON.stringify(action.outputExample, null, 4);
    }

    // action inputs
    if (action.inputs !== undefined) {
      output.inputs = [];

      // iterate all inputs
      Object.keys(action.inputs).forEach(inputName => {
        const newInput: any = {};
        const input = action.inputs[inputName];

        newInput.name = inputName;
        newInput.description = input.description || "N/A";
        newInput.default = input.default || "N/A";

        newInput.validators = [];

        if (!(input.required === undefined || input.required === false)) {
          newInput.validators.push({ type: "required", value: "required" });
        }

        // Validators
        if (typeof input.validator === "function") {
          newInput.validators.push({ type: "function", value: "function" });
        } else if (input.validator instanceof RegExp) {
          newInput.validators.push({
            type: "regex",
            value: String(input.validator),
          });
        } else if (typeof input.validator === "string") {
          // the validator string can have many validators separated by '|', we need to split them
          const validators = input.validator.split("|");

          for (const index in validators) {
            if (!validators.hasOwnProperty(index)) {
              continue;
            }

            newInput.validators.push({
              type: "validator",
              value: validators[index],
            });
          }
        }

        // push the new input
        output.inputs.push(newInput);
      });
    }

    return output;
  }
}
