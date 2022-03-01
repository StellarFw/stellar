import * as bcrypt from "bcrypt";

import { Satellite } from "@stellarfw/common/lib/index.js";

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
