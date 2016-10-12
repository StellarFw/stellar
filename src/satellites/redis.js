import async from 'async'
import uuid from 'node-uuid'

/**
 * Redis manager class.
 *
 * This creates a interface to connect with a redis server.
 */
class RedisManager {

  /**
   * API reference.
   *
   * @type {null}
   */
  api = null

  /**
   * Hash with all instantiate clients.
   *
   * @type {{}}
   */
  clients = {}

  /**
   * Callbacks.
   *
   * @type {{}}
   */
  clusterCallbacks = {}

  /**
   * Cluster callback timeouts.
   *
   * @type {{}}
   */
  clusterCallbackTimeouts = {}

  /**
   * Subscription handlers.
   *
   * @type {{}}
   */
  subscriptionHandlers = {}

  /**
   * Redis manager status.
   *
   * @type {{subscribed: boolean}}
   */
  status = {
    subscribed: false
  }

  /**
   * Constructor.
   *
   * @param api API reference.
   */
  constructor (api) {
    let self = this

    // save api reference object
    self.api = api

    // subscription handlers

    self.subscriptionHandlers[ 'do' ] = message => {
      if (!message.connectionId || (self.api.connections.connections[ message.connectionId ])) {
        let cmdParts = message.method.split('.')
        let cmd = cmdParts.shift()
        if (cmd !== 'api') { throw new Error('cannot operate on a outside of the api object') }
        let method = this.api.utils.stringToHash(api, cmdParts.join('.'))

        let callback = () => {
          let responseArgs = Array.apply(null, arguments).sort()
          process.nextTick(() => { self.respondCluster(message.requestId, responseArgs) })
        }

        let args = message.args
        if (args === null) { args = [] }
        if (!Array.isArray(args)) { args = [ args ] }
        args.push(callback)
        method.apply(null, args)
      }
    }

    self.subscriptionHandlers[ 'doResponse' ] = message => {
      if (self.clusterCallbacks[ message.requestId ]) {
        clearTimeout(self.clusterCallbackTimeouts[ message.requestId ])
        self.clusterCallbacks[ message.requestId ].apply(null, message.response)
        delete self.clusterCallbacks[ message.requestId ]
        delete self.clusterCallbackTimeouts[ message.requestId ]
      }
    }
  }

  initialize (callback) {
    let self = this

    let jobs = []

    // array with the queues to create
    let queuesToCreate = [ 'client', 'subscriber', 'tasks' ]

    queuesToCreate.forEach(r => {
      jobs.push(done => {
        if (self.api.config.redis[ r ].buildNew === true) {
          // get arguments
          var args = self.api.config.redis[ r ].args

          // create a new instance
          self.clients[ r ] = new self.api.config.redis[ r ].constructor(args[ 0 ], args[ 1 ], args[ 2 ])

          // on error event
          self.clients[ r ].on('error', error => { self.api.log(`Redis connection ${r} error`, error) })

          // on connect event
          self.clients[ r ].on('connect', () => {
            self.api.log(`Redis connection ${r} connected`, 'info')
            done()
          })
        } else {
          self.clients[ r ] = self.api.config.redis[ r ].constructor.apply(null, self.api.config.redis[ r ].args)
          self.clients[ r ].on('error', error => { self.api.log(`Redis connection ${r} error`, 'error', error) })
          self.api.log(`Redis connection ${r} connected`, 'info')
          done()
        }
      })
    })

    if (!self.status.subscribed) {
      jobs.push(done => {
        // ensures that clients subscribe the default channel
        self.clients.subscriber.subscribe(self.api.config.general.channel)
        self.status.subscribed = true

        // on 'message' event execute the handler
        self.clients.subscriber.on('message', (messageChannel, message) => {
          // parse the JSON message if exists
          try {
            message = JSON.parse(message)
          } catch (e) {
            message = {}
          }

          if (messageChannel === self.api.config.general.channel && message.serverToken === self.api.config.general.serverToken) {
            if (self.subscriptionHandlers[ message.messageType ]) {
              self.subscriptionHandlers[ message.messageType ](message)
            }
          }
        })

        // execute the callback
        done()
      })
    }

    async.series(jobs, callback)
  }

  /**
   * Publish a payload to the redis server.
   *
   * @param payload Payload to be published.
   */
  publish (payload) {
    let self = this

    // get default Redis channel
    let channel = self.api.config.general.channel

    // publish redis message
    self.clients.client.publish(channel, JSON.stringify(payload))
  }

  // ------------------------------------------------------------------------------------------------------------- [RPC]

  doCluster (method, args, connectionId, callback) {
    let self = this

    let requestId = uuid.v4()
    let payload = {
      messageType: 'do',
      serverId: self.api.id,
      serverToken: self.api.config.general.serverToken,
      requestId: requestId,
      method: method,
      connectionId: connectionId,
      args: args
    }

    self.publish(payload)

    if (typeof callback === 'function') {
      self.clusterCallbacks[ requestId ] = callback
      self.clusterCallbackTimeouts[ requestId ] = setTimeout((requestId) => {
        if (typeof self.clusterCallbacks[ requestId ] === 'function') {
          self.clusterCallbacks[ requestId ](new Error('RPC Timeout'))
        }
        delete self.clusterCallbacks[ requestId ]
        delete self.clusterCallbackTimeouts[ requestId ]
      }, self.api.config.general.rpcTimeout, requestId)
    }
  }

  respondCluster (requestId, response) {
    let self = this

    let payload = {
      messageType: 'doResponse',
      serverId: self.api.id,
      serverToken: self.api.config.general.serverToken,
      requestId: requestId,
      response: response // args to pass back, including error
    }

    self.publish(payload)
  }
}

/**
 * Redis initializer.
 */
export default class {

  /**
   * Initializer load priority.
   *
   * @type {number}
   */
  loadPriority = 200

  /**
   * Initializer stop priority.
   *
   * @type {number}
   */
  stopPriority = 999

  /**
   * Initializer load method.
   *
   * @param api   API reference.
   * @param next  Callback
   */
  load (api, next) {
    // put the redis manager available
    api.redis = new RedisManager(api)

    // initialize redis manager
    api.redis.initialize(error => {
      // execute the callback if exists an error
      if (error) { return next(error) }

      api.redis.doCluster('api.log', `Stellar member ${api.id} has joined the cluster`, null, null)

      // finish the loading
      process.nextTick(next)
    })
  }

  /**
   * Stop initializer.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  stop (api, next) {
    // execute all existent timeouts and remove them
    for (let i in api.redis.clusterCallbackTimeouts) {
      clearTimeout(api.redis.clusterCallbackTimeouts[ i ])
      delete api.redis.clusterCallbakTimeouts[ i ]
      delete api.redis.clusterCallbaks[ i ]
    }

    // inform the cluster of stellar leaving
    api.redis.doCluster('api.log', `Stellar member ${api.id} has left the cluster`, null, null)

    // unsubscribe stellar instance and finish the stop method execution
    process.nextTick(() => {
      api.redis.clients.subscriber.unsubscribe()
      api.redis.status.subscribed = false
      next()
    })
  }

}
