import os from 'os'
import fs from 'fs'
import path from 'path'

export class ExtendableError extends Error {
  constructor (message) {
    super(message)
    this.name = this.constructor.name
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)
    } else {
      this.stack = (new Error(message)).stack
    }
  }
}

export class Utils {
  /**
   * Reference for the API object.
   *
   * @type {}
   */
  api = null

  constructor (api = null) { this.api = api }

  isObject (arg) {
    return typeof arg === 'object' && arg !== null
  }

  objectToString (o) {
    return Object.prototype.toString.call(o)
  }

  isError (e) {
    return this.isObject(e) && (this.objectToString(e) === '[object Error]' || e instanceof Error)
  }

  /**
   * Make a clone of an object.
   *
   * @param obj         Object to be cloned.
   * @returns {Object}  New object reference.
   */
  objClone (obj) {
    return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyNames(obj).reduce((memo, name) => {
      return (memo[ name ] = Object.getOwnPropertyDescriptor(obj, name)) && memo
    }, {}))
  }

  /**
   * Parse an IPv6 address.
   *
   * @param address   Address to be parsed.
   * @returns {{host: string, port: Number}}
   */
  parseIPv6URI (address) {
    let host = '::1'
    let port = 80
    let regexp = new RegExp(/\[([0-9a-f:]+)\]:([0-9]{1,5})/)

    // if we have brackets parse them and find a port
    if (address.indexOf('[') > -1 && address.indexOf(']') > -1) {
      // execute the regular expression
      let res = regexp.exec(address)

      // if null this isn't a valid IPv6 address
      if (res === null) { throw new Error('failed to parse address') }

      host = res[ 1 ]
      port = res[ 2 ]
    } else {
      host = address
    }

    return { host: host, port: parseInt(port, 10) }
  }
}

export default class {
  /**
   * Satellite load priority.
   *
   * @type {Number}
   */
  loadPriority = 0

  load (api, next) {
    api.utils = new Utils(api)
    next()
  }
}
