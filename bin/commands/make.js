import { Command } from "commander";

export default new Command("make")
	.description("Generate some project components")
	.option("--module <module>", "Module where the file(s) will be created", "private")
	.option("--force", "Overwrite existent files");
