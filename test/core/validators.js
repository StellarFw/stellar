'use strict'

let should = require('should')

let EngineClass = require(__dirname + '/../../dist/engine').default
let engine = new EngineClass({ rootPath: process.cwd() + '/example' })

let async = require('async')

let api = null

let simplesValidator = (name, value) => api.validator.validate(name, { key: value }, 'key', value)

let dontMatch = `don't match with the validator`

describe('Core: Validators', function () {

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

  it('alpha', done => {
    should(simplesValidator('alpha', 'alpha')).be.equal(true)

    should(simplesValidator('alpha', 'alpha123')).not.be.equal(true)
    done()
  })

  it('alpha_num', done => {
    should(simplesValidator('alpha_num', 'alpha')).be.equal(true)
    should(simplesValidator('alpha_num', 'alpha123')).be.equal(true)

    should(simplesValidator('alpha_num', 'alpha %')).not.be.equal(true)
    done()
  })

  it('alpha_dash', done => {
    should(simplesValidator('alpha_dash', 'alpha')).be.equal(true)
    should(simplesValidator('alpha_dash', 'alpha123')).be.equal(true)
    should(simplesValidator('alpha_dash', 'al-ph_a')).be.equal(true)

    should(simplesValidator('alpha_dash', 'alpha12-3_ ')).not.be.equal(true)
    done()
  })

  it('array', done => {
    should(simplesValidator('array', [ 1, 2, 3 ])).be.equal(true)

    should(simplesValidator('array', { a: 1, b: 2 })).not.be.equal(true)
    should(simplesValidator('array', 'asd')).not.be.equal(true)
    done()
  })

  it('before', done => {
    should(simplesValidator('before', '')).be.equal('you need to specify an argument')
    should(simplesValidator('before:2016--28', '')).be.equal('the specified argument is not a valid date')
    should(simplesValidator('before:2016-05-28', 'asd')).be.equal('the specified value is not a valid date')
    should(simplesValidator('before:2016-05-28', '2016-05-12')).be.equal(true)
    should(simplesValidator('before:2016-05-28', '2016-07-18')).be.equal(dontMatch)
    done()
  })

  it('between', done => {
    should(simplesValidator('between', '')).be.equal('invalid validator arguments')
    should(simplesValidator('between:20,50', 'asd')).be.equal(dontMatch)
    should(simplesValidator('between:1,3', '23')).be.equal(true)
    should(simplesValidator('between:5,50', 200)).be.equal(dontMatch)
    should(simplesValidator('between:0,10', 6)).be.equal(true)
    should(simplesValidator('between:0,20', [ 1, 2, 4 ])).be.equal('invalid data type')
    done()
  })

  it('boolean', done => {
    should(simplesValidator('boolean', true)).be.equal(true)
    should(simplesValidator('boolean', false)).be.equal(true)
    should(simplesValidator('boolean', 'asd')).be.equal(dontMatch)
    should(simplesValidator('boolean', 123)).be.equal(dontMatch)
    should(simplesValidator('boolean', [ 1, 2 ])).be.equal(dontMatch)
    should(simplesValidator('boolean', { key: 'value' })).be.equal(dontMatch)
    done()
  })

  it('confirmed', done => {
    should(api.validator.validate('confirmed', {
      'key': 'value',
      'key_confirmation': 'value'
    }, 'key', 'value')).be.equal(true)
    should(api.validator.validate('confirmed', { 'key': 'value' }, 'key', 'value')).be.equal('the confirmation field are not present')
    should(api.validator.validate('confirmed', {
      'key': 'value',
      'key_confirmation': 'different_value'
    }, 'key', 'value')).be.equal('the values not match')
    done()
  })

  it('date', done => {
    should(simplesValidator('date', '')).be.equal('the specified value is not a valid date')
    should(simplesValidator('date', '2016-05-28')).be.equal(true)
    done()
  })

  it('different', done => {
    should(api.validator.validate('different', {
      'key': 'value',
      'key2': 'value2'
    }, 'key', '')).be.equal('the validator need one argument')
    should(api.validator.validate('different:key2', {
      'key': 'value',
      'key2': 'value2'
    }, 'key', 'value2')).be.equal(dontMatch)
    should(api.validator.validate('different:key2', {
      'key': 'value',
      'key2': 'value2'
    }, 'key', 'value')).be.equal(true)
    done()
  })

  it('email', done => {
    should(simplesValidator('email', '')).be.equal(dontMatch)
    should(simplesValidator('email', 'user')).be.equal(dontMatch)
    should(simplesValidator('email', 'example.com')).be.equal(dontMatch)
    should(simplesValidator('email', 'user@example')).be.equal(dontMatch)
    should(simplesValidator('email', 'user@example.com')).be.equal(true)
    should(simplesValidator('email', 'user.surname@example.com')).be.equal(true)
    done()
  })

  it('filled', done => {
    should(simplesValidator('filled', null)).be.equal(dontMatch)
    should(simplesValidator('filled', '')).be.equal(dontMatch)
    should(simplesValidator('filled', 'value')).be.equal(true)
    done()
  })

  it('in', done => {
    should(simplesValidator('in', '1')).be.equal('validator needs an array')
    should(simplesValidator('in:1,2,3', '1')).be.equal(true)
    should(simplesValidator('in:1,2,3', '7')).be.equal(dontMatch)
    done()
  })

  it('not_in', done => {
    should(simplesValidator('not_in', '1')).be.equal('validator needs an array')
    should(simplesValidator('not_in:1,2,3', '1')).be.equal(dontMatch)
    should(simplesValidator('not_in:1,2,3', '7')).be.equal(true)
    done()
  })

  it('integer', done => {
    should(simplesValidator('integer', 'asd')).be.equal(dontMatch)
    should(simplesValidator('integer', '123')).be.equal(true)
    should(simplesValidator('integer', 123)).be.equal(true)
    done()
  })

  it('ip', done => {
    should(simplesValidator('ip', '127.0.0.1')).be.equal(true)
    should(simplesValidator('ip', '')).be.equal(dontMatch)
    done()
  })

  it('json', done => {
    should(simplesValidator('json', '')).be.equal(dontMatch)
    should(simplesValidator('json', 'string')).be.equal(dontMatch)
    should(simplesValidator('json', '123')).be.equal(dontMatch)
    should(simplesValidator('json', 123)).be.equal(dontMatch)
    should(simplesValidator('json', JSON.stringify({ key: 'test', value: 123 }))).be.equal(true)
    done()
  })

  it('max', done => {
    should(simplesValidator('max', '')).be.equal('validator need at least one argument')
    should(simplesValidator('max:2', null)).be.equal('invalid type')
    should(simplesValidator('max:10', 9)).be.equal(true)
    should(simplesValidator('max:10', 10)).be.equal(true)
    should(simplesValidator('max:10', 11)).be.equal(dontMatch)
    should(simplesValidator('max:3', 'as')).be.equal(true)
    should(simplesValidator('max:3', 'asd')).be.equal(true)
    should(simplesValidator('max:3', 'asdf')).be.equal(dontMatch)
    done()
  })

  it('min', done => {
    should(simplesValidator('min', '')).be.equal('validator need at least one argument')
    should(simplesValidator('min:3', null)).be.equal('invalid type')
    should(simplesValidator('min:3', 2)).be.equal(dontMatch)
    should(simplesValidator('min:3', 3)).be.equal(true)
    should(simplesValidator('min:3', 4)).be.equal(true)
    should(simplesValidator('min:3', 'as')).be.equal(dontMatch)
    should(simplesValidator('min:3', 'asd')).be.equal(true)
    should(simplesValidator('min:3', 'asdf')).be.equal(true)
    done()
  })

  it('required', done => {
    should(api.validator.validate('required', {}, 'key', undefined)).be.equal(dontMatch)
    should(simplesValidator('required', 'someValue')).be.equal(true)
    done()
  })

  it('numeric', done => {
    should(simplesValidator('numeric', 'asd')).be.equal(dontMatch)
    should(simplesValidator('numeric', 123)).be.equal(true)
    should(simplesValidator('numeric', 123.123)).be.equal(true)
    done()
  })

  it('required_if', done => {
    should(api.validator.validate('required_if', {
      key: 'v1',
      key2: 'v2'
    }, 'key', 'v1')).be.equal('validator need two arguments')
    should(api.validator.validate('required_if:key2,v,v1,v2', { key2: 'b' }, 'key', '')).be.equal(true)
    should(api.validator.validate('required_if:key2,v,v1,v2', { key2: 'v1' }, 'key', '')).be.equal(dontMatch)
    should(api.validator.validate('required_if:key2,v1', { key: 'v1', key2: 'v2' }, 'key', 'v1')).be.equal(true)
    done()
  })

  it('required_unless', done => {
    should(api.validator.validate('required_unless', {}, '', '')).be.equal('validator need two arguments')
    should(api.validator.validate('required_unless:key2,val1,val2', { key: '' }, 'key', '')).be.equal(dontMatch)
    should(api.validator.validate('required_unless:key2,val1,val2', {
      key: '',
      key2: 'otherValue'
    }, 'key', '')).be.equal(dontMatch)
    should(api.validator.validate('required_unless:key2,val1,val2', { key: 'notEmpty' }, 'key', 'notEmpty')).be.equal(true)
    should(api.validator.validate('required_unless:key2,val1,val2', {
      key: '',
      key2: 'val1'
    }, 'key', 'notEmpty')).be.equal(true)
    done()
  })

  it('required_with', done => {
    should(api.validator.validate('required_with', {}, '', '')).be.equal('validator need two arguments')
    should(api.validator.validate('required_with:name,surname', { key: '' }, 'key', '')).be.equal(true)
    should(api.validator.validate('required_with:name,surname', {
      key: '',
      name: 'Alec'
    }, 'key', '')).be.equal(dontMatch)
    should(api.validator.validate('required_with:name,surname', {
      key: 'someValue',
      name: 'Alec'
    }, 'key', 'someValue')).be.equal(true)
    done()
  })

  it('required_with_all', done => {
    should(api.validator.validate('required_with_all', {}, '', '')).be.equal('validator need two arguments')
    should(api.validator.validate('required_with_all:name,surname', { key: '' }, 'key', '')).be.equal(true)
    should(api.validator.validate('required_with_all:name,surname', {
      key: '',
      name: 'Alec'
    }, 'key', '')).be.equal(true)
    should(api.validator.validate('required_with_all:name,surname', {
      key: '',
      name: 'Alec',
      surname: 'Sadler'
    }, 'key', '')).be.equal(dontMatch)
    should(api.validator.validate('required_with_all:name,surname', {
      key: 'someValue',
      name: 'Alec',
      surname: 'Sadler'
    }, 'key', 'someValue')).be.equal(true)
    should(api.validator.validate('required_with_all:name,surname', { key: 'someValue' }, 'key', 'someValue')).be.equal(true)
    done()
  })

  it('required_without', done => {
    should(api.validator.validate('required_without', {}, '', '')).be.equal('validator need two arguments')
    should(api.validator.validate('required_without:name,surname', { key: '' }, 'key', '')).be.equal(dontMatch)
    should(api.validator.validate('required_without:name,surname', {
      key: '',
      name: 'Alec'
    }, 'key', '')).be.equal(dontMatch)
    should(api.validator.validate('required_without:name,surname', {
      key: 'someValue',
      name: 'Alec'
    }, 'key', 'someValue')).be.equal(true)
    should(api.validator.validate('required_without:name,surname', {
      key: 'someValue',
      name: 'Alec',
      surname: 'Sadler'
    }, 'key', 'someValue')).be.equal(true)
    done()
  })

  it('required_without_all', done => {
    should(api.validator.validate('required_without_all', {}, '', '')).be.equal('validator need two arguments')
    should(api.validator.validate('required_without_all:name,surname', { key: '' }, 'key', '')).be.equal(dontMatch)
    should(api.validator.validate('required_without_all:name,surname', {
      key: '',
      name: 'Alec'
    }, 'key', '')).be.equal(true)
    should(api.validator.validate('required_without_all:name,surname', {
      key: '',
      name: 'Alec',
      surname: 'Sadler'
    }, 'key', '')).be.equal(true)
    should(api.validator.validate('required_without_all:name,surname', {
      key: 'someValue',
      name: 'Alec',
      surname: 'Sadler'
    }, 'key', 'someValue')).be.equal(true)
    should(api.validator.validate('required_without_all:name,surname', { key: 'someValue' }, 'key', 'someValue')).be.equal(true)
    done()
  })

  it('same', done => {
    should(api.validator.validate('same', {}, '', '')).be.equal('validator need one argument')
    should(api.validator.validate('same:opass', { pass: 'test', opass: 'test' }, 'pass', 'test')).be.equal(true)
    should(api.validator.validate('same:opass', { pass: 'test', opass: 'test__' }, 'pass', 'test')).be.equal(dontMatch)
    done()
  })

  it('size', done => {
    should(simplesValidator('size', 'value')).be.equal('validator need one numeric argument')
    should(simplesValidator('size:4', 'qwe')).be.equal(dontMatch)
    should(simplesValidator('size:4', 'qwer')).be.equal(true)
    should(simplesValidator('size:4', 'qwert')).be.equal(dontMatch)
    should(simplesValidator('size:4', 3)).be.equal(dontMatch)
    should(simplesValidator('size:4', 4)).be.equal(true)
    should(simplesValidator('size:4', 5)).be.equal(dontMatch)
    should(simplesValidator('size:4', [ 1, 2, 3 ])).be.equal(dontMatch)
    should(simplesValidator('size:4', [ 1, 2, 3, 4 ])).be.equal(true)
    should(simplesValidator('size:4', [ 1, 2, 3, 4, 5 ])).be.equal(dontMatch)
    done()
  })

  it('url', done => {
    should(simplesValidator('url', '//some/thing')).be.equal(dontMatch)
    should(simplesValidator('url', 'https://gilmendes.wordpress.com')).be.equal(true)
    should(simplesValidator('url', 'https://duckduckgo.com/?q=stellar&t=osx&ia=meanings')).be.equal(true)
    done()
  })

})
