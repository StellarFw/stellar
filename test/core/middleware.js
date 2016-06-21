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

  // reset list of middleware after each test case
  afterEach(function (done) {
    api.actions.middleware = {}
    api.actions.globalMiddleware = []
    done()
  })

  describe('action preProcessors', function () {

    it('I can define a global preProcessor and it can append the connection', function (done) {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        preProcessor: (data, next) => {
          data.response._preProcessorNote = 'note'
          next()
        }
      })

      api.helpers.runAction('randomNumber', response => {
        response._preProcessorNote.should.be.equal('note')
        done()
      })
    })

    it('I can define a local preProcessor and it will not append the connection', function (done) {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: false,
        preProcessor: (data, next) => {
          data.response._preProcessorNote = 'note'
          next()
        }
      })

      api.helpers.runAction('randomNumber', response => {
        should.not.exist(response._preProcessorNote)
        done()
      })
    })

    it('preProcessors with priority run in the right order', function (done) {
      // first priority
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: 1,
        preProcessor: (data, next) => {
          data.response._preProcessorNote1 = 'first'
          data.response._preProcessorNote2 = 'first'
          data.response._preProcessorNote3 = 'first'
          data.response._preProcessorNote4 = 'first'
          next()
        }
      })

      // lower number priority (runs sooner)
      api.actions.addMiddleware({
        name: 'early test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        preProcessor: (data, next) => {
          data.response._preProcessorNote2 = 'early'
          data.response._preProcessorNote3 = 'early'
          data.response._preProcessorNote4 = 'early'
          next()
        }
      })

      // default priority
      api.actions.addMiddleware({
        name: 'default test middleware',
        global: true,
        preProcessor: (data, next) => {
          data.response._preProcessorNote3 = 'default'
          data.response._preProcessorNote4 = 'default'
          next()
        }
      })

      // higher number priority (runs later)
      api.actions.addMiddleware({
        name: 'early test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority + 1,
        preProcessor: (data, next) => {
          data.response._preProcessorNote4 = 'late'
          next()
        }
      })

      api.helpers.runAction('randomNumber', response => {
        response._preProcessorNote1.should.equal('first')
        response._preProcessorNote2.should.equal('early')
        response._preProcessorNote3.should.equal('default')
        response._preProcessorNote4.should.equal('late')
        done()
      })
    })

    it('multiple preProcessors with same priority are executed', function (done) {
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        preProcessor: (data, next) => {
          data.response._processorNoteFrist = 'first'
          next()
        }
      })

      api.actions.addMiddleware({
        name: 'second test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        preProcessor: (data, next) => {
          data.response._processorNoteSecond = 'second'
          next()
        }
      })

      api.helpers.runAction('randomNumber', response => {
        response._processorNoteFrist.should.be.equal('first')
        response._processorNoteSecond.should.be.equal('second')
        done()
      })
    })

    it('postProcessors can append the connection', function (done) {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        postProcessor: (data, next) => {
          data.response._postProcessorNote = 'note'
          next()
        }
      })

      api.helpers.runAction('randomNumber', response => {
        response._postProcessorNote.should.be.equal('note')
        done()
      })
    })

    it('postProcessors with priority run in the right order', function (done) {
      // first priority
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: 1,
        postProcessor: (data, next) => {
          data.response._postProcessorNote1 = 'first'
          data.response._postProcessorNote2 = 'first'
          data.response._postProcessorNote3 = 'first'
          data.response._postProcessorNote4 = 'first'
          next()
        }
      })

      // lower number priority (runs sooner)
      api.actions.addMiddleware({
        name: 'early test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        postProcessor: (data, next) => {
          data.response._postProcessorNote2 = 'early'
          data.response._postProcessorNote3 = 'early'
          data.response._postProcessorNote4 = 'early'
          next()
        }
      })

      // default priority
      api.actions.addMiddleware({
        name: 'default test middleware',
        global: true,
        postProcessor: (data, next) => {
          data.response._postProcessorNote3 = 'default'
          data.response._postProcessorNote4 = 'default'
          next()
        }
      })

      // higher number priority (runs later)
      api.actions.addMiddleware({
        name: 'early test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority + 1,
        postProcessor: (data, next) => {
          data.response._postProcessorNote4 = 'late'
          next()
        }
      })

      api.helpers.runAction('randomNumber', response => {
        response._postProcessorNote1.should.equal('first')
        response._postProcessorNote2.should.equal('early')
        response._postProcessorNote3.should.equal('default')
        response._postProcessorNote4.should.equal('late')
        done()
      })
    })

    it('multiple postProcessors with same priority are executed', function (done) {
      api.actions.addMiddleware({
        name: 'first test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        postProcessor: (data, next) => {
          data.response._processorNoteFrist = 'first'
          next()
        }
      })

      api.actions.addMiddleware({
        name: 'second test middleware',
        global: true,
        priority: api.config.general.defaultProcessorPriority - 1,
        postProcessor: (data, next) => {
          data.response._processorNoteSecond = 'second'
          next()
        }
      })

      api.helpers.runAction('randomNumber', response => {
        response._processorNoteFrist.should.be.equal('first')
        response._processorNoteSecond.should.be.equal('second')
        done()
      })
    })

    it('preProcessors can block actions', function (done) {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        preProcessor: (data, next) => {
          next(new Error('BLOCKED'))
        }
      })

      api.helpers.runAction('randomNumber', response => {
        response.error.should.be.equal('Error: BLOCKED')
        should.not.exist(response.randomNumber)
        done()
      })
    })

    it('postProcessors can modify toRender', function (done) {
      api.actions.addMiddleware({
        name: 'test middleware',
        global: true,
        postProcessor: (data, next) => {
          data.toRender = false
          next()
        }
      })

      api.helpers.runAction('randomNumber', () => { throw new Error('should not get a response') })

      setTimeout(done, 1000)
    })
  })

  describe('connection create/destroy callbacks', function () {

    beforeEach(function (done) {
      api.connections.middleware = {}
      api.connections.globalMiddleware = []
      done()
    })

    afterEach(function (done) {
      api.connections.middleware = {}
      api.connections.globalMiddleware = []
      done()
    })

    it('can create callbacks on connection creation', function (done) {
      api.connections.addMiddleware({
        name: 'connection middleware',
        create: () => { done() }
      })

      api.helpers.runAction('randomNumber', () => {})
    })

    it('can create callbacks on connection destroy', function (done) {
      api.connections.addMiddleware({
        name: 'connection middleware',
        destroy: () => { done() }
      })

      api.helpers.runAction('randomNumber', (response, connection) => { connection.destroy() })
    })
  })
})
