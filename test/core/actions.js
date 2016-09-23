'use strict'

// ---------------------------------------------------------------------------- [Imports]

const should = require('should')
const EngineClass = require(__dirname + '/../../dist/engine').default
const engine = new EngineClass({ rootPath: process.cwd() + '/example' })

// ---------------------------------------------------------------------------- [Tests]

let api = null

describe('Core: Actions', () => {

  before(function (done) {
    // start a Stellar instance
    engine.start(function (error, a) {
      api = a
      done()
    })
  })

  after(function (done) {
    // finish the Stellar instance execution
    engine.stop(function () {
      done()
    })
  })

  describe('can execute internally', () => {
    it('without params and callback', done => {
      api.actions.call('formattedSum')
      done()
    })

    it('without callback', done => {
      api.actions.call('formattedSum', { a: 3, b: 3 })
      done()
    })

    it('without params', done => {
      api.actions.call('formattedSum', error => {
        should.exist(error)
        done()
      })
    })

    it('normally', done => {
      api.actions.call('formattedSum', { a: 3, b: 3 }, (error, response) => {
        should.not.exist(error)
        response.formatted.should.equal('3 + 3 = 6')
        done()
      })
    })
  })

})
