import fs from 'fs';

export default class Config {

  static loadPriority = 0;

  static load(api, next) {
    // set config object on API
    api.config = {};

    try {
      // read project manifest
      api.config.app = require(`${api.scope.rootPath}/manifest.json`);
    } catch (e) {
      // when the project manifest doesn't exists the user is informed
      // and the engine instance is terminated
      api.log.emergency('Project `manifest.json` file does not exists.');

      // end the engine execution
      api.shutdown(true);
    }

    next();
  }

};
