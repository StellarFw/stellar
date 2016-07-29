'use strict'

/**
 * Satellite class.
 *
 * It's recommended use this class only to specify the Satellite function, other
 * logic must be written in another class.
 */
exports.default = class {

    /**
     * Satellite constructor.
     *
     * The developer must define the priority order for the Satellite's stages
     * here.
     */
    constructor () {
      // define satellite load priority.
      this.loadPriority = 10
    }

    /**
     * Satellite loading function.
     *
     * @param  {{}}}      api  API object reference.
     * @param  {Function} next Callback function.
     */
    load (api, next) {
      // log an example message
      api.log('This is awesome!', 'info')

      // finish the satellite load
      next()
    }

}
