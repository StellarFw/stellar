'use strict'

let should = require('should')
let EngineClass = require(__dirname + '/../../dist/engine').default
let engine = new EngineClass({ rootPath: process.cwd() + '/example' })

let api = null

describe('Core: Utils', () => {
  before(done => {
    engine.start((_, a) => {
      api = a
      done()
    })
  })

  after(done => engine.stop(done))

  describe('for randomStr', () => {
    it('the function must exist and the result be a string', () => {
      should.exist(api.utils.randomStr)
      api.utils.randomStr().should.be.String()
    })

    it('when no length given must generate a 16 length string', () => {
      const result = api.utils.randomStr()
      result.length.should.be.equal(16)
    })

    it('when length is given the generated string must have that length', () => {
      const result = api.utils.randomStr(32)
      result.length.should.be.equal(32)
    })
  })
})
