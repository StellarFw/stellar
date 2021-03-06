import fs from 'fs'
import path from 'path'
import Mime from 'mime'

/**
 * Class to manage the static files.
 */
class StaticFile {
  /**
   * API object reference.
   *
   * @type {null}
   */
  api = null;

  /**
   * Search locations.
   *
   * @type {Array}
   */
  searchLocations = [];

  /**
   * Create a new instance of this class.
   *
   * @param api API object reference.
   */
  constructor (api) {
    let self = this

    // save API reference object
    self.api = api
  }

  /**
   * Get the public path.
   *
   * @param connection  Client connection object.
   * @param counter
   * @returns {*}
   */
  searchPath (connection, counter = 0) {
    let self = this

    if (
      self.searchLocations.length === 0 ||
      counter >= self.searchLocations.length
    ) {
      return null
    } else {
      return self.searchLocations[counter]
    }
  }

  /**
   * Get the content of a file by the 'connection.params.file' var.
   *
   * @param connection  Client connection object.
   * @param callback    Callback function.
   * @param counter
   */
  async get (connection, callback, counter = 0) {
    let self = this

    if (!connection.params.file || !self.searchPath(connection, counter)) {
      self.sendFileNotFound(
        connection,
        self.api.config.errors.fileNotProvided(connection),
        callback
      )
    } else {
      let file = null

      if (!path.isAbsolute(connection.params.file)) {
        file = path.normalize(
          self.searchPath(connection, counter) + '/' + connection.params.file
        )
      } else {
        file = connection.params.file
      }

      if (
        file.indexOf(path.normalize(self.searchPath(connection, counter))) !== 0
      ) {
        self.get(connection, callback, counter + 1)
      } else {
        self.checkExistence(file, async (exists, truePath) => {
          if (exists) {
            const {
              connection: connectionObj,
              fileStream,
              mime,
              length,
              lastModified,
              error
            } = await self.sendFile(truePath, connection)
            if (callback) {
              callback(connectionObj, error, fileStream, mime, length, lastModified)
            }
          } else {
            self.get(connection, callback, counter + 1)
          }
        })
      }
    }
  }

  /**
   * Send a file to the client.
   *
   * @param file
   * @param connection
   */
  async sendFile (file, connection) {
    let lastModified

    try {
      const stats = await this.api.utils.stats(file)
      const mime = Mime.getType(file)
      const length = stats.size
      const start = new Date().getTime()
      lastModified = stats.mtime

      const fileStream = fs.createReadStream(file)
      this.fileLogger(fileStream, connection, start, file, length)

      await new Promise(resolve => fileStream.on('open', resolve))
      return {
        connection,
        fileStream,
        mime,
        length,
        lastModified
      }
    } catch (error) {
      return this.sendFileNotFound(
        connection,
        this.api.config.errors.fileReadError(connection, String(error))
      )
    }
  }

  /**
   * Send a file not found error to the client.
   *
   * @param connection    Client connection object.
   * @param errorMessage  Error message to send.
   * @param callback      Callback function.
   */
  sendFileNotFound (connection, errorMessage) {
    connection.error = new Error(errorMessage)

    this.logRequest('{404: not found}', connection, null, null, false)

    return {
      connection,
      error: this.api.config.errors.fileNotFound(connection),
      mime: 'text/html',
      length: this.api.config.errors.fileNotFound(connection).length
    }
  }

  /**
   * Check the existence of a file.
   *
   * @param file
   * @param callback
   */
  checkExistence (file, callback) {
    let self = this

    fs.stat(file, (error, stats) => {
      // if exists an error execute the callback
      // function and return
      if (error) {
        return callback(false, file)
      }

      if (stats.isDirectory()) {
        let indexPath = file + '/' + self.api.config.general.directoryFileType
        self.checkExistence(indexPath, callback)
      } else if (stats.isSymbolicLink()) {
        fs.readlink(file, (error, truePath) => {
          if (error) {
            callback(false, file)
          } else {
            truePath = path.normalize(truePath)
            self.checkExistence(truePath, callback)
          }
        })
      } else if (stats.isFile()) {
        callback(true, file)
      } else {
        callback(false, file)
      }
    })
  }

  /**
   * Log a file request.
   */
  fileLogger (fileStream, connection, start, file, length) {
    fileStream.on('end', () => {
      const duration = new Date().getTime() - start
      this.logRequest(file, connection, length, duration, true)
    })

    fileStream.on('error', error => { throw error })
  }

  /**
   * Log file requests.
   *
   * @param file
   * @param connection
   * @param length
   * @param duration
   * @param success
   */
  logRequest (file, connection, length, duration, success) {
    let self = this

    self.api.log(`[ file @ ${connection.type}]`, 'debug', {
      to: connection.remoteIP,
      file: file,
      size: length,
      duration: duration,
      success: success
    })
  }
}

export default class {
  /**
   * Satellite load priority.
   *
   * @type {number}
   */
  loadPriority = 510;

  /**
   * Satellite load function.
   *
   * @param api   API reference object.
   * @param next  Callback function.
   */
  load (api, next) {
    // put static file methods available on the API object
    api.staticFile = new StaticFile(api)

    // load in the explicit public paths first
    if (api.config.general.paths !== undefined) {
      api.staticFile.searchLocations.push(
        path.normalize(api.config.general.paths.public)
      )
    }

    // finish satellite loading
    next()
  }
}
