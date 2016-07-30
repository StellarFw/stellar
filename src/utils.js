import os from 'os'
import fs from 'fs'
import path from 'path'

export default class Utils {

  /**
   * Read all files from the given directory.
   *
   * @param dir         Folder path to search.
   * @returns {Array}   Array with the files paths.
   */
  static getFiles (dir) {
    var results = []

    fs.readdirSync(dir).forEach(file => {
      file = `${dir}/${file}`
      var stat = fs.statSync(file)

      if (stat && !stat.isDirectory()) {
        results.push(file)
      }
    })

    return results
  }

  /**
   * Get all .js files in a directory.
   *
   * @param dir
   * @param extension
   * @returns {Array.<T>}
   */
  static recursiveDirectoryGlob (dir, extension) {
    var results = []

    if (!extension) { extension = 'js' }

    extension = extension.replace('.', '')
    if (dir[ dir.length - 1 ] !== '/') { dir += '/' }

    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        let fullFilePath = path.normalize(dir + file)
        if (file[ 0 ] !== '.') { // ignore 'system' files
          let stats = fs.statSync(fullFilePath)
          let child

          if (stats.isDirectory()) {
            child = Utils.recursiveDirectoryGlob(fullFilePath, extension)
            child.forEach(c => results.push(c))
          } else if (stats.isSymbolicLink()) {
            let realPath = fs.readlinkSync(fullFilePath)
            child = Utils.recursiveDirectoryGlob(realPath)
            child.forEach(c => results.push(c))
          } else if (stats.isFile()) {
            let fileParts = file.split('.')
            let ext = fileParts[ (fileParts.length - 1) ]
            if (ext === extension) { results.push(fullFilePath) }
          }
        }
      })
    }

    return results.sort()
  }

  /**
   * Merge two hashes recursively.
   *
   * @param a
   * @param b
   * @param arg
   * @returns {{}}
   */
  static hashMerge (a, b, arg) {
    let c = {}
    let i, response

    for (i in a) {
      if (Utils.isPlainObject(a[ i ]) && Object.keys(a[ i ]).length > 0) {
        c[ i ] = Utils.hashMerge(c[ i ], a[ i ], arg)
      } else {
        if (typeof a[ i ] === 'function') {
          response = a[ i ](arg)
          if (Utils.isPlainObject(response)) {
            c[ i ] = Utils.hashMerge(c[ i ], response, arg)
          } else {
            c[ i ] = response
          }
        } else {
          c[ i ] = a[ i ]
        }
      }
    }
    for (i in b) {
      if (Utils.isPlainObject(b[ i ]) && Object.keys(b[ i ]).length > 0) {
        c[ i ] = Utils.hashMerge(c[ i ], b[ i ], arg)
      } else {
        if (typeof b[ i ] === 'function') {
          response = b[ i ](arg)
          if (Utils.isPlainObject(response)) {
            c[ i ] = Utils.hashMerge(c[ i ], response, arg)
          } else {
            c[ i ] = response
          }
        } else {
          c[ i ] = b[ i ]
        }
      }
    }
    return c
  }

  /**
   * Check if the passed argument is a plain object.
   *
   * @param o
   * @returns {boolean}
   */
  static isPlainObject (o) {
    let safeTypes = [ Boolean, Number, String, Function, Array, Date, RegExp, Buffer ]
    let safeInstances = [ 'boolean', 'number', 'string', 'function' ]
    let expandPreventMatchKey = '_toExpand' // set `_toExpand = false` within an object if you don't want to expand it
    let i

    if (!o) {
      return false
    }
    if ((o instanceof Object) === false) {
      return false
    }
    for (i in safeTypes) {
      if (o instanceof safeTypes[ i ]) {
        return false
      }
    }
    for (i in safeInstances) {
      if (typeof o === safeInstances[ i ]) {
        return false
      }
    }
    if (o[ expandPreventMatchKey ] === false) {
      return false
    }
    return (o.toString() === '[object Object]')
  }

  /**
   * Cookie parse from headers of http(s) requests.
   *
   * @param req
   * @returns {{}}
   */
  static parseCookies (req) {
    let cookies = {}
    if (req.headers.cookie) {
      req.headers.cookie.split(';').forEach(function (cookie) {
        let parts = cookie.split('=')
        cookies[ parts[ 0 ].trim() ] = ( parts[ 1 ] || '' ).trim()
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
  static collapseObjectToArray (obj) {
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
  static arrayUniqueify (array) {
    array.filter((value, index, self) => {
      return self.indexOf(value) === index
    })

    return array
  }

  static isObject (arg) {
    return typeof arg === 'object' && arg !== null
  }

  static objectToString (o) {
    return Object.prototype.toString.call(o)
  }

  static isError (e) {
    return Utils.isObject(e) && (Utils.objectToString(e) === '[object Error]' || e instanceof Error)
  }

  /**
   * Remove a directory.
   *
   * @param dir   Directory path.
   */
  static removeDirectory (dir) {
    let filesList

    // get directory files
    try {
      filesList = fs.readdirSync(dir)
    } catch (e) {
      return
    }

    // iterate all folders and files on the directory
    filesList.forEach((file) => {
      // get full file path
      let filePath = `${dir}/${file}`

      // check if it's a file
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath)
      } else {
        Utils.removeDirectory(filePath)
      }
    })

    // remove current directory
    fs.rmdirSync(dir)
  }

  /**
   * Check if the directory exists.
   *
   * @param dir           Directory path.
   * @returns {boolean}   True if exists, false if not or the given path isn't a directory.
   */
  static directoryExists (dir) {
    try {
      fs.statSync(dir).isDirectory()
    } catch (er) {
      return false
    }

    return true
  }

  /**
   * Check if a file exists.
   *
   * @param path          Path to check.
   * @returns {boolean}   True if the file exists, false otherwise.
   */
  static fileExists (path) {
    try {
      fs.statSync(path).isFile()
    } catch (error) {
      return false
    }

    return true
  }

  /**
   * Create a new directory.
   *
   * @param path Path there the directory must be created.
   */
  static createFolder (path) {
    try {
      fs.mkdirSync(path)
    } catch (e) {
      if (e.code !== 'EEXIST') { throw e }
    }
  }

  /**
   * Copy a file.
   *
   * This only work with files.
   *
   * @param source        Source path.
   * @param destination   Destination path.
   */
  static copyFile (source, destination) {
    fs.createReadStream(source).pipe(fs.createWriteStream(destination))
  }

  /**
   * Get this servers external interface.
   *
   * @returns {String} Server external IP or false if not founded.
   */
  static getExternalIPAddress () {
    let ifaces = os.networkInterfaces()
    let ip = false

    for (let dev in ifaces) {
      ifaces[ dev ].forEach((details) => {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          ip = details.address
        }
      })
    }

    return ip
  }

  /**
   * Make a clone of an object.
   *
   * @param obj         Object to be cloned.
   * @returns {Object}  New object reference.
   */
  static objClone (obj) {
    return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyNames(obj).reduce((memo, name) => {
      return (memo[ name ] = Object.getOwnPropertyDescriptor(obj, name)) && memo
    }, {}))
  }

  static stringToHash (api, path, object) {
    if (!object) { object = api }
    function _index (obj, i) { return obj[ i ] }

    return path.split('.').reduce(_index, object)
  }

  /**
   * Parse an IPv6 address.
   *
   * @param address   Address to be parsed.
   * @returns {{host: string, port: Number}}
   */
  static parseIPv6URI (address) {
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
