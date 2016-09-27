'use strict'

let fs = require('fs')
let request = require('request')

let should = require('should')
let EngineClass = require(__dirname + '/../../dist/engine').default
let engine = new EngineClass({rootPath: process.cwd() + '/example'})

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

  after(function (done) {
    // finish the Stellar instance execution
    engine.stop(function () {
      done()
    })
  })

  it('socket client connections should work: client 1', function (done) {
    client1.connect((error, data) => {
      data.context.should.equal('response')
      data.data.totalActions.should.equal(0)
      client1.welcomeMessage.should.equal('Hello human! Welcome to Stellar')
      done()
    })
  })

  it('socket client connections should work: client 2', function (done) {
    client2.connect((error, data) => {
      data.context.should.equal('response')
      data.data.totalActions.should.equal(0)
      client2.welcomeMessage.should.equal('Hello human! Welcome to Stellar')
      done()
    })
  })

  it('socket client connections should work: client 3', function (done) {
    client3.connect((error, data) => {
      data.context.should.equal('response')
      data.data.totalActions.should.equal(0)
      client3.welcomeMessage.should.equal('Hello human! Welcome to Stellar')
      done()
    })
  })

  it('can get connection details', function (done) {
    client1.detailsView(response => {
      response.data.connectedAt.should.be.within(0, new Date().getTime())
      response.data.remoteIP.should.equal('127.0.0.1')
      done()
    })
  })

  it('can run actions with errors', function (done) {
    client1.action('cacheTest', response => {
      response.error.should.equal('key is a required parameter for this action')
      done()
    })
  })

  it('can run actions properly', function (done) {
    client1.action('randomNumber', response => {
      should.not.exist(response.error)
      done()
    })
  })

  it('does not have sticky params', function (done) {
    client1.action('cacheTest', {key: 'testKey', value: 'testValue'}, response => {
      should.not.exist(response.error)
      response.cacheTestResults.loadResp.key.should.equal('cache_test_testKey')
      response.cacheTestResults.loadResp.value.should.equal('testValue')

      client1.action('cacheTest', response => {
        response.error.should.equal('key is a required parameter for this action')
        done()
      })
    })
  })

  it('can not call private actions', done => {
    client1.action('sumANumber', {a: 3, b: 4}, response => {
      response.error.should.equal(api.config.errors.privateActionCalled('sumANumber'))
      done()
    })
  })

  it('can execute namespaced actions', done => {
    client1.action('isolated.action', response => {
      should.not.exist(response.error)
      response.success.should.be.equal('ok')
      done()
    })
  })

  it('will limit how many simultaneous connections a client can have', function (done) {
    let responses = []
    client1.action('sleep', {sleepDuration: 100}, response => responses.push(response))
    client1.action('sleep', {sleepDuration: 200}, response => responses.push(response))
    client1.action('sleep', {sleepDuration: 300}, response => responses.push(response))
    client1.action('sleep', {sleepDuration: 400}, response => responses.push(response))
    client1.action('sleep', {sleepDuration: 500}, response => responses.push(response))
    client1.action('sleep', {sleepDuration: 600}, response => responses.push(response))

    setTimeout(() => {
      responses.length.should.equal(6)

      for (let i in responses) {
        let response = responses[ i ]

        if (i === 0 || i === '0') {
          response.error.should.eql('you have too many pending requests')
        } else {
          should.not.exist(response.error)
        }
      }

      done()
    }, 1000)
  })

  describe('chat', function () {

    before(function (done) {
      api.chatRoom.addMiddleware({
        name: 'join chat middleware',
        join: (connection, room, callback) => {
          api.chatRoom.broadcast({}, room, `I have entered the room: ${connection.id}`, e => {
            callback()
          })
        }
      })

      api.chatRoom.addMiddleware({
        name: 'leave chat middleware',
        leave: (connection, room, callback) => {
          api.chatRoom.broadcast({}, room, `I have left the room: ${connection.id}`, e => {
            callback()
          })
        }
      })

      done()
    })

    after(function (done) {
      api.chatRoom.middleware = {}
      api.chatRoom.globalMiddleware = []

      done()
    })

    beforeEach(function (done) {
      client1.roomAdd('defaultRoom', () => {
        client2.roomAdd('defaultRoom', () => {
          client3.roomAdd('defaultRoom', () => {
            // give some time to send the welcome messages and clients join the room
            setTimeout(done, 100)
          })
        })
      })
    })

    afterEach(function (done) {
      client1.roomLeave('defaultRoom', () => {
        client2.roomLeave('defaultRoom', () => {
          client3.roomLeave('defaultRoom', () => {
            client1.roomLeave('otherRoom', () => {
              client2.roomLeave('otherRoom', () => {
                client3.roomLeave('otherRoom', () => {
                  done()
                })
              })
            })
          })
        })
      })
    })

    it('can change rooms and get room details', function (done) {
      client1.roomAdd('otherRoom', () => {
        client1.detailsView(response => {
          should.not.exist(response.error)
          response.data.rooms[ 0 ].should.equal('defaultRoom')
          response.data.rooms[ 1 ].should.equal('otherRoom')

          client1.roomView('otherRoom', response => {
            response.data.membersCount.should.equal(1)
            done()
          })
        })
      })
    })

    it('will update client info when they change rooms', function (done) {
      client1.rooms[ 0 ].should.equal('defaultRoom')
      should.not.exist(client1.rooms[ 1 ])

      client1.roomAdd('otherRoom', response => {
        should.not.exist(response.error)
        client1.rooms[ 0 ].should.equal('defaultRoom')
        client1.rooms[ 1 ].should.equal('otherRoom')

        client1.roomLeave('defaultRoom', response => {
          should.not.exist(response.error)
          client1.rooms[ 0 ].should.equal('otherRoom')
          should.not.exist(client1.rooms[ 1 ])
          done()
        })
      })
    })

    it('clients can talk to each other', function (done) {
      let listener = response => {
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

      client1.roomAdd('otherRoom', () => {
        client1.on('say', listener)
        client2.roomAdd('otherRoom')
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
      client2.roomLeave('defaultRoom')
    })

    it('client will not get messages form other rooms', function (done) {
      client2.roomAdd('otherRoom', response => {
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

    it('connections can see member counts changing within rooms as folks join and leave', function (done) {
      client1.roomView('defaultRoom', response => {
        response.data.membersCount.should.equal(3)

        client2.roomLeave('defaultRoom', () => {
          client1.roomView('defaultRoom', response => {
            response.data.membersCount.should.equal(2)
            done()
          })
        })
      })
    })

    describe('middleware - say and onSay Receive', function () {

      before(function (done) {
        client1.roomAdd('defaultRoom', () => {
          client2.roomAdd('defaultRoom', () => {
            client3.roomAdd('defaultRoom', () => {
              setTimeout(() => { // timeout to skip welcome messages as clients join rooms
                done()
              }, 100)
            })
          })
        })
      })

      after(function (done) {
        client1.roomLeave('defaultRoom', () => {
          client2.roomLeave('defaultRoom', () => {
            client3.roomLeave('defaultRoom', () => {
              done()
            })
          })
        })
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
      client1.detailsView(response => {
        response.data.remoteIP.should.equal('127.0.0.1')

        let count = 0
        for (let id in api.connections.connections) {
          count++
          api.connections.connections[ id ].destroy()
        }
        count.should.equal(3)

        client1.detailsView(() => {
          throw new Error('should not get response')
        })

        setTimeout(done, 500)
      })
    })
  })

})
