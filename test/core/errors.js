'use strict'

let should = require('should')
let EngineClass = require(__dirname + '/../../dist/engine').default
let engine = new EngineClass({rootPath: process.cwd() + '/example'})

let async = require('async')

let api = null

describe('Core: Errors', function () {

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

  it('returns string errors properly', function (done) {
    api.helpers.runAction('aNotExistingAction', {}, response => {
      response.error.should.equal('Error: unknown action or invalid apiVersion')
      done()
    })
  })

  it('returns Error object properly', function (done) {
    api.config.errors.unknownAction = () => new Error('error test')

    api.helpers.runAction('aNotExistingAction', {}, response => {
      response.error.should.be.equal('Error: error test')
      done()
    })
  })

  it('returns generic object properly', function (done) {
    api.config.errors.unknownAction = () => { return {code: 'error160501'} }

    api.helpers.runAction('aNotExistingAction', {}, response => {
      response.error.should.have.property('code').equal('error160501')
      done()
    })
  })
})
