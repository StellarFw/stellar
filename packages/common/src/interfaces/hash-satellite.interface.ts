/**
 * Parameters to config the hash function.
 */
export type HashConfigs = {
	salt: string;
	saltRounds: number;
	saltLength: number;
};

export interface IHashSatellite {
	/**
	 * Generate a new bcrypt salt.
	 *
	 * @param rounds Number of rounds.
	 */
	generateSalt(rounds?: number): Promise<string>;

	/**
	 * Hash data.
	 *
	 * @param data Data to hash.
	 * @param config Additional configuration where you can override
	 *  pre-defined config.
	 */
	hash(data: string | Buffer, config?: Partial<HashConfigs>): Promise<string>;

	/**
	 * Compare hash with plain data.
	 *
	 * @param plainData Plain data.
	 * @param hash Hash to compare with.
	 */
	compare(plainData: string | Buffer, hash: string): Promise<boolean>;
}
