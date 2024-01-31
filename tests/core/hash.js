'use strict'

let should = require('should')
let EngineClass = require(__dirname + '/../../dist/engine').default
let engine = new EngineClass({ rootPath: process.cwd() + '/example' })

let api = null

const SALT = '$2a$10$8Ux95eQglaUMSn75J7MAXO'
const TEST_PASSWORD = 'MY_GREAT_PASSWORD'
const TEST_PASSWORD_HASHED = '$2a$10$8Ux95eQglaUMSn75J7MAXOrHISe8xlR596kiYoVs2shRznjzD5CGC'

describe('Core: Hash', function () {

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

  /**
   * After each test reset the hash configs
   */
  afterEach(done => {
    api.config.general.salt = null
    api.config.general.saltLength = 10
    api.config.general.saltRounds = 10
    done()
  })

  it('is part of the API', done => {
    should.exist(api.hash)
    api.hash.should.have.property('hash').which.is.a.Function()
    api.hash.should.have.property('hashSync').which.is.a.Function()
    api.hash.should.have.property('compare').which.is.a.Function()
    api.hash.should.have.property('compareSync').which.is.a.Function()
    done()
  })

  it('generate salt', done => {
    api.hash.generateSalt().then(salt => {
      salt.should.be.String()
      done()
    })
  })

  it('generate salt in sync mode', done => {
    api.hash.generateSaltSync().should.be.String()
    done()
  })

  it('hash data without options', done => {
    api.hash.hash(TEST_PASSWORD).then(result => {
      result.should.be.String()
      done()
    })
  })

  it('hash data with predefined salt', done => {
    api.config.general.salt = SALT
    api.hash.hash(TEST_PASSWORD).then(result => {
      result.should.be.equal(TEST_PASSWORD_HASHED)
      done()
    })
  })

  it('hash data with predefined salt length', done => {
    api.config.general.saltLength = 8
    api.hash.hashSync(TEST_PASSWORD).should.be.String()
    done()
  })

  it('hash data with auto-generated salt', done => {
    let salt = api.hash.generateSaltSync(5)
    api.hash.hashSync(TEST_PASSWORD, { salt: salt }).should.be.String()
    done()
  })

  it('throw exception on hash with wrong salt', done => {
    api.config.general.salt = 'invalid_salt'

    api.hash.hash('some_data').catch(error => {
      error.should.be.instanceOf(Error)
      done()
    })
  })

  it('hash data in sync', done => {
    api.config.general.salt = SALT

    api.hash.hashSync(TEST_PASSWORD).should.be.equal(TEST_PASSWORD_HASHED)
    done()
  })

  it('compare plain data with hash', done => {
    api.hash.compare(TEST_PASSWORD, TEST_PASSWORD_HASHED).then(result => {
      should(result).be.true()
      done()
    })
  })

  it('compare plain data with hash in sync', done => {
    should(api.hash.compareSync(TEST_PASSWORD, TEST_PASSWORD_HASHED)).be.true()
    should(api.hash.compareSync('wrong_password', TEST_PASSWORD_HASHED)).be.false()
    done()
  })
})
