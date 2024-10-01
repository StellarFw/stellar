import { Command } from "../Command.js";
import { createFolder, folderIsEmpty, generateFileFromTemplate } from "../utils.js";

class InitCommand extends Command {
	constructor() {
		super();

		this.flags = "init";
		this.desc = "Create a new Stellar project";
	}

	buildCommand() {
		const command = super.buildCommand();

		return command
			.requiredOption("--name <name>", "Project name")
			.option("--version <version>", "Project version")
			.option("--dockerIt", "Create a dockerfile for the new project");
	}

	/**
	 * Execute the command.
	 *
	 * we need to create:
	 *  - /modules
	 *  - /config
	 *  - /manifest.json
	 */
	async exec() {
		// check if is a empty folder
		if (!(await folderIsEmpty(process.cwd()))) {
			this.printError("This command can only be executed when the directory is empty");
			return false;
		}

		// create manifest.json file
		await generateFileFromTemplate(
			"manifest",
			{
				projectName: this.args.name,
				projectVersion: this.args.version,
			},
			`${process.cwd()}/manifest.json`,
		);

		// create .gitignore file
		await generateFileFromTemplate("gitignore", {}, `${process.cwd()}/.gitignore`);

		// create modules folder
		await createFolder(`${process.cwd()}/modules`);
		let privateModulePath = `${process.cwd()}/modules/private`;
		await createFolder(privateModulePath);
		await generateFileFromTemplate("privateModule", {}, `${privateModulePath}/manifest.json`);
		await createFolder(`${privateModulePath}/actions`);
		await createFolder(`${privateModulePath}/tasks`);
		await createFolder(`${privateModulePath}/config`);

		// create config folder
		await createFolder(`${process.cwd()}/config`);

		// check if we need create a dockerfile
		if (this.args.dockerIt) {
			// luckily, we can execute the command directly
			await import("./dockerIt").exec();
		}

		// print a success message
		this.printSuccess(`The directory was initiated with a Stellar project structure.\nHappy Codding! 😉 🌟`);

		return true;
	}
}

export default new InitCommand().buildCommand();
