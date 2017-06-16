'use strict'

const should = require('should')
const EngineClass = require(__dirname + '/../../dist/engine').default
const engine = new EngineClass({rootPath: process.cwd() + '/example'})

const async = require('async')

let api = null

describe('Core: Cache', () => {
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

  it('cache methods should exist', (done) => {
    api.cache.should.be.an.instanceOf(Object)
    api.cache.save.should.be.an.instanceOf(Function)
    api.cache.load.should.be.an.instanceOf(Function)
    api.cache.destroy.should.be.an.instanceOf(Function)
    done()
  })

  it('cache.save', async () => api.cache.save('testKey', 'test123', null).should.be.fulfilledWith(true))

  it('cache.load', async () => {
    const res = await api.cache.load('testKey')
    res.value.should.be.equal('test123')
  })

  it('cache.load failure', async () => api.cache.load('thisNotExists').should.be.rejectedWith('Object not found'))

  it('cache.destroy', async () => api.cache.destroy('testKey').should.be.fulfilledWith(true))

  it('cache.destroy failure', async () => await api.cache.destroy('testKey').should.be.fulfilledWith(false))

  it('cache.save with expire time', async () => api.cache.save('testKey', 'test123', 10).should.be.fulfilledWith(true))

  it('cache.load with expired items should not return them', async () => {
    const saveRes = await api.cache.save('testKeyWait', 'test123', 10)
    saveRes.should.equal(true)

    await api.utils.delay(20)
    return api.cache.load('testKeyWait').should.be.rejectedWith('Object expired')
  })

  it('cache.load with negative expire times will never load', async () => {
    await api.cache.save('testKeyInThePast', 'test123', -1).should.be.fulfilledWith(true)
    return api.cache.load('testKeyInThePast').should.be.rejectedWith('Object expired')
  })

  it('cache.save does not need to pass expireTime', async () => {
    await api.cache.save('testKeyForNullExpireTime', 'test123').should.be.fulfilledWith(true)

    const { value } = await api.cache.load('testKeyForNullExpireTime')
    value.should.be.equal('test123')
  })

  it('cache.load without changing the expireTime will re-apply the redis expire', async () => {
    const key = 'testKey'

    await api.cache.save(key, 'val', 1000).should.be.fulfilled()
    const { value } = await api.cache.load(key)
    value.should.be.equal('val')

    await api.utils.delay(1001)
    return api.cache.load(key).should.be.rejectedWith('Object not found')
  })

  it('cache.load with options that extending expireTime should return cached item', async () => {
    const timeout = 200
    const expireTime = 400
    const value = 'test123'
    const key = 'testKeyWait'

    // save the initial key
    await api.cache.save(key, value, expireTime).should.be.fulfilledWith(true)

    // wait for `timeout` and try to load the key with a extended expireTime
    await api.utils.delay(timeout)
    const { value: valueToTest } = await api.cache.load(key, {expireTimeMS: expireTime})
    valueToTest.should.be.equal(value)

    // wait another `timeout` and load the key again without an extended expire time
    await api.utils.delay(timeout)
    const { value: valueToTest2 } = await api.cache.load(key)
    valueToTest.should.be.equal(valueToTest2)

    // wait another `timeout` and the key load should fail without the extended time
    await api.utils.delay(timeout)
    return api.cache.load(key).should.be.rejectedWith('Object not found')
  })

  it('cache.save works with arrays', async () => {
    await api.cache.save('arrayKey', [ 1, 2, 3 ]).should.be.fulfilledWith(true)

    const { value: loadRes } = await api.cache.load('arrayKey')

    loadRes[ 0 ].should.equal(1)
    loadRes[ 1 ].should.equal(2)
    loadRes[ 2 ].should.equal(3)
  })

  it('cache.save works with objects', async () => {
    const key = 'objectKey'
    const data = {
      oneThing: 'someData',
      otherThing: [ 1, 2, 3 ]
    }

    await api.cache.save(key, data).should.be.fulfilledWith(true)

    const { value: loadRes } = await api.cache.load(key)
    loadRes.oneThing.should.equal(data.oneThing)
    loadRes.otherThing[ 0 ].should.equal(data.otherThing[ 0 ])
    loadRes.otherThing[ 1 ].should.equal(data.otherThing[ 1 ])
    loadRes.otherThing[ 2 ].should.equal(data.otherThing[ 2 ])
  })

  it('can clear the cache entirely', async () => {
    await api.cache.save('cacheClearKey', 123)

    const count = await api.cache.size();
    (count > 0).should.equal(true)

    await api.cache.clear()
    return api.cache.size().should.be.fulfilledWith(0)
  })

  describe('lists', () => {
    it('can push and pop from an array', async () => {
      let jobs = []

      jobs.push(api.cache.push('testListKey', 'a string'))
      jobs.push(api.cache.push('testListKey', [ 'an array' ]))
      jobs.push(api.cache.push('testListKey', { look: 'an object' }))

      // process the operations in parallel
      await Promise.all(jobs).should.be.fulfilled()

      jobs = []

      jobs.push(api.cache.pop('testListKey').should.be.fulfilledWith('a string'))
      jobs.push(api.cache.pop('testListKey').should.be.fulfilledWith([ 'an array' ]))
      jobs.push(api.cache.pop('testListKey').should.be.fulfilledWith({ look: 'an object' }))

      // process all the tests in series
      return Promise.all(jobs).should.be.fulfilled()
    })

    it('will return null if the list is empty', async () => api.cache.pop('emptyListKey').should.be.fulfilledWith(null))

    it('can get the length of an array when full', async () => {
      await api.cache.push('testListKeyTwo', 'a string').should.be.fulfilled()
      return api.cache.listLength('testListKeyTwo').should.be.fulfilledWith(1)
    })

    it('will return 0 length when the key does not exist', async () => api.cache.listLength('testListKeyNotExists').should.be.fulfilledWith(0))
  })

  describe('locks', function () {
    const key = 'testKey'

    // reset the lockName and unlock the key after each test
    afterEach(() => {
      api.cache.lockName = api.id
      return api.cache.unlock(key)
    })

    it('thing can be locked checked and unlocked', async () => {
      // lock a key
      await api.cache.lock(key, 100).should.be.fulfilledWith(true)

      // check the lock
      await api.cache.checkLock(key, null).should.be.fulfilledWith(true)

      // lock the key
      return api.cache.unlock(key).should.be.fulfilledWith(true)
    })

    it('locks have a TTL and the default will be assumed from config', async () => {
      // lock key
      await api.cache.lock(key, null).should.be.fulfilledWith(true)

      // check the lock TTL (Time To Live)
      const ttl = await api.redis.clients.client.ttl(api.cache.lockPrefix + key);
      (ttl <= 10).should.be.equal(true)
    })

    it('you can save an item if you do hold the lock', async () => {
      await api.cache.lock(key, null).should.be.fulfilledWith(true)
      return api.cache.save(key, 'value').should.be.fulfilledWith(true)
    })

    it('you cannot save a locked item if you do not hold the lock', async () => {
      await api.cache.lock(key, null).should.be.fulfilledWith(true)

      // change the lock name
      api.cache.lockName = 'otherId'

      return api.cache.save(key, 'someValue').should.be.rejectedWith('Object locked')
    })

    it('you cannot destroy a locked item if you do not hold the lock', async () => {
      await api.cache.lock(key, null).should.be.fulfilledWith(true)

      // change the lock name
      api.cache.lockName = 'otherId'

      return api.cache.destroy(key).should.be.rejectedWith('Object locked')
    })
  })
})
