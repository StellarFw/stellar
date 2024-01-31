const should = require('should')
const EngineClass = require(__dirname + '/../../dist/engine').default
const engine = new EngineClass({rootPath: process.cwd() + '/example'})

let api = null

describe('Test: RunAction', () => {

  before(done => {
    // start a Stellar instance
    engine.start((_, a) => {
      api = a
      done()
    })
  })

  after(function (done) {
    // finish the Stellar instance execution
    engine.stop(done)
  })

  it('can run the task manually', done => {
    api.helpers.runTask('runAction', { action: 'randomNumber' }, (error, response) => {
      should.not.exist(error)

      response.number.should.be.greaterThan(0)
      response.number.should.be.lessThan(1)

      done()
    })
  })
})
