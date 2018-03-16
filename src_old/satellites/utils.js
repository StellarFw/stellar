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

  /**
   * Cookie parse from headers of http(s) requests.
   *
   * @param req
   * @returns {{}}
   */
  parseCookies (req) {
    let cookies = {}
    if (req.headers.cookie) {
      req.headers.cookie.split(';').forEach(function (cookie) {
        let parts = cookie.split('=')
        cookies[ parts[ 0 ].trim() ] = (parts[ 1 ] || '').trim()
      })
    }
    return cookies
  }

  /**
   * Collapse this object to an array.
   *
   * @param obj
   * @returns {*}
   */
  collapseObjectToArray (obj) {
    try {
      let keys = Object.keys(obj)
      if (keys.length < 1) {
        return false
      }
      if (keys[ 0 ] !== '0') {
        return false
      }
      if (keys[ (keys.length - 1) ] !== String(keys.length - 1)) {
        return false
      }

      let arr = []
      for (let i in keys) {
        let key = keys[ i ]
        if (String(parseInt(key)) !== key) {
          return false
        } else {
          arr.push(obj[ key ])
        }
      }

      return arr
    } catch (e) {
      return false
    }
  }

  /**
   * Unique-ify an array.
   *
   * @param array Array to be uniquefied.
   * @returns {Array} New array.
   */
  arrayUniqueify (array) {
    array.filter((value, index, self) => {
      return self.indexOf(value) === index
    })

    return array
  }

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

  

  // ------------------------------------------------------------- [Type Checks]

  /**
   * Checks if the given var is an non empty string.
   *
   * @param {string} value Value to be validated.
   */
  isNonEmptyString (value) {
    return (typeof value === 'string' && value.length > 0)
  }

  // ----------------------------------------------------------------- [Strings]

  /**
   * Convert snake case string to camel case.
   *
   * @param {string} s String to be converted.
   */
  snakeToCamel (s) {
    return s.replace(/(\_\w)/g, m => m[ 1 ].toUpperCase())
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
