import uuid from 'node-uuid'
import Utils from '../utils'

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
  api = null;

  /**
   * Callbacks.
   *
   * @type {{}}
   */
  clusterCallbacks = {}

  /**
   * Luster callbacks timeouts.
   *
   * @type {{}}
   */
  clusterCallbacksTimeout = {}

  /**
   * Subscription handlers.
   *
   * @type {{}}
   */
  subscriptionHandlers = {}

  /**
   * Redis manager status.
   *
   * @type {{client: boolean, subscriber: boolean, subscribed: boolean, calledback: boolean}}
   */
  status = {
    client: false,
    subscriber: false,
    subscribed: false,
    calledback: false
  }

  /**
   * Constructor.
   *
   * @param api API reference.
   */
  constructor (api) {
    let self = this

    self.api = api

    // subscription handlers

    self.subscriptionHandlers.do = (message) => {
      if (!message.connectionId || (self.api.connections.connections[ message.connectionId ])) {
        let cmdParts = message.method.split('.')
        let cmd = cmdParts.shift()
        if (cmd !== 'api') { throw new Error('cannot operate on a outside of the api object') }
        let method = Utils.stringTohash(cmdParts.join('.'))

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

    self.subscriptionHandlers.doResponse = (message) => {
      if (self.clusterCallbacks[ message.requestId ]) {
        clearTimeout(self.clusterCallbacksTimeout[ message.requestId ])
        self.clusterCallbacks[ message.requestId ].apply(null, message.response)
        delete self.clusterCallbacks[ message.requestId ]
        delete self.clusterCallbacksTimeout[ message.requestId ]
      }
    };
  }

  /**
   * Boot redis server.
   *
   * @param callback  Callback function.
   */
  start (callback) {
    let self = this

    // get Redis package
    let redisPackage = require(self.api.config.redis.pkg)

    // check if is a fake redis server
    if (self.api.config.redis.pkg === 'fakeredis') {
      self.api.log('running with fakeredis', 'warning')
      redisPackage.fast = true

      self.client = redisPackage.createClient(String(self.api.config.redis.host))
      self.subscriber = redisPackage.createClient(String(self.api.config.redis.host))
    } else {
      self.client = redisPackage.createClient(self.api.config.redis.port, self.api.config.redis.host, self.api.config.redis.options)
      self.subscriber = redisPackage.createClient(self.api.config.redis.port, self.api.config.redis.host, self.api.config.redis.options)
    }

    // define some event handlers
    self.client.on('error', err => { self.api.log(`Redis Error (client): ${err}`, 'emerg') })

    self.subscriber.on('error', err => { self.api.log(`Redis Error (subscriber): ${err}`, 'emerg') })

    self.client.on('end', () => { self.api.log('Redis Connection Closed (client)', 'debug') })

    self.subscriber.on('end', () => {
      self.api.log('Redis Connection Closed (subscriber)', 'debug')

      self.status.subscriber = false
      self.status.subscribed = false
    });

    self.client.on('connect', () => {
      // select database
      if (self.database) { self.client.select(self.api.config.redis.database) }

      // mark client as connected
      self.api.log('connected to redis (client)', 'debug')
      self.status.client = true

      if (self.status.client === true && self.status.subscribed === true && self.status.calledback === false) {
        self.status.calledback = true
        callback()
      }
    });

    // subscribe a channel if that was not been done yet
    if (!self.status.subscribed) {
      self.subscriber.subscribe(self.api.config.redis.channel)
      self.status.subscribed = true
    }

    self.subscriber.on('connect', () => {
      self.api.log('connected to redis (subscriber)', 'debug')
      self.status.subscriber = true

      if (self.status.client === true && self.status.subscriber === true && self.status.calledback === false) {
        self.status.calledback = true
        callback()
      }
    });

    if (self.api.config.redis.pkg === 'fakeredis') {
      self.status.client = true
      self.status.subscriber = true

      process.nextTick(() => {
        self.status.calledback = true
        callback()
      })
    }
  }

  /**
   * Publish a payload to the redis server.
   *
   * @param payload Payload to be published.
   */
  publish (payload) {
    let self = this

    let channel = self.api.config.redis.channel
    self.client.publish(channel, JSON.stringify(payload))
  }

  // RPC

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
    };

    self.publish(payload)

    if (typeof  callback === 'function') {
      self.clusterCallbacks[ requestId ] = callback
      self.clusterCallbacksTimeout[ requestId ] = setTimeout((requestId) => {
        if (typeof self.clusterCallbacks[ requestId ] === 'function') {
          self.clusterCallbacks[ requestId ](new Error('RPC Timeout'))
        }
        delete self.clusterCallbacks[ message.requestId ]
        delete self.clusterCallbacksTimeout[ message.requestId ]
      }, self.api.config.redis.rpcTimeout, requestId)
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
    };

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
   * Initializer start priority.
   *
   * @type {number}
   */
  startPriority = 101

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

    // finish the loading
    next()
  }

  /**
   * Start the initializer.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  start (api, next) {
    // start manager
    api.redis.start(() => {
      api.redis.doCluster('api.log', `Stellar member ${api.id} has joined the cluster`, null, null)

      // end the initializer loading
      process.nextTick(next)
    });
  }

  /**
   * Stop initializer.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  stop (api, next) {
    // execute all existent timeouts and remove them
    for (let i in api.redis.clusterCallbacksTimeout) {
      clearTimeout(api.redis.clusterCallbacksTimeout[ i ])
      delete api.redis.clusterCallbakTimeouts[ i ]
      delete api.redis.clusterCallbaks[ i ]
    }

    // inform the cluster of stellar leaving
    api.redis.doCluster('api.log', `Stellar member ${api.id} has left the cluster`, null, null)

    // unsubscribe stellar instance and finish the stop method execution
    process.nextTick(() => {
      api.redis.subscriber.unsubscribe()
      next()
    });
  }

}
