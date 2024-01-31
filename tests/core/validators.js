'use strict'

let should = require('should')

let EngineClass = require(__dirname + '/../../dist/engine').default
let engine = new EngineClass({ rootPath: process.cwd() + '/example' })

let async = require('async')

let api = null

let simplesValidator = (name, value) => api.validator.validate({ key: value }, { key: name })

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
    (() => { simplesValidator('before:2016--28', '') }).should.throw('the specified argument is not a valid date')

    should(simplesValidator('before:2016-05-28', 'asd')).not.be.equal(true)
    should(simplesValidator('before:2016-05-28', '2016-05-12')).be.equal(true)
    should(simplesValidator('before:2016-05-28', '2016-07-18')).not.be.equal(true)
    done()
  })

  it('after', done => {
    should(simplesValidator('after:2016-11-26', 'asd')).not.be.equal(true)
    should(simplesValidator('after:2016-11-26', '2016-11-25')).not.be.equal(true)
    should(simplesValidator('after:2016-11-26', '2016-11-26')).not.be.equal(true)
    should(simplesValidator('after:2016-11-26', '2016-11-27')).be.equal(true)
    done()
  })

  it('between', done => {
    (() => simplesValidator('between', '')).should.throw()
    should(simplesValidator('between:20,50', 'asd')).not.be.equal(true)
    should(simplesValidator('between:1,3', '23')).be.equal(true)
    should(simplesValidator('between:5,50', 200)).not.be.equal(true)
    should(simplesValidator('between:0,10', 6)).be.equal(true)
    should(simplesValidator('between:0,20', [ 1, 2, 4 ])).not.be.equal(true)
    done()
  })

  it('boolean', done => {
    should(simplesValidator('boolean', true)).be.equal(true)
    should(simplesValidator('boolean', false)).be.equal(true)
    should(simplesValidator('boolean', 'asd')).not.be.equal(true)
    should(simplesValidator('boolean', 123)).not.be.equal(true)
    should(simplesValidator('boolean', [ 1, 2 ])).not.be.equal(true)
    should(simplesValidator('boolean', { key: 'value' })).not.be.equal(true)
    done()
  })

  it('confirmed', done => {
    should(api.validator.validate({ key: 'value', key_confirmation: 'value' }, { key: 'confirmed' })).be.equal(true)
    should(api.validator.validate({ key: 'value' }, { key: 'confirmed' })).not.be.equal(true)
    should(api.validator.validate({
      key: 'value',
      key_confirmation: 'other_value'
    }, { key: 'confirmed' })).not.be.equal(true)
    done()
  })

  it('date', done => {
    should(simplesValidator('date', '')).be.not.equal(true)
    should(simplesValidator('date', '2016-05-28')).be.equal(true)
    done()
  })

  it('different', done => {
    (() => { api.validator.validate({ 'key': 'value', 'key2': 'value2' }, { 'key': 'different' }) }).should.throw()
    should(api.validator.validate({ 'key': 'value', 'key2': 'value' }, { 'key': 'different:key2' })).not.be.equal(true)
    should(api.validator.validate({ 'key': 'value', 'key2': 'value2' }, { 'key': 'different:key2' })).be.equal(true)
    done()
  })

  it('email', done => {
    should(simplesValidator('email', '')).not.be.equal(true)
    should(simplesValidator('email', 'user')).not.be.equal(true)
    should(simplesValidator('email', 'example.com')).not.be.equal(true)
    should(simplesValidator('email', 'user@example')).not.be.equal(true)
    should(simplesValidator('email', 'user@example.com')).be.equal(true)
    should(simplesValidator('email', 'user.surname@example.com')).be.equal(true)
    done()
  })

  it('filled', done => {
    should(simplesValidator('filled', null)).not.be.equal(true)
    should(simplesValidator('filled', '')).not.be.equal(true)
    should(simplesValidator('filled', 'value')).be.equal(true)
    done()
  })

  it('in', done => {
    (() => { simplesValidator('in', '1') }).should.throw('validator needs an array')
    should(simplesValidator('in:1,2,3', '1')).be.equal(true)
    should(simplesValidator('in:1,2,3', '7')).not.be.equal(true)
    done()
  })

  it('not_in', done => {
    (() => { simplesValidator('not_in', '1') }).should.throw('validator needs an array')
    should(simplesValidator('not_in:1,2,3', '1')).not.be.equal(true)
    should(simplesValidator('not_in:1,2,3', '7')).be.equal(true)
    done()
  })

  it('integer', done => {
    should(simplesValidator('integer', 'asd')).not.be.equal(true)
    should(simplesValidator('integer', '123')).be.equal(true)
    should(simplesValidator('integer', 123)).be.equal(true)
    done()
  })

  it('ip', done => {
    should(simplesValidator('ip', '127.0.0.1')).be.equal(true)
    should(simplesValidator('ip', '')).not.be.equal(true)
    done()
  })

  it('json', done => {
    should(simplesValidator('json', '')).not.be.equal(true)
    should(simplesValidator('json', 'string')).not.be.equal(true)
    should(simplesValidator('json', '123')).not.be.equal(true)
    should(simplesValidator('json', 123)).not.be.equal(true)
    should(simplesValidator('json', JSON.stringify({ key: 'test', value: 123 }))).be.equal(true)
    done()
  })

  it('max', done => {
    (() => { simplesValidator('max', '') }).should.throw('Validation rule max requires at least 1 parameters.')
    should(simplesValidator('numeric|max:10', 9)).be.equal(true)
    should(simplesValidator('numeric|max:10', 10)).be.equal(true)
    should(simplesValidator('numeric|max:10', 11)).have.value('key', 'The key may not be greater than 10.')
    should(simplesValidator('max:3', 'as')).be.equal(true)
    should(simplesValidator('max:3', 'asd')).be.equal(true)
    should(simplesValidator('max:3', 'asdf')).have.value('key', 'The key may not be greater than 3 characters.')
    should(simplesValidator('array|max:3', [ 1, 2 ])).be.equal(true)
    should(simplesValidator('array|max:3', [ 1, 2, 3 ])).be.equal(true)
    should(simplesValidator('array|max:3', [ 1, 2, 3, 4 ])).have.value('key', 'The key may not have more than 3 items.')

    done()
  })

  it('min', done => {
    (() => { simplesValidator('min', '') }).should.throw('Validation rule min requires at least 1 parameters.')
    should(simplesValidator('numeric|min:3', 2)).have.value('key', 'The key must be at least 3.')
    should(simplesValidator('numeric|min:3', 3)).be.equal(true)
    should(simplesValidator('numeric|min:3', 4)).be.equal(true)
    should(simplesValidator('min:3', 'as')).have.value('key', 'The key must be at least 3 characters.')
    should(simplesValidator('min:3', 'asd')).be.equal(true)
    should(simplesValidator('min:3', 'asdf')).be.equal(true)
    should(simplesValidator('array|min:3', [ 1, 2 ])).have.value('key', 'The key must have at least 3 items.')
    should(simplesValidator('array|min:3', [ 1, 2, 3 ])).be.equal(true)
    should(simplesValidator('array|min:3', [ 1, 2, 3, 4 ])).be.equal(true)
    done()
  })

  it('required', done => {
    should(api.validator.validate({}, { key: 'required' })).not.be.equal(true)
    should(simplesValidator('required', 'someValue')).be.equal(true)
    done()
  })

  it('numeric', done => {
    should(simplesValidator('numeric', 'asd')).not.be.equal(true)
    should(simplesValidator('numeric', 123)).be.equal(true)
    should(simplesValidator('numeric', 123.123)).be.equal(true)
    done()
  })

  it('regex', done => {
    (() => { simplesValidator('regex', 'asd') })
      .should.throw('Validation rule regex requires at least 1 parameters.')

    simplesValidator('regex:^\\d{3}$', 'asd').should.have.value('key', 'The key format is invalid.')

    simplesValidator('regex:^\\d{3}$', '123').should.be.equal(true)

    done()
  })

  it('required_if', done => {
    (() => {
      api.validator.validate({
        key: 'v1',
        key2: 'v2'
      }, { key: 'required_if' })
    }).should.throw('Validation rule required_if requires at least 2 parameters.')
    should(api.validator.validate({ key2: 'b' }, { key: 'required_if:key2,v,v1,v2' })).be.equal(true)
    should(api.validator.validate({ key2: 'v1' }, { key: 'required_if:key2,v,v1,v2' })).have.value('key', 'The key field is required when key2 is in v, v1, v2.')
    should(api.validator.validate({ key: 'v1', key2: 'v2' }, { key: 'required_if:key2,v1' })).be.equal(true)

    done()
  })

  it('required_unless', done => {
    (() => { api.validator.validate({ key: '' }, { key: 'required_unless' }) }).should.throw('Validation rule required_unless requires at least 2 parameters.')
    should(api.validator.validate({ key: '' }, { key: 'required_unless:key2,val1,val2' })).have.value('key', 'The key field is required unless key2 is in val1, val2.')
    should(api.validator.validate({
      key: '',
      key2: 'otherValue'
    }, { key: 'required_unless:key2,val1,val2' })).have.value('key', 'The key field is required unless key2 is in val1, val2.')
    should(api.validator.validate({ key: 'notEmpty' }, { key: 'required_unless:key2,val1,val2' })).be.equal(true)
    should(api.validator.validate({ key: '', key2: 'val1' }, { key: 'required_unless:key2,val1,val2' })).be.equal(true)

    done()
  })

  it('required_with', done => {
    (() => {
      api.validator.validate({ key: '' }, { key: 'required_with' })
    }).should.throw('Validation rule required_with requires at least 1 parameters.')
    should(api.validator.validate({ key: '' }, { key: 'required_with:name,surname' })).be.equal(true)
    should(api.validator.validate({
      key: '',
      name: 'Alec'
    }, {
      key: 'required_with:name,surname'
    })).have.value('key', 'The key field is required when at least one of name, surname is present.')
    should(api.validator.validate({
      key: 'someValue',
      name: 'Alec'
    }, { key: 'required_with:name,surname' })).be.equal(true)

    done()
  })

  it('required_with_all', done => {
    (() => {
      api.validator.validate({ key: '' }, { key: 'required_with_all' })
    }).should.throw('Validation rule required_with_all requires at least 2 parameters.')
    should(api.validator.validate({ key: '' }, { key: 'required_with_all:name,surname' })).be.equal(true)
    should(api.validator.validate({
      key: '',
      name: 'Alec'
    }, { key: 'required_with_all:name,surname' })).be.equal(true)
    should(api.validator.validate({
      key: '',
      name: 'Alec',
      surname: 'Sadler'
    }, { key: 'required_with_all:name,surname' })).have.value('key', 'The key field is required when name, surname are present.')
    should(api.validator.validate({
      key: 'someValue',
      name: 'Alec',
      surname: 'Sadler'
    }, { key: 'required_with_all:name,surname' })).be.equal(true)
    should(api.validator.validate({ key: 'someValue' }, { key: 'required_with_all:name,surname' })).be.equal(true)

    done()
  })

  it('required_without', done => {
    (() => {
      api.validator.validate({ key: '' }, { key: 'required_without' })
    }).should.throw('Validation rule required_without requires at least 1 parameters.')

    should(api.validator.validate({ key: '' }, { key: 'required_without:name,surname' }))
      .have.value('key', 'The key field is required when at least one of name, surname is not present.')

    should(api.validator.validate({ key: '', name: 'Alec' }, { key: 'required_without:name,surname' }))
      .have.value('key', 'The key field is required when at least one of name, surname is not present.')

    should(api.validator.validate({ key: 'someValue',  name: 'Alec' }, { key: 'required_without:name,surname' }))
      .be.equal(true)

    should(api.validator.validate({
      key: 'someValue',
      name: 'Alec',
      surname: 'Sadler'
    }, { key: 'required_without:name,surname' })).be.equal(true)

    done()
  })

  it('required_without_all', done => {
    (() => {
      api.validator.validate({ key: '' }, { key: 'required_without_all' })
    }).should.throw('Validation rule required_without_all requires at least 2 parameters.')

    should(api.validator.validate({ key: '' }, { key: 'required_without_all:name,surname' }))
      .have.value('key', 'The key field is required when none of name, surname are present.')

    should(api.validator.validate({ key: '', name: 'Alec' }, { key: 'required_without_all:name,surname' }))
      .be.equal(true)

    should(api.validator.validate({
      key: '',
      name: 'Alec',
      surname: 'Sadler'
    }, { key: 'required_without_all:name,surname' })).be.equal(true)

    should(api.validator.validate({
      key: 'someValue',
      name: 'Alec',
      surname: 'Sadler'
    }, { key: 'required_without_all:name,surname' })).be.equal(true)
    should(api.validator.validate({ key: 'someValue' }, { key: 'required_without_all:name,surname' })).be.equal(true)

    done()
  })

  it('same', done => {
    (() => {
      api.validator.validate({ key: '' }, { key: 'same' })
    }).should.throw('Validation rule same requires at least 1 parameters.')

    should(api.validator.validate({ pass: 'test', opass: 'test' }, { pass: 'same:opass' })).be.equal(true)

    should(api.validator.validate({ pass: 'test', opass: 'test__' }, { pass: 'same:opass' }))
      .have.value('pass', 'The pass and opass must match.')

    done()
  })

  it('size', done => {
    (() => {
      simplesValidator('size', 'value')
    }).should.throw('Validation rule size requires at least 1 parameters.')

    should(simplesValidator('size:4', 'qwe')).have.value('key', 'The key must be 4 characters.')
    should(simplesValidator('size:4', 'qwer')).be.equal(true)
    should(simplesValidator('size:4', 'qwert')).have.value('key', 'The key must be 4 characters.')
    should(simplesValidator('numeric|size:4', 3)).have.value('key', 'The key must be 4.')
    should(simplesValidator('numeric|size:4', 4)).be.equal(true)
    should(simplesValidator('numeric|size:4', 5)).have.value('key', 'The key must be 4.')
    should(simplesValidator('array|size:4', [ 1, 2, 3 ])).have.value('key', 'The key must contain 4 items.')
    should(simplesValidator('array|size:4', [ 1, 2, 3, 4 ])).be.equal(true)
    should(simplesValidator('array|size:4', [ 1, 2, 3, 4, 5 ])).have.value('key', 'The key must contain 4 items.')

    done()
  })

  it('url', done => {
    should(simplesValidator('url', '//some/thing')).have.value('key', 'The key format is invalid.')
    should(simplesValidator('url', 'https://gilmendes.wordpress.com')).be.equal(true)
    should(simplesValidator('url', 'https://duckduckgo.com/?q=stellar&t=osx&ia=meanings')).be.equal(true)

    done()
  })

})
