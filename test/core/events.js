'use strict'

let should = require('should')
let EngineClass = require(__dirname + '/../../dist/engine').default
let engine = new EngineClass({ rootPath: process.cwd() + '/example' })

let api = null

describe('Core: Event', function () {

  before(done => {
    // start a Stellar instance
    engine.start((error, a) => {
      api = a
      done()
    })
  })

  after(done => {
    // finish the Stellar instance execution
    engine.stop(() => { done() })
  })

  afterEach(done => {
    api.events.events.delete('prog')
    done()
  })

  it('event methods should exist', done => {
    api.events.should.be.an.instanceOf(Object)
    api.events.fire.should.be.an.instanceOf(Function)
    api.events.listener.should.be.an.instanceOf(Function)
    done()
  })

  it('can read events from the listeners folder', done => {
    api.events.events.size.should.be.equal(1)
    api.events.events.has('example').should.be.equal(true)
    done()
  })

  it('event.listener', done => {
    api.events.listener('prog', (api, params, next) => {})
    api.events.events.size.should.be.equal(2)
    api.events.events.has('prog').should.be.equal(true)
    done()
  })

  it('event.fire', done => {
    api.events.fire('example', { value: '' })
      .then(response => {
        response.value.should.be.equal('thisIsATest')
        done()
      })
  })

  it('listeners need an event name and a run function', done => {
    should(api.events._listenerObj({})).be.equal(false)
    should(api.events._listenerObj({ event: 'example' })).be.equal(false)
    should(api.events._listenerObj({ event: 'example', run: (api, params, next) => {} })).be.equal(true)
    done()
  })

  it('listeners can have a priority value', done => {
    api.events.listener('prog', (api, params, next) => {next()}, 200)
    api.events.events.get('prog')[ 0 ].priority.should.be.equal(200)
    done()
  })

  it('listeners have a default priority', done => {
    api.events.listener('prog', (api, params, next) => {next()})
    api.events.events.get('prog')[ 0 ].priority.should.be.equal(api.config.general.defaultListenerPriority)
    done()
  })

  it('listeners are executed in order', done => {
    api.events.listener('prog', (api, params, next) => {
      params.value += '1'
      next()
    }, 10)

    api.events.listener('prog', (api, params, next) => {
      params.value += '0'
      next()
    }, 5)

    api.events.fire('prog', { value: 'test' })
      .then(response => {
        response.value.should.be.equal('test01')
        done()
      })
  })
})
