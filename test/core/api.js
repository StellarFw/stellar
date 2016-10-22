'use strict'

let should = require('should')
let EngineClass = require(__dirname + '/../../dist/engine').default
let engine = new EngineClass({rootPath: process.cwd() + '/example'})

let api = null

describe('Core: API', function () {

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

  it('should have an api object with proper parts', function (done) {
    [
      api.actions.actions,
      api.actions.versions
    ].forEach(item => item.should.be.an.Object)

    api.config.should.be.an.instanceOf(Object)

    done()
  })

  describe('api versions', function () {

    before(done => {
      api.actions.versions.versionedAction = [ 1, 2, 3 ]
      api.actions.actions.versionedAction = {
        '1': {
          name: 'versionedAction',
          description: 'A test action',
          version: 1,
          run: (api, action, next) => {
            action.response.version = 1
            next()
          }
        },
        '2': {
          name: 'versionedAction',
          description: 'A test action',
          version: 2,
          run: (api, action, next) => {
            action.response.version = 2
            next()
          }
        },
        '3': {
          name: 'versionedAction',
          description: 'A test action',
          version: 3,
          run: (api, action, next) => {
            let complexError = {
              'reason': {'msg': 'description'}
            }
            next(complexError)
          }
        }
      }

      done()
    })

    after(function (done) {
      delete api.actions.actions.versionedAction
      delete api.actions.versions.versionedAction
      done()
    })

    it('will default actions to version 1 when no version is provided by the definition', function (done) {
      api.helpers.runAction('randomNumber', function (response) {
        response.requesterInformation.receivedParams.apiVersion.should.equal(1)
        done()
      })
    })

    it('can specify an apiVersion', function (done) {
      api.helpers.runAction('versionedAction', {apiVersion: 1}, function (response) {
        response.requesterInformation.receivedParams.apiVersion.should.equal(1)

        api.helpers.runAction('versionedAction', {apiVersion: 2}, function (response) {
          response.requesterInformation.receivedParams.apiVersion.should.equal(2)
          done()
        })
      })
    })

    it('will default clients to the latest version of the action', function (done) {
      api.helpers.runAction('versionedAction', function (response) {
        response.requesterInformation.receivedParams.apiVersion.should.equal(3)
        done()
      })
    })

    it('will fail on a missing version', function (done) {
      api.helpers.runAction('versionedAction', {apiVersion: 16}, function (response) {
        response.error.should.equal('Error: unknown action or invalid apiVersion')
        done()
      })
    })

    it('will fail in a missing action', function (done) {
      api.helpers.runAction('undefinedAction', {}, function (response) {
        response.error.should.equal('Error: unknown action or invalid apiVersion')
        done()
      })
    })

    it('can return complex error responses', function (done) {
      api.helpers.runAction('versionedAction', {apiVersion: 3}, function (response) {
        response.error.reason.msg.should.equal('description')
        done()
      })
    })

  })

  describe('Action Params', function () {

    before(function (done) {
      api.actions.versions.testAction = [ 1 ]
      api.actions.actions.testAction = {
        '1': {
          name: 'testAction',
          description: 'this action has some required params',
          version: 1,
          inputs: {
            requiredParam: {required: true},
            optionalParam: {required: false},
            fancyParam: {
              required: false,
              default: 'test123',
              validator: function (s) {
                if (s === 'test123') { return true }
                return `fancyParam should be 'test123'. so says ${this.id}`
              }
            }
          },

          run: (api, connection, next) => {
            connection.response.params = connection.params
            next()
          }
        }
      }

      done()
    })

    after(function (done) {
      delete api.actions.versions.testAction
      delete api.actions.actions.testAction

      done()
    })

    it('correct params that are false or [] should be allowed', function (done) {
      api.helpers.runAction('testAction', {requiredParam: false}, response => {
        response.params.requiredParam.should.equal(false)
        api.helpers.runAction('testAction', {requiredParam: []}, response => {
          response.params.requiredParam.should.eql([])
          done()
        })
      })
    })

    it('will fail for missing or empty params', function (done) {
      api.helpers.runAction('testAction', {requiredParam: ''}, response => {
        should.not.exist(response.error)

        api.helpers.runAction('testAction', {}, response => {
          response.error.requiredParam.should.be.equal('The requiredParam field is required.')
          done()
        })
      })
    })

    it('correct params respect config options', function (done) {
      api.config.general.missingParamChecks = [ undefined ]

      api.helpers.runAction('testAction', {requiredParam: ''}, response => {
        response.params.requiredParam.should.equal('')

        api.helpers.runAction('testAction', {requiredParam: null}, response => {
          should(response.params.requiredParam).eql(null)
          done()
        })
      })
    })

    it('will set a default when params are not provided', function (done) {
      api.helpers.runAction('testAction', {requiredParam: true}, response => {
        response.params.fancyParam.should.equal('test123')
        done()
      })
    })

    it('will use validator if provided', function (done) {
      api.helpers.runAction('testAction', {requiredParam: true, fancyParam: 123}, response => {
        response.error.fancyParam.should.be.equal(`fancyParam should be 'test123'. so says test-server`)
        done()
      })
    })

    it('validator will have the API object in scope and this', function (done) {
      api.helpers.runAction('testAction', {requiredParam: true, fancyParam: 123}, response => {
        response.error.should.match(new RegExp(api.id))
        done()
      })
    })
  })

})
