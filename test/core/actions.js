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

  // ----------------------------------------------------------- [Internal Call]

  describe('can execute internally', () => {

    it('without params', done => {
      api.actions.call('formattedSum').catch(_ => { done() })
    })

    it('reject works', done => {
      api.actions.call('formattedSum').should.be.rejected()

      done()
    })

    it('normally', done => {
      api.actions.call('formattedSum', { a: 3, b: 3 })
        .should.be.fulfilledWith({ formatted: '3 + 3 = 6' })
        .then(_ => { done() })
    })

  })

  // ------------------------------------------------------------------ [Groups]

  describe('Groups', () => {
    it('can read the group from an action', done => {
      api.actions.groupsActions.should.have.key('example')
      done()
    })

    it('the action name exists on the group', done => {
      const arrayOfAction = api.actions.groupsActions.get('example')
      arrayOfAction.should.containDeep([ 'groupTest' ])
      done()
    })

    it('support the group property', done => {
      api.actions.call('groupTest').then(response => {
        response.result.should.be.String()
        response.result.should.be.equal('OK')
        done()
      })
    })

    it('support modules', done => {
      api.actions.call('modModuleTest').then(response => {
        response.result.should.be.String()
        response.result.should.be.equal('OK')
        done()
      })
    })

    it('support the actions property', done => {
      api.actions.call('modTest').then(response => {
        response.result.should.be.String()
        response.result.should.be.equal('OK')
        done()
      })
    })

    it('can add new items to an array', done => {
      api.actions.call('groupAddItems').then(response => {
        response.result.should.be.Array()
        response.result.should.containDeep([ 'a', 'b', 'c' ])
        done()
      })
    })

    it('can remove items from the array', done => {
      api.actions.call('groupRmItems').then(response => {
        response.result.should.be.Array()
        response.result.should.containDeep([ 'a' ])
        response.result.should.not.containDeep([ 'b' ])
        done()
      })
    })
  })

  // ------------------------------------------------------------------- [Timeout]

  describe('Timeout', () => {
    // define the timeout to just 100 ms
    before(done => {
      api.config.general.actionTimeout = 100
      done()
    })

    // reset the actionTimeout to the normal value
    after(done => {
      api.config.general.actionTimeout = 30000
      done()
    })

    it('when the action exceed the config time it timeout', () => {
      return api.actions.call('sleep', { sleepDuration: 150 }).should.be.rejected()
    })

    it('throw a well formed error', done => {
      api.actions.call('sleep', { sleepDuration: 150 })
      .catch(error => {
        error.code.should.be.equal('022')
        error.message.should.be.equal(`Response timeout for action 'sleep'`)
        done()
      })
    })
  })

  // ------------------------------------------------------------------- [Other]

  it('is possible finish an action retuning a promise', done => {
    api.actions.call('promiseAction')
      .then(response => {
        response.success.should.be.String()
        response.success.should.be.equal(`It's working!`)

        done()
      })
  })

  it('is possible using a foreign promise to finish an action', done => {
    api.actions.call('internalCallPromise')
      .then(response => {
        response.result.should.be.String()
        response.result.should.be.equal(`4 + 5 = 9`)

        done()
      })
  })

  it('can handle promise rejections and exceptions', done => {
    api.actions.call('errorPromiseAction')
      .catch(error => {
        error.message.should.be.equal('This is an error')
      })
      .then(_ => { done() })
  })

  it('can use a function to set a param default value', done => {
    api.actions.call('input-default-function')
      .then(response => {
        response.value.should.be.equal(156)
        done()
      })
  })

})
