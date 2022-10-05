import * as bcrypt from "bcrypt";

import { HashConfigs, Satellite } from "@stellarfw/common";
import { mergeDeepRight } from "ramda";

/**
 * This class is a wrapper for bcrypt library.
 *
 * This allow users hash data and compare plain data with a hash
 * in order to validate it.
 */
export default class HashManager extends Satellite {
	public _name = "Hash";
	public loadPriority = 400;

	/**
	 * Generate a new bcrypt salt.
	 *
	 * @param rounds Number of rounds.
	 */
	public generateSalt(rounds: number = this.api.configs.general.saltRounds): Promise<string> {
		return bcrypt.genSalt(rounds);
	}

	/**
	 * Hash data.
	 *
	 * @param data Data to hash.
	 * @param config Additional configuration where you can override
	 *  pre-defined config.
	 */
	public hash(data: string | Buffer, config: Partial<HashConfigs> = {}): Promise<string> {
		const allConfigs = this.getConfigs(config);
		return bcrypt.hash(data, allConfigs.salt || allConfigs.saltLength);
	}

	/**
	 * Compare hash with plain data.
	 *
	 * @param plainData Plain data.
	 * @param hash Hash to compare with.
	 */
	public compare(plainData: string | Buffer, hash: string): Promise<boolean> {
		return bcrypt.compare(plainData, hash);
	}

	/**
	 * Get configs to be used on the generation.
	 *
	 * @param configs User defined configurations.
	 */
	private getConfigs(configs: Partial<HashConfigs> = {}): HashConfigs {
		return mergeDeepRight(
			{
				salt: this.api.configs.general.salt,
				saltRounds: this.api.configs.general.saltRounds,
				saltLength: this.api.configs.general.saltLength,
			},
			configs,
		);
	}

	public async load(): Promise<void> {
		this.api.hash = new HashManager(this.api);
	}
}
