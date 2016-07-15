'use strict'

let fs = require('fs')
let os = require('os')
let path = require('path')
let request = require('request')

let should = require('should')
let EngineClass = require(__dirname + '/../../dist/engine').default
let engine = new EngineClass({rootPath: process.cwd() + '/example'})

let api = null
let url = null

describe('Servers: HTTP', function () {

  before(done => {
    // start a Stellar instance
    engine.start((error, a) => {
      // save the API object
      api = a

      // define the server URL
      url = `http://localhost:${api.config.servers.web.port}`

      // finish the server initialization
      done()
    })
  })

  after(done => {
    // finish the Stellar instance execution
    engine.stop(() => done())
  })

  it('server should be up and return data', done => {
    request.get(`${url}/api/`, (error, response, body) => {
      body = JSON.parse(body)
      body.should.be.an.instanceOf(Object)
      done()
    })
  })

  it('server basic response should be JSON and have basic data', done => {
    request.get(`${url}/api/`, (error, response, body) => {
      body = JSON.parse(body)
      body.should.be.an.instanceOf(Object)
      body.requesterInformation.should.be.an.instanceOf(Object)
      done()
    })
  })

  it('params work', done => {
    request(`${url}/api?key=value`, (error, response, body) => {
      body = JSON.parse(body)
      body.requesterInformation.receivedParams.key.should.equal('value')
      done()
    })
  })

  it('can not call private actions', done => {
    request(`${url}/api/sumANumber?a=3&b=4`, (error, response, body) => {
      body = JSON.parse(body)
      body.error.should.equal(api.config.errors.privateActionCalled('sumANumber'))
      done()
    })
  })

  it('can call actions who call private actions', done => {
    request(`${url}/api/formattedSum?a=3&b=4`, (error, response, body) => {
      body = JSON.parse(body)
      should.not.exist(body.error)
      body.formatted.should.equal('3 + 4 = 7')
      done()
    })
  })

  it('will generate an error call an action with an invalid type', done => {
    request(`${url}/api/formattedSum?a=3&b=thisIsInvalid`, (error, response, body) => {
      body = JSON.parse(body)
      body.error.should.equal(`param 'b' has an invalid type, expected integer`)
      done()
    })
  })

  describe('will properly destroy connections', function () {

    it('works for the API', done => {
      Object.keys(api.connections.connections).length.should.equal(0)

      request.get(`${url}/api/sleep`, () => {
        Object.keys(api.connections.connections).length.should.equal(0)
        setTimeout(done, 100)
      })

      setTimeout(() => {
        Object.keys(api.connections.connections).length.should.equal(1)
      }, 100)
    })

    // @todo - test for files

  })

  describe('errors', function () {

    before(done => {
      api.actions.versions.stringErrorTestAction = [ 1 ]
      api.actions.actions.stringErrorTestAction = {
        '1': {
          name: 'stringErrorTestAction',
          description: 'stringErrorTestAction',
          version: 1,
          run: function (api, data, next) {
            next('broken');
          }
        }
      }

      api.actions.versions.errorErrorTestAction = [ 1 ]
      api.actions.actions.errorErrorTestAction = {
        '1': {
          name: 'errorErrorTestAction',
          description: 'errorErrorTestAction',
          version: 1,
          run: function (api, data, next) {
            next(new Error('broken'));
          }
        }
      }

      api.actions.versions.complexErrorTestAction = [ 1 ]
      api.actions.actions.complexErrorTestAction = {
        '1': {
          name: 'complexErrorTestAction',
          description: 'complexErrorTestAction',
          version: 1,
          run: function (api, data, next) {
            next({error: 'broken', reason: 'stuff'});
          }
        }
      }

      api.routes.loadRoutes()
      done()
    })

    after(done => {
      delete api.actions.actions.stringErrorTestAction
      delete api.actions.versions.stringErrorTestAction
      delete api.actions.actions.errorErrorTestAction
      delete api.actions.versions.errorErrorTestAction
      delete api.actions.actions.complexErrorTestAction
      delete api.actions.versions.complexErrorTestAction
      done()
    })

    it('errors can be error strings', done => {
      request.get(`${url}/api/stringErrorTestAction`, (error, response, body) => {
        body = JSON.parse(body)
        body.error.should.equal('broken')
        done()
      })
    })

    it('errors can be objects and returned plainly', done => {
      request.get(`${url}/api/errorErrorTestAction`, (error, response, body) => {
        body = JSON.parse(body)
        body.error.should.equal('broken')
        done()
      })
    })

    it('errors can be complex JSON payloads', done => {
      request.get(`${url}/api/complexErrorTestAction`, (error, response, body) => {
        body = JSON.parse(body)
        body.error.error.should.equal('broken')
        body.error.reason.should.equal('stuff')
        done()
      })
    })
  })

  it('not existing actions have the right response', done => {
    request.get(`${url}/api/someNotExistingAction`, (error, response, body) => {
      body = JSON.parse(body)
      body.error.should.equal('unknown action or invalid apiVersion')
      done()
    })
  })

  it('real actions do not have an error response', done => {
    request.get(`${url}/api/status`, (error, response, body) => {
      body = JSON.parse(body)
      should.not.exist(body.error)
      done()
    })
  })

  it('HTTP Verbs should work: GET', done => {
    request.get(`${url}/api/randomNumber`, (error, response, body) => {
      body = JSON.parse(body)
      body.number.should.be.within(0, 10)
      done()
    })
  })

  it('HTTP Verbs should work: POST', done => {
    request.post(`${url}/api/randomNumber`, (error, response, body) => {
      body = JSON.parse(body)
      body.number.should.be.within(0, 10)
      done()
    })
  })

  it('HTTP Verbs should work: PUT', done => {
    request.put(`${url}/api/randomNumber`, (error, response, body) => {
      body = JSON.parse(body)
      body.number.should.be.within(0, 10)
      done()
    })
  })

  it('HTTP Verbs should work: DELETE', done => {
    request.del(`${url}/api/randomNumber`, (error, response, body) => {
      body = JSON.parse(body)
      body.number.should.be.within(0, 10)
      done()
    })
  })

  it('HTTP Verbs should work: POST with Form', done => {
    request.post(`${url}/api/cacheTest`, {form: {key: 'key', value: 'value'}}, (error, response, body) => {
      body = JSON.parse(body)
      body.cacheTestResults.saveResp.should.eql(true)
      done()
    })
  })

  it('HTTP Verbs should work: POST with JSON Payload as body', done => {
    // build the body
    let body = JSON.stringify({key: 'key', value: 'value'})

    request.post(`${url}/api/cacheTest`, {
      body: body,
      headers: {'Content-type': 'application/json'}
    }, (error, response, body) => {
      body = JSON.parse(body)
      body.cacheTestResults.saveResp.should.eql(true)
      done()
    })
  })

  describe('connection.rawConnection.params', function () {

    before(done => {
      api.actions.versions.paramTestAction = [ 1 ]
      api.actions.actions.paramTestAction = {
        '1': {
          name: 'paramTestAction',
          description: 'Returns connection.rawConnection.params',
          version: 1,
          run: (api, action, next) => {
            action.response = action.connection.rawConnection.params
            next()
          }
        }
      }

      api.routes.loadRoutes()
      done()
    })

    after(done => {
      delete api.actions.actions.paramTestAction
      delete api.actions.versions.paramTestAction
      done()
    })

    it('.query should contain unfiltered query params', done => {
      request.get(`${url}/api/paramTestAction?awesomeParam=something`, (error, response, body) => {
        body = JSON.parse(body)
        body.query.awesomeParam.should.equal('something')
        done()
      })
    })

    it('.body should contain unfiltered request body params', done => {
      // build body
      let requestBody = JSON.stringify({key: 'value'})

      request.post(`${url}/api/paramTestAction`, {
        body: requestBody,
        headers: {'Content-type': 'application/json'}
      }, (error, response, body) => {
        body = JSON.parse(body)
        body.body.key.should.eql('value')
        done()
      })
    })
  })

  it('returnErrorCodes false should still have a status of 200', done => {
    // disable HTTP status (always 200)
    api.config.servers.web.returnErrorCodes = false

    request.del(`${url}/api`, (error, response) => {
      response.statusCode.should.eql(200)
      done()
    })
  })

  it('returnErrorCodes can be opted to change HTTP header codes', done => {
    // enable HTTP status codes
    api.config.servers.web.returnErrorCodes = true

    request.del(`${url}/api`, (error, response) => {
      response.statusCode.should.eql(404)
      done()
    })
  })

  describe('HTTP header', function () {

    before(done => {
      // enable HTTP status codes
      api.config.servers.web.returnErrorCodes = true

      // add a test action
      api.actions.versions.headerTestAction = [ 1 ]
      api.actions.actions.headerTestAction = {
        '1': {
          name: 'headerTestAction',
          description: 'Test action',
          version: 1,
          run: (api, action, next) => {
            action.connection.rawConnection.responseHeaders.push([ 'thing', 'A' ])
            action.connection.rawConnection.responseHeaders.push([ 'thing', 'B' ])
            action.connection.rawConnection.responseHeaders.push([ 'thing', 'C' ])
            action.connection.rawConnection.responseHeaders.push([ 'Set-Cookie', 'value_1=1' ])
            action.connection.rawConnection.responseHeaders.push([ 'Set-Cookie', 'value_2=2' ])
            next()
          }
        }
      }

      api.routes.loadRoutes()
      done()
    })

    after(done => {
      delete api.actions.versions.headerTestAction
      delete api.actions.actions.headerTestAction
      done()
    })

    it('duplicated headers should be removed (in favor of the last set)', done => {
      request.get(`${url}/api/headerTestAction`, (error, response, body) => {
        response.statusCode.should.eql(200)
        response.headers.thing.should.eql('C')
        done()
      })
    })

    it('should respond to OPTIONS with only HTTP headers', done => {
      request({method: 'options', url: `${url}/api/cacheTest`}, (error, response) => {
        response.statusCode.should.eql(200)
        response.headers[ 'access-control-allow-methods' ].should.equal('HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, TRACE')
        response.headers[ 'access-control-allow-origin' ].should.equal('*')
        response.headers[ 'content-length' ].should.equal('0')
        done()
      })
    })

    it('should respond to TRACE with parsed params received', done => {
      request({
        method: 'trace',
        url: `${url}/api/x`,
        form: {key: 'someKey', value: 'someValue'}
      }, (error, response, body) => {
        body = JSON.parse(body)
        response.statusCode.should.eql(200)
        body.receivedParams.key.should.equal('someKey')
        body.receivedParams.value.should.equal('someValue')
        done()
      })
    })

    it('should respond to HEAD request s just like GET, but with no body', done => {
      request({method: 'head', url: `${url}/api/headerTestAction`}, (error, response, body) => {
        response.statusCode.should.eql(200)
        body.should.equal('')
        done()
      })
    })

    it('keeps sessions with browser_fingerprint', done => {
      let j = request.jar()

      request.post({url: url + '/api', jar: j}, (error, response1, body1) => {
        request.get({url: url + '/api', jar: j}, (error, response2, body2) => {
          request.put({url: url + '/api', jar: j}, (error, response3, body3) => {
            request.del({url: url + '/api', jar: j}, (error, response4, body4) => {
              body1 = JSON.parse(body1)
              body2 = JSON.parse(body2)
              body3 = JSON.parse(body3)
              body4 = JSON.parse(body4)

              response1.headers[ 'set-cookie' ].should.exist
              should.not.exist(response2.headers[ 'set-cookie' ])
              should.not.exist(response3.headers[ 'set-cookie' ])
              should.not.exist(response4.headers[ 'set-cookie' ])

              var fingerprint1 = body1.requesterInformation.id.split('-')[ 0 ]
              var fingerprint2 = body2.requesterInformation.id.split('-')[ 0 ]
              var fingerprint3 = body3.requesterInformation.id.split('-')[ 0 ]
              var fingerprint4 = body4.requesterInformation.id.split('-')[ 0 ]

              fingerprint1.should.equal(fingerprint2)
              fingerprint1.should.equal(fingerprint3)
              fingerprint1.should.equal(fingerprint4)

              fingerprint1.should.equal(body1.requesterInformation.fingerprint)
              fingerprint2.should.equal(body2.requesterInformation.fingerprint)
              fingerprint3.should.equal(body3.requesterInformation.fingerprint)
              fingerprint4.should.equal(body4.requesterInformation.fingerprint)
              done()
            })
          })
        })
      })
    })
  })

  describe('HTTP returnErrorCode true', function () {

    before(done => {
      // enable the HTTP status codes
      api.config.servers.web.returnErrorCodes = true

      api.actions.versions.statusTestAction = [ 1 ]
      api.actions.actions.statusTestAction = {
        '1': {
          name: 'statusTestAction',
          description: 'A test action',
          inputs: {
            key: {required: true}
          },
          run: (api, action, next) => {
            let error

            if (data.params.key !== 'value') {
              error = 'keu != value'
              data.connection.rawConnection.responseHttpCode = 402
            } else {
              data.response.good = true
            }

            next(error)
          }
        }
      }
    })

  })
})
