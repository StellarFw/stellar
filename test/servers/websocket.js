const request = require('request')

const should = require('should')
const EngineClass = require(__dirname + '/../../dist/engine').default
const engine = new EngineClass({ rootPath: process.cwd() + '/example' })

let api = null

// clients
let client1
let client2
let client3

let url

let connectClients = callback => {
  // get the StellarClient in scope
  let StellarClient = eval(api.servers.servers.websocket._compileClientJS())

  let Socket = api.servers.servers.websocket.server.Socket
  let url = `http://localhost:${api.config.servers.web.port}`
  let client1socket = new Socket(url)
  let client2socket = new Socket(url)
  let client3socket = new Socket(url)

  client1 = new StellarClient({}, client1socket)
  client2 = new StellarClient({}, client2socket)
  client3 = new StellarClient({}, client3socket)

  setTimeout(callback, 100)
}

describe('Servers: Web Socket', function () {
  before(function (done) {
    // start a Stellar instance
    engine.start((error, a) => {
      // save the API object
      api = a

      // set the server url
      url = `http://localhost:${api.config.servers.web.port}`
      api.config.servers.websocket.clientUrl = `http://localhost:${api.config.servers.web.port}`

      connectClients(() => { done() })
    })
  })

  after(done => {
    // finish the Stellar instance execution
    engine.stop(() => { done() })
  })

  it('socket client connections should work: client 1', done => {
    client1.connect().then(data => {
      data.context.should.equal('response')
      data.data.totalActions.should.equal(0)
      client1.welcomeMessage.should.equal('Hello human! Welcome to Stellar')
      done()
    })
  })

  it('socket client connections should work: client 2', function (done) {
    client2.connect().then(data => {
      data.context.should.equal('response')
      data.data.totalActions.should.equal(0)
      client2.welcomeMessage.should.equal('Hello human! Welcome to Stellar')
      done()
    })
  })

  it('socket client connections should work: client 3', function (done) {
    client3.connect().then(data => {
      data.context.should.equal('response')
      data.data.totalActions.should.equal(0)
      client3.welcomeMessage.should.equal('Hello human! Welcome to Stellar')
      done()
    })
  })

  it('can get connection details', function (done) {
    client1.detailsView().then(response => {
      response.data.connectedAt.should.be.within(0, new Date().getTime())
      response.data.remoteIP.should.equal('127.0.0.1')
      done()
    })
  })

  it('can run actions with errors', function (done) {
    client1.action('cacheTest').should.be.rejected().then(() => { done() })
  })

  it('can run actions properly', function (done) {
    client1.action('randomNumber').then(response => {
      should.not.exist(response.error)
      done()
    })
  })

  it('does not have sticky params', function (done) {
    client1.action('cacheTest', { key: 'testKey', value: 'testValue' }).then(response => {
      should.not.exist(response.error)
      response.cacheTestResults.loadResp.key.should.equal('cache_test_testKey')
      response.cacheTestResults.loadResp.value.should.equal('testValue')

      client1.action('cacheTest').catch(response => {
        response.error.key.should.equal('The key field is required.')
        done()
      })
    })
  })

  it('can not call private actions', done => {
    client1.action('sumANumber', { a: 3, b: 4 }).catch(response => {
      response.error.code.should.be.equal('002')
      done()
    })
  })

  it('can execute namespaced actions', done => {
    client1.action('isolated.action').then(response => {
      should.not.exist(response.error)
      response.success.should.be.equal('ok')
      done()
    })
  })

  // We are using the Stellar Client library, so we must the able to call over the limit of simultaneous connections
  // because we have a mechanism that keep a queue os pending requests
  it('will limit how many simultaneous connections a client can have', function (done) {
    let responses = []
    client1.action('sleep', { sleepDuration: 100 }).then(response => responses.push(response))
    client1.action('sleep', { sleepDuration: 200 }).then(response => responses.push(response))
    client1.action('sleep', { sleepDuration: 300 }).then(response => responses.push(response))
    client1.action('sleep', { sleepDuration: 400 }).then(response => responses.push(response))
    client1.action('sleep', { sleepDuration: 500 }).then(response => responses.push(response))
    client1.action('sleep', { sleepDuration: 600 }).then(response => responses.push(response))

    setTimeout(() => {
      // we must have an array with six responses
      responses.length.should.equal(6)

      // none of the response must have a 007 error
      for (const response of responses) { should.not.exist(response.error) }

      done()
    }, 1000)
  })

  describe('interceptors', () => {

    afterEach(done => {
      // we must cleanup all interceptors after the call
      client1.interceptors = []

      done()
    })

    it('can append new parameters', done => {
      client1.interceptors.push((params, next) => {
        params.a = 3
        params.b = 4

        next()
      })

      client1.action('formattedSum')
        .then(response => {
          response.formatted.should.be.equal('3 + 4 = 7')
        })
        .then(_ => { done() })
    })

    it('can return an object', done => {
      client1.interceptors.push((params, next) => {
        next({ someKey: 'someValue' })
      })

      client1.action('formattedSum')
        .should.be.fulfilledWith({ someKey: 'someValue' })
        .then(_ => { done() })
    })

    it('can return an error', done => {
      client1.interceptors.push((params, next) => {
        next(null, { message: 'anBadError' })
      })

      client1.action('formattedSum')
        .should.be.rejectedWith({ message: 'anBadError' })
        .then(_ => { done() })
    })

    it('can change the response', done => {
      client1.interceptors.push((params, next) => {
        next(response => {
          response.additionalField = 'awesomeCall'
        })
      })

      client1.action('formattedSum', { a: 3, b: 4 })
        .then(response => {
          response.additionalField.should.be.equal('awesomeCall')
        })
        .then(_ => { done() })
    })

  })

  describe('chat', () => {
    before(done => {
      api.chatRoom.addMiddleware({
        name: 'join chat middleware',
        join (connection, room, callback) {
          api.chatRoom.broadcast({}, room, `I have entered the room: ${connection.id}`).then(() => { callback() })
        }
      })

      api.chatRoom.addMiddleware({
        name: 'leave chat middleware',
        leave (connection, room, callback) {
          api.chatRoom.broadcast({}, room, `I have left the room: ${connection.id}`).then(() => { callback() })
        }
      })

      done()
    })

    after(done => {
      api.chatRoom.middleware = {}
      api.chatRoom.globalMiddleware = []

      done()
    })

    beforeEach(async () => {
      await client1.join('defaultRoom')
      await client2.join('defaultRoom')
      await client3.join('defaultRoom')
    })

    afterEach(async () => {
      await client1.leave('defaultRoom')
      await client2.leave('defaultRoom')
      await client3.leave('defaultRoom')
      await client1.leave('otherRoom')
      await client2.leave('otherRoom')
      await client3.leave('otherRoom')
    })

    it('can change rooms and get room details', async () => {
      // add the client to the room
      await client1.join('otherRoom')

      // get the client details
      const response = await client1.detailsView()

      should.not.exist(response.error)
      response.data.rooms[ 0 ].should.equal('defaultRoom')
      response.data.rooms[ 1 ].should.equal('otherRoom')

      const { data } = await client1.roomView('otherRoom')
      data.membersCount.should.equal(1)
    })

    it('will update client info when they change rooms', async () => {
      client1.rooms[ 0 ].should.equal('defaultRoom')
      should.not.exist(client1.rooms[ 1 ])

      // add client to defaultRoom
      let response = await client1.join('otherRoom')

      should.not.exist(response.error)
      client1.rooms[ 0 ].should.equal('defaultRoom')
      client1.rooms[ 1 ].should.equal('otherRoom')

      response = await client1.leave('defaultRoom')

      should.not.exist(response.error)
      client1.rooms[ 0 ].should.equal('otherRoom')
      should.not.exist(client1.rooms[ 1 ])
    })

    it('clients can send/catch events', done => {
      const listener = data => {
        client1.to('defaultRoom').off('someEvent', listener)
        data.should.be.equal('Just A Message')
        done()
      }

      client1.on('someEvent', listener)
      client2.emit('someEvent', 'Just A Message')
    })

    it('clients can talk to each other', done => {
      const listener = response => {
        client1.removeListener('say', listener)
        response.context.should.equal('user')
        response.message.should.equal('hello from client 2')
        done()
      }

      client1.on('say', listener)
      client2.say('defaultRoom', 'hello from client 2')
    })

    it('the client say method does not rely on order', function (done) {
      let listener = response => {
        client1.removeListener('say', listener)
        response.context.should.equal('user')
        response.message.should.equal('hello from client 2')
        done()
      }

      client2.say = function (room, message, callback) {
        this.send({
          message: message,
          room: room,
          event: 'say'
        }, callback)
      }

      client1.on('say', listener)
      client2.say('defaultRoom', 'hello from client 2')
    })

    it('connections are notified when a client join a room', function (done) {
      let listener = response => {
        client1.removeListener('say', listener)
        response.context.should.equal('user', listener)
        response.message.should.equal(`I have entered the room: ${client2.id}`)
        done()
      }

      client1.join('otherRoom').then(() => {
        client1.on('say', listener)
        client2.join('otherRoom')
      })
    })

    it('connections are notified when a client leave a room', function (done) {
      let listener = response => {
        client1.removeListener('say', listener)
        response.context.should.equal('user', listener)
        response.message.should.equal(`I have left the room: ${client2.id}`)
        done()
      }

      client1.on('say', listener)
      client2.leave('defaultRoom')
    })

    it('client will not get messages form other rooms', function (done) {
      client2.join('otherRoom').then(response => {
        should.not.exist(response.error)
        client2.rooms.length.should.equal(2)

        let listener = response => {
          client3.removeListener('say', listener)
          should.not.exist(response)
        }

        client3.rooms.length.should.equal(1)
        client3.on('say', listener)

        setTimeout(() => {
          client3.removeListener('say', listener)
          done()
        }, 1000)

        client2.say('otherRoom', 'you should not hear this')
      })
    })

    it('connections can see member counts changing within rooms as folks join and leave', done => {
      client1.roomView('defaultRoom')
        .then(response => {
          response.data.membersCount.should.equal(3)

          return client2.leave('defaultRoom')
        })
        .then(() => client1.roomView('defaultRoom'))
        .then(response => {
          response.data.membersCount.should.equal(2)
          done()
        })
    })

    describe('middleware - say and onSay Receive', function () {

      before(function (done) {
        client1.join('defaultRoom')
          .then(() => client2.join('defaultRoom'))
          .then(() => client3.join('defaultRoom'))
          .then(() => {
            // timeout to skip welcome messages as clients join rooms
            setTimeout(() => { done() }, 100)
          })
      })

      after(function (done) {
        client1.leave('defaultRoom')
          .then(() => client2.leave('defaultRoom'))
          .then(() => client3.leave('defaultRoom'))
          .then(() => { done() })
      })

      afterEach(function (done) {
        api.chatRoom.middleware = {}
        api.chatRoom.globalMiddleware = []

        done()
      })

      it('each listener receive custom message', function (done) {
        api.chatRoom.addMiddleware({
          name: 'say for each',
          say: (connection, room, messagePayload, callback) => {
            messagePayload.message += ` - To: ${connection.id}`
            callback(null, messagePayload)
          }
        })

        let listener1 = response => {
          client1.removeListener('say', listener1)
          response.message.should.equal(`Test Message - To: ${client1.id}`)
        }

        let listener2 = response => {
          client1.removeListener('say', listener2)
          response.message.should.equal(`Test Message - To: ${client2.id}`)
        }

        let listener3 = response => {
          client1.removeListener('say', listener3)
          response.message.should.equal(`Test Message - To: ${client3.id}`)
        }

        client1.on('say', listener1)
        client2.on('say', listener2)
        client3.on('say', listener3)
        client2.say('defaultRoom', 'Test Message')

        setTimeout(() => {
          client1.removeListener('say', listener1)
          client2.removeListener('say', listener2)
          client3.removeListener('say', listener3)
          done()
        }, 1000)
      })

      it('only one message should be received per connection', function (done) {
        let firstSayCall = true

        api.chatRoom.addMiddleware({
          name: 'first say middleware',
          say: (connection, room, messagePayload, callback) => {
            if (firstSayCall) {
              firstSayCall = false

              setTimeout(() => {
                callback()
              }, 200)
            } else {
              callback()
            }
          }
        })

        let messageReceived = 0
        let listener1 = response => messageReceived += 1
        let listener2 = response => messageReceived += 2
        let listener3 = response => messageReceived += 4

        client1.on('say', listener1)
        client2.on('say', listener2)
        client3.on('say', listener3)
        client2.say('defaultRoom', 'Test Message')

        setTimeout(() => {
          client1.removeListener('say', listener1)
          client2.removeListener('say', listener2)
          client3.removeListener('say', listener3)
          messageReceived.should.equal(7)
          done()
        }, 1000)
      })

    })
  })

  describe('disconnect', function () {

    beforeEach(function (done) {
      try {
        client1.disconnect()
        client2.disconnect()
        client3.disconnect()
      } catch (e) {}

      connectClients(() => {
        client1.connect()
        client2.connect()
        client3.connect()
        setTimeout(done, 500)
      })
    })

    it('client can disconnect', function (done) {
      api.servers.servers.websocket.connections().length.should.equal(3)
      client1.disconnect()
      client2.disconnect()
      client3.disconnect()
      setTimeout(() => {
        api.servers.servers.websocket.connections().length.should.equal(0)
        done()
      }, 500)
    })

    it('can be sent disconnect events from the server', function (done) {
      client1.detailsView().then(response => {
        response.data.remoteIP.should.equal('127.0.0.1')

        let count = 0
        for (let id in api.connections.connections) {
          count++
          api.connections.connections[ id ].destroy()
        }
        count.should.equal(3)

        client1.detailsView().then(() => {
          throw new Error('should not get response')
        })

        setTimeout(done, 500)
      })
    })
  })

})
