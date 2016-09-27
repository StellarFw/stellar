'use strict'

let net = require('net')
let uuid = require('node-uuid')

let should = require('should')
let EngineClass = require(__dirname + '/../../dist/engine').default
let engine = new EngineClass({rootPath: process.cwd() + '/example'})

let api = null

// clients
let client1
let client2
let client3

/**
 * This function allows to make a socket request.
 *
 * @param client      Client object.
 * @param message     Message to be sent.
 * @param callback    Callback function.
 * @param delimiter   Message delimiter, by default `\r\n`
 */
let makeSocketRequest = (client, message, callback, delimiter = '\r\n') => {
  let lines = []
  let counter = 0

  // function to split by lines
  let rsp = d => {
    d.split(delimiter).forEach(line => lines.push(line))
    lines.push()
  }

  let responder = () => {
    if (lines.length === 0 && counter < 20) {
      counter++
      return setTimeout(responder, 10)
    }

    // get last line
    let lastLine = lines[ (lines.length - 1) ]

    // if the last line are empty get -2 position
    if (lastLine === '') { lastLine = lines[ (lines.length - 2) ] }

    let parsed = null

    try {
      parsed = JSON.parse(lastLine)
    } catch (e) {}

    // remove the event listener from the client
    client.removeListener('data', rsp)

    // execute the callback function
    if (typeof callback === 'function') { callback(parsed) }
  }

  // define a timeout
  setTimeout(responder, 50)

  // add a new listener to catch the response message
  client.on('data', rsp)

  // send the new message
  client.write(message + delimiter)
}

let connectClients = callback => {
  // callback function will be called after 1 second
  setTimeout(callback, 1000)

  // create three clients
  client1 = net.connect(api.config.servers.tcp.port, () => { client1.setEncoding('utf8') })
  client2 = net.connect(api.config.servers.tcp.port, () => { client2.setEncoding('utf8') })
  client3 = net.connect(api.config.servers.tcp.port, () => { client3.setEncoding('utf8') })
}

describe('Servers: TCP', function () {

  before(done => {
    // start a Stellar instance
    engine.start((error, a) => {
      // save the API object
      api = a

      // connect the clients
      connectClients(done)
    })
  })

  after(done => {
    // close all the tree sockets
    client1.write('quit\r\n')
    client2.write('quit\r\n')
    client3.write('quit\r\n')

    // finish the Stellar instance execution
    engine.stop(() => done())
  })

  it('connections should be able to connect and get JSON', done => {
    makeSocketRequest(client1, 'hello', response => {
      response.should.be.an.instanceOf(Object)
      response.error.should.equal('unknown action or invalid apiVersion')
      done()
    })
  })

  it('single string message are treated as actions', done => {
    makeSocketRequest(client1, 'status', response => {
      response.should.be.an.instanceOf(Object)
      response.id.should.equal('test-server')
      done()
    })
  })

  it('stringified JSON can also be send as actions', done => {
    makeSocketRequest(client1, JSON.stringify({action: 'status', params: {somethings: 'example'}}), response => {
      response.id.should.equal('test-server')
      done()
    })
  })

  it('can not call private actions', done => {
    makeSocketRequest(client1, JSON.stringify({action: 'sumANumber', params: {a: 3, b: 4}}), response => {
      response.error.should.equal(api.config.errors.privateActionCalled('sumANumber'))
      done()
    })
  })

  it('can execute namespaced actions', done => {
    makeSocketRequest(client1, JSON.stringify({ action: 'isolated.action' }), response => {
      should.not.exist(response.error)
      response.success.should.be.equal('ok')
      done()
    })
  })

  it('really long messages are OK', done => {
    // build a long message using v4 UUIDs
    let msg = {
      action: 'cacheTest',
      params: {
        key: uuid.v4(),
        value: uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4()
      }
    }

    makeSocketRequest(client1, JSON.stringify(msg), response => {
      response.cacheTestResults.loadResp.key.should.eql(`cache_test_${msg.params.key}`)
      response.cacheTestResults.loadResp.value.should.eql(msg.params.value)
      done()
    })
  })

  it('client can get their details', done => {
    makeSocketRequest(client2, 'detailsView', response => {
      response.status.should.equal('OK')
      response.data.should.be.an.instanceOf(Object)
      response.data.params.should.be.an.instanceOf(Object)
      response.data.connectedAt.should.be.within(10, new Date().getTime())
      done()
    })
  })

  it('params can update', done => {
    makeSocketRequest(client1, 'paramAdd key=otherKey', response => {
      response.status.should.equal('OK')

      makeSocketRequest(client1, 'paramsView', response => {
        response.data.key.should.equal('otherKey')
        done()
      })
    })
  })

  it('actions will fail without params set to the connection', done => {
    makeSocketRequest(client1, 'paramDelete key', () => {
      makeSocketRequest(client1, 'cacheTest', response => {
        response.error.should.equal('key is a required parameter for this action')
        done()
      })
    })
  })

  it('a new param can be added', done => {
    makeSocketRequest(client1, 'paramAdd key=testKey', response => {
      response.status.should.equal('OK')
      done()
    })
  })

  it('a new param can be viewed once added', done => {
    makeSocketRequest(client1, 'paramView key', response => {
      response.data.should.equal('testKey')
      done()
    })
  })

  it('another new param can be added', done => {
    makeSocketRequest(client1, 'paramAdd value=test123', response => {
      response.status.should.equal('OK')
      done()
    })
  })

  it('action will work once all the needed params are added', done => {
    makeSocketRequest(client1, 'cacheTest', response => {
      response.cacheTestResults.saveResp.should.equal(true)
      done()
    })
  })

  it('params are sticky between actions', done => {
    makeSocketRequest(client1, 'cacheTest', response => {
      should.not.exist(response.error)
      response.cacheTestResults.loadResp.key.should.equal('cache_test_testKey')
      response.cacheTestResults.loadResp.value.should.equal('test123')

      makeSocketRequest(client1, 'cacheTest', response => {
        response.cacheTestResults.loadResp.key.should.equal('cache_test_testKey')
        response.cacheTestResults.loadResp.value.should.equal('test123')
        done()
      })
    })
  })

  it('only params sent is a JSON block are used', done => {
    makeSocketRequest(client1, JSON.stringify({action: 'cacheTest', params: {key: 'someOtherKey'}}), response => {
      response.error.should.equal('value is a required parameter for this action')
      done()
    })
  })

  it('will limit how many simultaneous connection a client can have', done => {
    client1.write(JSON.stringify({action: 'sleep', params: {sleepDuration: 500}}) + '\r\n')
    client1.write(JSON.stringify({action: 'sleep', params: {sleepDuration: 600}}) + '\r\n')
    client1.write(JSON.stringify({action: 'sleep', params: {sleepDuration: 700}}) + '\r\n')
    client1.write(JSON.stringify({action: 'sleep', params: {sleepDuration: 800}}) + '\r\n')
    client1.write(JSON.stringify({action: 'sleep', params: {sleepDuration: 900}}) + '\r\n')
    client1.write(JSON.stringify({action: 'sleep', params: {sleepDuration: 1000}}) + '\r\n')

    let responses = []

    let checkResponses = data => {
      data.split('\n').forEach(line => {
        if (line.length > 0) { responses.push(JSON.parse(line)) }
      })

      if (responses.length === 6) {
        // remove the event listener
        client1.removeListener('data', checkResponses)

        for (let i in responses) {
          // get response object
          let response = responses[ i ]

          if (i === '0') {
            response.error.should.eql('you have too many pending requests')
          } else {
            should.not.exist(response.error)
          }
        }

        done()
      }
    }

    client1.on('data', checkResponses)
  })

  it('will error if received data length is bigger then maxDataLength', done => {
    // define a new data length value
    api.config.servers.tcp.maxDataLength = 64

    // build a long message using v4 UUIDs
    let msg = {
      action: 'cacheTest',
      params: {
        key: uuid.v4(),
        value: uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4()
      }
    }

    makeSocketRequest(client1, JSON.stringify(msg), response => {
      response.should.containEql({status: 'error', error: 'data length is too big (64 received/449 max)'})

      // return maxDataLength back to normal
      api.config.servers.tcp.maxDataLength = 0

      done()
    })
  })

  describe('custom data delimiter', function () {

    after(done => {
      // return the config back to normal so we don't error other tests
      api.config.servers.tcp.delimiter = '\n'
      done()
    })

    it('will parse /newline data delimiter', done => {
      api.config.servers.tcp.delimiter = '\n'

      makeSocketRequest(client1, JSON.stringify({action: 'status'}), response => {
        response.context.should.equal('response')
        done()
      }, '\n')
    })

    it('will parse custom `^]` data delimiter', done => {
      api.config.servers.tcp.delimiter = '^]'

      makeSocketRequest(client1, JSON.stringify({action: 'status'}), response => {
        response.context.should.equal('response')
        done()
      }, '^]')
    })
  })

  describe('chat', function () {

    before(done => {
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

    after(done => {
      api.chatRoom.middleware = {}
      api.chatRoom.globalMiddleware = []
      done()
    })

    beforeEach(done => {
      makeSocketRequest(client1, 'roomAdd defaultRoom')
      makeSocketRequest(client2, 'roomAdd defaultRoom')
      makeSocketRequest(client3, 'roomAdd defaultRoom')

      setTimeout(() => done(), 250)
    })

    afterEach(done => {
      [ 'defaultRoom', 'otherRoom' ].forEach(room => {
        makeSocketRequest(client1, `roomLeave ${room}`)
        makeSocketRequest(client2, `roomLeave ${room}`)
        makeSocketRequest(client3, `roomLeave ${room}`)
      })

      setTimeout(() => done(), 250)
    })

    it('clients are in the default room', done => {
      makeSocketRequest(client1, 'roomView defaultRoom', response => {
        response.data.room.should.equal('defaultRoom')
        done()
      })
    })

    it('clients can view additional info about rooms they are in', done => {
      makeSocketRequest(client1, 'roomView defaultRoom', response => {
        response.data.membersCount.should.equal(3)
        done()
      })
    })

    it('rooms can be changed', done => {
      makeSocketRequest(client1, 'roomAdd otherRoom', () => {
        makeSocketRequest(client1, 'roomLeave defaultRoom', response => {
          response.status.should.equal('OK')
          makeSocketRequest(client1, 'roomView otherRoom', response => {
            response.data.room.should.equal('otherRoom')
            done()
          })
        })
      })
    })

    it('connections in the first room see the count go down', done => {
      makeSocketRequest(client1, 'roomAdd otherRoom', () => {
        makeSocketRequest(client1, 'roomLeave defaultRoom', () => {
          makeSocketRequest(client2, 'roomView defaultRoom', response => {
            response.data.room.should.equal('defaultRoom')
            response.data.membersCount.should.equal(2)
            done()
          })
        })
      })
    })
  })

  describe('disconnect', function () {

    after(done => { connectClients(done) })

    it('Server can disconnect a client', done => {
      makeSocketRequest(client1, 'status', response => {
        response.id.should.equal('test-server')
        client1.readable.should.equal(true)
        client1.writable.should.equal(true)

        for (let id in api.connections.connections) { api.connections.connections[ id ].destroy() }

        setTimeout(() => {
          client1.readable.should.equal(false)
          client1.writable.should.equal(false)
          done()
        }, 100)
      })
    })
  })

})
