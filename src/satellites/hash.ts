import bcrypt from "bcrypt";

import { Satellite } from "../satellite";

/**
 * This class is a wrapper for bcrypt library.
 *
 * This allow users hash data and compare plain data with a hash
 * in order to validate it.
 */
class HashManager {
  private api: any = null;

  constructor(api) {
    this.api = api;
  }

  /**
   * Generate a new bcrypt salt.
   *
   * @param rounds Number of rounds.
   */
  public generateSalt(
    rounds: number = this.api.config.general.saltRounds,
  ): Promise<string> {
    return bcrypt.genSalt(rounds);
  }

  /**
   * Hash data.
   *
   * @param data Data to hash.
   * @param config Additional configuration where you can override
   *  pre-defined config.
   */
  public hash(data: any, config: any = {}): Promise<string> {
    config = this.getConfigs(config);
    return bcrypt.hash(data, config.salt || config.saltLength);
  }

  /**
   * Compare hash with plain data.
   *
   * @param plainData Plain data.
   * @param hash Hash to compare with.
   */
  public compare(plainData, hash): Promise<boolean> {
    return bcrypt.compare(plainData, hash);
  }

  /**
   * Get configs to be used on the generation.
   *
   * @param configs User defined configurations.
   */
  private getConfigs(configs: object = {}): object {
    return this.api.utils.hashMerge(
      {
        salt: this.api.config.general.salt,
        saltRounds: this.api.config.general.saltRounds,
        saltLength: this.api.config.general.saltLength,
      },
      configs,
    );
  }
}

export default class HashSatellite extends Satellite {
  public loadPriority: number = 400;

  public async load(): Promise<void> {
    this.api = new HashManager(this.api);
  }
}
