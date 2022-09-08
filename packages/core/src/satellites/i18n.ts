import i18n from "i18n";

import { Satellite } from "@stellarfw/common/lib/index.js";

export default class I18nSatellite extends Satellite {
  protected _name = "i18n";
  public loadPriority = 10;

  private i18n: any = null;

  private configure() {
    // TODO: copy all modules locale folder to a temp folder '/tmp/locale'

    // create locale folder (remove first if exists)
    const localePath = this.api.configs.general.paths.temp + "/locale";
    this.api.utils.removePath(localePath).run();
    this.api.utils.createDir(localePath).run();

    // iterate all modules
    for (const module of this.api.modules.activeModules.keys()) {
      const moduleLocalePath = `${this.api.scope.rootPath}/modules/${module}/locale`;

      // TODO: copy all files to temp locale folder
      // this.api.utils.dirExists(moduleLocalePath)
    }

    const options = this.api.configs.i18n;
    options.directory = localePath;
    this.i18n.configure(options);
    this.i18n.setLocale(this.api.configs.i18n.defaultLocale);
  }

  /**
   * Determine the current client locale from connection.
   *
   * @param connection Client connection object.
   */
  private determineConnectionLocale(connection) {
    return this.api.configs.i18n.defaultLocale;
  }

  /**
   * Invoke the connection locale method.
   *
   * @param connection  Client connection object.
   */
  private invokeConnectionLocale(connection) {
    // split the command by '.'
    const cmdParts = this.api.configs.i18n.determineConnectionLocale.split(".");

    // get the first array position
    const cmd = cmdParts.shift();

    // this only works with the api object
    if (cmd !== "api") {
      throw new Error("cannot operate on a method outside of the api object");
    }

    // execute method
    const locale = this.api.utils.executeCommand(cmdParts.join("."), [connection]);

    // set locale
    this.i18n.setLocale(connection, locale);
  }

  /**
   * Localize a message.
   */
  public localize(message: string | Array<any>, options) {
    // the arguments should be an array
    if (!Array.isArray(message)) {
      message = [message];
    }

    if (!options) {
      options = this.i18n;
    }

    return this.i18n.__.apply(options, message);
  }

  public async load(): Promise<void> {
    this.api.i18n = this;
    this.i18n = i18n;

    this.configure();
  }
}
