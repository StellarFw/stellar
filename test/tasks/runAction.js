'use strict'

let should = require('should')
let EngineClass = require(__dirname + '/../../dist/engine').default
let engine = new EngineClass({rootPath: process.cwd() + '/example'})

let api = null

describe('Test: RunAction', function () {

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

  it('can run the task manually', function (done) {
    api.helpers.runTask('runAction', {action: 'randomNumber'}, (error, response) => {
      should.not.exist(error)
      response.number.should.be.greaterThan(0)
      response.number.should.be.lessThan(1)
      done()
    })
  })
})
