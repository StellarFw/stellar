import { Command } from "commander";
import { consoleCommand } from "./commands/console";
import { runCommand } from "./commands/run";
import { pkgMetadata } from "./utils";

export const main = () => {
	// preface
	console.log(`\x1b[34m# Stellar Framework \x1b[37mversion \x1b[33m${pkgMetadata.version}\x1b[39m`);

	// create and configure Stellar command
	const program = new Command();
	program.version(pkgMetadata.version).option("--daemon", "Execute the command as a daemon").showHelpAfterError();

	program.addCommand(consoleCommand);
	program.addCommand(runCommand);

	// parse the given console arguments
	program.parse();
};
