import fs from 'fs';
import i18n from 'i18n';
import Utils from '../utils';

class I18n {

  /**
   * Stellar api object.
   */
  api;

  /**
   * i18n instance.
   */
  i18n;

  /**
   * Constructor.
   *
   * @param api   API reference.
   */
  constructor (api) {
    let self = this;

    // save api reference
    self.api = api;

    // save i18n instance
    self.i18n = i18n;
  }

  /**
   * Configure i18n.
   */
  configure () {
    let self = this;

    // @todo - copy all modules locale folder to a temp folder '/tmp/locale'

    // create locale folder (remove first if exists)
    let localePath = self.api.config.general.paths.temp + '/locale';
    Utils.removeDirectory(localePath);
    fs.mkdirSync(localePath);

    // get active modules
    let modules = self.api.config.modules;

    // iterate all modules
    modules.forEach((module) => {
      let localePath = `${self.api.scope.rootPath}/modules/${module}/locale`;

      // check if the folder exists
      if (Utils.directoryExists(localePath)) {
        // copy all files to temp locale folder
      }
    });

    // get i18n configs
    let options = self.api.config.i18n;

    // define locale folder
    options.directory = localePath;

    // configure application
    self.i18n.configure(options);

    // setting the current locale globally
    self.i18n.setLocale(self.api.config.i18n.defaultLocale)
  }

  /**
   * Determine the current client locale from connection.
   *
   * @param connection  Client connection object.
   */
  determineConnectionLocale (connection) {
    return this.api.config.i18n.defaultLocale;
  }

  /**
   * Invoke the connection locale method.
   *
   * @param connection  Client connection object.
   */
  invokeConnectionLocale (connection) {
    let self = this;

    // split the command by '.'
    let cmdParts = self.api.config.i18n.determineConnectionLocale.split('.');

    // get the first array position
    let cmd = cmdParts.shift();

    // this only works with the api object
    if (cmd !== 'api') {
      throw new Error('cannot operate on a method outside of the api object');
    }

    // execute method
    let locale = eval(`self.api.${cmdParts.join('.')}(connection)`);

    // set locale
    self.i18n.setLocale(connection, locale);
  }

}

/**
 * Initializer class.
 *
 * This initializer adds support to i18n localization.
 */
export default class {

  /**
   * Load priority.
   *
   * @type {number}
   */
  static loadPriority = 1;

  /**
   * Load initializer method.
   *
   * @param api   Stellar api object.
   * @param next  Callback.
   */
  static load (api, next) {
    // add i18n class to the api object
    api.i18n = new I18n(api);

    // configure i18n
    api.i18n.configure();

    // call callback
    next();
  }

};
