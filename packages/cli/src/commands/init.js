"use strict";

// ----------------------------------------------------------------------------- [Imports]

let Command = require("../Command");
let Utils = require("../utils");

// ----------------------------------------------------------------------------- [Command]

class InitCommand extends Command {
	constructor() {
		// execute the super class constructor method
		super();

		// command description
		this.flags = "init";
		// this.flags = 'init [--name] <name>'
		this.desc = "Create a new Stellar project";
		// this.paramsDesc = 'Project name'
		this.setup = (sywac) => {
			sywac
				.string("--name <name>", {
					// group: 'Required:',
					desc: "Project name",
					required: true,
				})
				.string("--version <version>", {
					desc: "Project version",
					defaultValue: "1.0.0",
				})
				.boolean("--dockerIt", {
					desc: "Create a dockerfile for the new project",
				});
		};
	}

	/**
	 * Execute the command.
	 *
	 * we need to create:
	 *  - /modules
	 *  - /config
	 *  - /manifest.json
	 */
	exec() {
		// check if is a empty folder
		if (!Utils.folderIsEmpty(process.cwd())) {
			this.printError("This command can only be executed when the directory is empty");
			return false;
		}

		// create manifest.json file
		Utils.generateFileFromTemplate(
			"manifest",
			{
				projectName: this.args.name,
				projectVersion: this.args.version,
			},
			`${process.cwd()}/manifest.json`,
		);

		// create .gitignore file
		Utils.generateFileFromTemplate("gitignore", {}, `${process.cwd()}/.gitignore`);

		// create modules folder
		Utils.createFolder(`${process.cwd()}/modules`);
		let privateModulePath = `${process.cwd()}/modules/private`;
		Utils.createFolder(privateModulePath);
		Utils.createFile(`${privateModulePath}/manifest.json`, Utils.getTemplate("privateModule"));
		Utils.createFolder(`${privateModulePath}/actions`);
		Utils.createFolder(`${privateModulePath}/tasks`);
		Utils.createFolder(`${privateModulePath}/config`);

		// create config folder
		Utils.createFolder(`${process.cwd()}/config`);

		// check if we need create a dockerfile
		if (this.args.dockerIt) {
			// luckily, we can execute the command directly
			require("./dockerIt").exec();
		}

		// print a success message
		this.printSuccess("The directory was initiated with a Stellar project structure.\nHappy Codding! 😉 🌟");

		return true;
	}
}

// export command
module.exports = new InitCommand();
