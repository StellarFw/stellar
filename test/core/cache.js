'use strict'

let should = require('should')
let EngineClass = require(__dirname + '/../../dist/engine').default
let engine = new EngineClass({rootPath: process.cwd() + '/example'})

let async = require('async')

let api = null

describe('Core: Cache', function () {

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

  it('cache methods should exist', function (done) {
    api.cache.should.be.an.instanceOf(Object)
    api.cache.save.should.be.an.instanceOf(Function)
    api.cache.load.should.be.an.instanceOf(Function)
    api.cache.destroy.should.be.an.instanceOf(Function)
    done()
  })

  it('cache.save', function (done) {
    api.cache.save('testKey', 'test123', null, (error, res) => {
      should.not.exist(error)
      res.should.equal(true)
      done()
    })
  })

  it('cache.load', function (done) {
    api.cache.load('testKey', (error, res) => {
      res.should.equal('test123')
      done()
    })
  })

  it('cache.load failure', function (done) {
    api.cache.load('thisNotExists', (error, res) => {
      String(error).should.equal('Error: Object not found')
      should.equal(null, res)
      done()
    })
  })

  it('cache.destroy', function (done) {
    api.cache.destroy('testKey', (err, res) => {
      res.should.equal(true)
      done()
    })
  })

  it('cache.destroy failure', function (done) {
    api.cache.destroy('testKey', (err, res) => {
      res.should.equal(false)
      done()
    })
  })

  it('cache.save with expire time', function (done) {
    api.cache.save('testKey', 'test123', 10, (error, res) => {
      res.should.equal(true)
      done()
    })
  })

  it('cache.load with expired items should not return them', function (done) {
    api.cache.save('testKeyWait', 'test123', 10, (error, saveRes) => {
      saveRes.should.equal(true)

      setTimeout(() => {
        api.cache.load('testKeyWait', (error, loadRes) => {
          String(error).should.equal('Error: Object expired')
          should.equal(null, loadRes)
          done()
        })
      }, 20)
    })
  })

  it('cache.load with negative expire times will never load', function (done) {
    api.cache.save('testKeyInThePast', 'test123', -1, (error, saveRes) => {
      saveRes.should.equal(true)

      api.cache.load('testKeyInThePast', (error, loadRes) => {
        (String(error).indexOf('Error: Object') >= 0).should.equal(true)
        should.equal(null, loadRes)
        done()
      })
    })
  })

  it('cache.save does not need to pass expireTime', function (done) {
    api.cache.save('testKeyForNullExpireTime', 'test123', (error, saveRes) => {
      saveRes.should.equal(true)

      api.cache.load('testKeyForNullExpireTime', (error, loadRes) => {
        loadRes.should.equal('test123')
        done()
      })
    })
  })

  it('cache.load without changing the expireTime will re-apply the redis expire', function (done) {
    let key = 'testKey'

    api.cache.save(key, 'val', 1000, () => {
      api.cache.load(key, (error, loadRes) => {
        loadRes.should.equal('val')

        setTimeout(() => {
          api.cache.load(key, (error, loadRes) => {
            String(error).should.equal('Error: Object not found')
            should.equal(null, loadRes)
            done()
          })
        }, 1001)
      })
    })
  })

  it('cache.load with options that extending expireTime should return cached item', function (done) {
    let timeout = 200
    let expireTime = 400
    let value = 'test123'
    let key = 'testKeyWait'

    // save the initial key
    api.cache.save(key, value, expireTime, (error, saveRes) => {
      saveRes.should.equal(true)

      // wait for `timeout` and try to load the key with a extended expireTime
      setTimeout(() => {
        api.cache.load(key, {expireTimeMS: expireTime}, (error, loadRes) => {
          loadRes.should.equal(value)

          // wait another `timeout` and load the key again without an extended expire time
          setTimeout(() => {
            api.cache.load(key, (error, loadRes) => {
              loadRes.should.equal(value)

              // wait another `timeout` and the key load should fail without the extended time
              setTimeout(() => {
                api.cache.load(key, (error, loadRes) => {
                  String(error).should.equal('Error: Object not found')
                  should.equal(null, loadRes)
                  done()
                })
              }, timeout)
            })
          }, timeout)
        })
      }, timeout)
    })
  })

  it('cache.save works with arrays', function (done) {
    api.cache.save('arrayKey', [ 1, 2, 3 ], (error, saveRes) => {
      saveRes.should.be.equal(true)

      api.cache.load('arrayKey', (error, loadRes) => {
        loadRes[ 0 ].should.equal(1)
        loadRes[ 1 ].should.equal(2)
        loadRes[ 2 ].should.equal(3)

        done()
      })
    })
  })

  it('cache.save works with objects', function (done) {
    let key = 'objectKey'
    let data = {
      oneThing: 'someData',
      otherThing: [ 1, 2, 3 ]
    }

    api.cache.save(key, data, (error, saveRes) => {
      saveRes.should.equal(true)

      api.cache.load(key, (error, loadRes) => {
        loadRes.oneThing.should.equal(data.oneThing)
        loadRes.otherThing[ 0 ].should.equal(data.otherThing[ 0 ])
        loadRes.otherThing[ 1 ].should.equal(data.otherThing[ 1 ])
        loadRes.otherThing[ 2 ].should.equal(data.otherThing[ 2 ])
        done()
      })
    })
  })

  it('can clear the cache entirely', function (done) {
    api.cache.save('cacheClearKey', 123, () => {
      api.cache.size((error, count) => {
        (count > 0).should.equal(true)

        api.cache.clear(() => {
          api.cache.size((error, count) => {
            count.should.equal(0)
            done()
          })
        })
      })
    })
  })

  describe('lists', function () {
    it('can push and pop from an array', function (done) {
      let jobs = []

      jobs.push(next => api.cache.push('testListKey', 'a string', next))
      jobs.push(next => api.cache.push('testListKey', [ 'an array' ], next))
      jobs.push(next => api.cache.push('testListKey', {look: 'an object'}, next))

      // process the operations in parallel
      async.parallel(jobs, error => {
        should.not.exist(error)

        jobs = []

        jobs.push(next => {
          api.cache.pop('testListKey', (error, data) => {
            data.should.equal('a string')
            next()
          })

        })

        jobs.push(next => {
          api.cache.pop('testListKey', (error, data) => {
            data.should.deepEqual([ 'an array' ])
            next()
          })
        })

        jobs.push(next => {
          api.cache.pop('testListKey', (error, data) => {
            data.should.deepEqual({look: 'an object'})
            next()
          })
        })

        // process all the tests in series
        async.series(jobs, error => {
          should.not.exist(error)
          done()
        })
      })
    })

    it('will return null if the list is empty', function (done) {
      api.cache.pop('emptyListKey', (error, data) => {
        should.not.exist(error)
        should.not.exist(data)
        done()
      })
    })

    it('can get the length of an array when full', function (done) {
      api.cache.push('testListKeyTwo', 'a string', () => {
        api.cache.listLength('testListKeyTwo', (error, size) => {
          should.not.exist(error)
          size.should.equal(1)
          done()
        })
      })
    })

    it('will return 0 length when the key does not exist', function (done) {
      api.cache.listLength('testListKeyNotExists', (error, size) => {
        should.not.exist(error)
        size.should.equal(0)
        done()
      })
    })
  })

  describe('locks', function () {
    let key = 'testKey'

    // reset the lockName and unlock the key after each test
    afterEach(done => {
      api.cache.lockName = api.id
      api.cache.unlock(key, done())
    })

    it('thing can be locked checked and unlocked', function (done) {
      // lock a key
      api.cache.lock(key, 100, (error, lock) => {
        should.not.exist(error)
        lock.should.equal(true)

        // check the lock
        api.cache.checkLock(key, (error, lock) => {
          should.not.exist(error)
          lock.should.equal(true)

          // lock the key
          api.cache.unlock(key, (error, unlock) => {
            should.not.exist(error)
            unlock.should.equal(true)

            done()
          })
        })
      })
    })

    it('locks have a TTL and the default will be assumed from config', function (done) {
      // lock key
      api.cache.lock(key, null, (error, lock) => {
        lock.should.equal(true)

        // check the lock TTL (Time To Live)
        api.redis.client.ttl(api.cache.lockPrefix + key, (error, ttl) => {
          (ttl >= 9).should.equal(true)
          (ttl <= 10).should.equal(true)
          done()
        })
      })
    })

    it('you can save an item if you do hold the lock', function (done) {
      api.cache.lock(key, null, (error, lock) => {
        lock.should.equal(true)

        api.cache.save(key, 'value', (error, success) => {
          success.should.equal(true)
          done()
        })
      })
    })

    it('you cannot save a locked item if you do not hold the lock', function (done) {
      api.cache.lock(key, null, (error, lock) => {
        lock.should.equal(true)

        // change the lock name
        api.cache.lockName = 'otherId'

        api.cache.save(key, 'someValue', error => {
          String(error).should.equal('Error: Object locked')
          done()
        })
      })
    })

    it('you cannot destroy a locked item if you do not hold the lock', function (done) {
      api.cache.lock(key, null, (error, lock) => {
        lock.should.equal(true)

        // change the lock name
        api.cache.lockName = 'otherId'

        api.cache.destroy(key, 'someValue', error => {
          String(error).should.equal('Error: Object locked')
          done()
        })
      })
    })
  })
})
