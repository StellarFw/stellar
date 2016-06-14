import uuid from 'node-uuid'
import GenericServer from '../GenericServer'

class TestServer extends GenericServer {

  constructor (api, type, options, attributes) {
    super(api, type, options, attributes)

    this.on('connection', connection => {
      connection.messages = []
      connection.actionCallbacks = {}
    })

    this.on('actionComplete', data => {
      data.response.messageCount = data.messageCount
      data.response.serverInformation = {
        serverName: api.config.general.serverName,
        apiVersion: api.config.general.apiVersion
      }

      data.response.requesterInformation = {
        id: data.connection.id,
        remoteIP: data.connection.remoteIP,
        receivedParams: {}
      };

      if (data.response.error) {
        data.response.error = api.config.errors.serializers.servers.helper(data.response.error)
      }

      for (var k in data.params) { data.response.requesterInformation.receivedParams[ k ] = data.params[ k ] }

      if (data.toRender === true) {
        this.sendMessage(data.connection, data.response, data.messageCount)
      }
    })
  }

  start (next) {
    this.api.log('loading the testServer', 'warning')
    next()
  }

  stop (next) { next() }

  sendMessage (connection, message, messageCount) {
    process.nextTick(() => {
      message.messageCount = messageCount
      connection.messages.push(message)

      if (typeof connection.actionCallbacks[ messageCount ] === 'function') {
        connection.actionCallbacks[ messageCount ](message, connection)
        delete connection.actionCallbacks[ messageCount ]
      }
    })
  }

  goodbye () {}

}

class Helpers {

  /**
   * API reference object.
   *
   * @type {null}
   */
  api = null

  /**
   * Create a new instance of Helpers class.
   *
   * @param api
   */
  constructor (api) { this.api = api }

  connection () {
    let self = this
    let id = uuid.v4()

    self.api.servers.servers.testServer.buildConnection({
      id: id,
      rawConnection: {},
      remoteAddress: 'testServer',
      remotePort: 0
    })

    return self.api.connections.connections[ id ]
  }

  initialize (api, options, next) {
    let type = 'testServer'
    let attributes = {
      canChat: true,
      logConnections: false,
      logExits: false,
      sendWelcomeMessage: true,
      verbs: api.connections.allowedVerbs
    }

    next(new TestServer(api, type, options, attributes))
  }

  runAction (actionName, input, next) {
    let self = this
    let connection

    if (typeof input === 'function' && !next) {
      next = input
      input = {}
    }

    if (input.id && input.type === 'testServer') {
      connection = input
    } else {
      connection = self.connection()
      connection.params = input
    }
    connection.params.action = actionName

    connection.messageCount++
    if (typeof next === 'function') {
      connection.actionCallbacks[ (connection.messageCount) ] = next
    }

    process.nextTick(function () {
      self.api.servers.servers.testServer.processAction(connection)
    })
  }
}

export default class {

  /**
   * Satellite load priority.
   *
   * @type {number}
   */
  loadPriority = 800

  /**
   * Satellite start priority.
   *
   * @type {number}
   */
  startPriority = 800

  /**
   * Satellite loading function.
   *
   * @param api   API object reference.
   * @param next  Callback function.
   */
  load (api, next) {
    if (api.env === 'test') {
      // put the helpers available to all platform
      api.helpers = new Helpers(api)
    }

    // finish the satellite load
    next()
  }

  /**
   * Satellite starting function.
   *
   * @param api   API object reference.
   * @param next  Callback function.
   */
  start (api, next) {
    if (api.env === 'test') {
      new api.helpers.initialize(api, {}, serverObject => {
        api.servers.servers.testServer = serverObject
        api.servers.servers.testServer.start(() => next())
      })

      return
    }

    // finish the satellite start
    next()
  }

}
