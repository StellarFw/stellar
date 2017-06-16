'use strict'

// ---------------------------------------------------------------------------- [Imports]

const should = require('should')
const EngineClass = require(__dirname + '/../../dist/engine').default
const engine = new EngineClass({ rootPath: process.cwd() + '/example' })

// ---------------------------------------------------------------------------- [Tests]

let api = null

describe('Core: Chat', () => {

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

  afterEach(async () => {
    try { await api.chatRoom.destroy('newRoom') } catch (e) { }
    try { await api.chatRoom.destroy('otherRoom') } catch (e) { }
  })

  it('can check if rooms exist', async () => {
    const found = await api.chatRoom.exists('defaultRoom')
    found.should.be.ok()
  })

  it('can check if a room does not exits', async () => {
    const found = await api.chatRoom.exists('missingRoom')
    found.should.be.equal(false)
  })

  it('server can create new room', async () => {
    // creates the new room
    await api.chatRoom.create('newRoom')

    // check if the room exists
    const found = await api.chatRoom.exists('newRoom')

    // check if the rooms was created
    found.should.be.equal(true)
  })

  it('server cannot create already existing room', () => {
    return api.chatRoom.create('defaultRoom').should.be.rejectedWith('Room (defaultRoom) already exists')
  })

  it('can enumerate all the rooms in the system', async () => {
    // create two rooms
    await api.chatRoom.create('newRoom')
    await api.chatRoom.create('otherRoom')

    // request the list of rooms
    const list = await api.chatRoom.list()

    list.should.containDeep(['defaultRoom', 'newRoom', 'otherRoom'])
  })

  it('server can destroy a existing room', async () => {
    // creates the new room
    await api.chatRoom.create('newRoom')

    // remove the created room
    return api.chatRoom.destroy('newRoom').should.be.fulfilled()
  })

  it('server can not destroy a non existing room', () => {
    return api.chatRoom.destroy('nonExistingRoom').should.be.rejectedWith('Room (nonExistingRoom) does not exists')
  })

  it ('server can add connections to a room', async () => {
    const client = api.helpers.connection()

    // the client must have zero rooms
    client.rooms.should.have.length(0)

    // add the client to the room
    await api.chatRoom.join(client.id, 'defaultRoom').should.be.fulfilled()

    // now the client must have one connection
    client.rooms[0].should.be.equal('defaultRoom')

    // destroy the connection
    client.destroy()
  })

  it('will not re-add a member to a room', async () => {
    // create a new client
    const client = api.helpers.connection()

    // the client must have zero rooms
    client.rooms.should.have.length(0)

    // add the client to the room
    await api.chatRoom.join(client.id, 'defaultRoom')

    // try add the client to the same room
    await api.chatRoom.join(client.id, 'defaultRoom').should.be.rejectedWith(`Connection (${client.id}) already in room (defaultRoom)`)

    // destroy the connection
    client.destroy()
  })

  it('will not add a member to a non-existing room', async () => {
    // create a new client
    const client = api.helpers.connection()

    // the client must have zero rooms
    client.rooms.should.have.length(0)

    // add the client to a non-existing room
    await api.chatRoom.join(client.id, 'noExists').should.be.rejected()

    // destroy the connection
    client.destroy()
  })

  it('server will not remove a member not in a room', async () => {
    // create a new client
    const client = api.helpers.connection()

    await api.chatRoom.leave(client.id, 'noExists').should.be.rejectedWith(`Connection (${client.id}) not in room (noExists)`)

    // destroy the connection
    client.destroy()
  })

  it('server can remove connections from a room', async () => {
    // create a new client
    const client = api.helpers.connection()

    // add the client to a room
    await api.chatRoom.join(client.id, 'defaultRoom')

    await api.chatRoom.leave(client.id, 'defaultRoom').should.be.fulfilled()

    // destroy the connection
    client.destroy()
  })

  it('server can destroy a room and connections will be removed', async () => {
    // create a new client
    const client = api.helpers.connection()

    // create a new room
    await api.chatRoom.create('newRoom')

    // add the client to it
    await api.chatRoom.join(client.id, 'newRoom')
    client.rooms[0].should.be.equal('newRoom')

    // destroy the room
    await api.chatRoom.destroy('newRoom').should.be.fulfilled()

    client.rooms.length.should.be.equal(0)

    // destroy the connection
    client.destroy()
  })

  it('can get a list of rooms members', async () => {
    // create a new client
    const client = api.helpers.connection()

    // add the client to the room
    await api.chatRoom.join(client.id, 'defaultRoom')

    const status = await api.chatRoom.status('defaultRoom')

    status.room.should.be.equal('defaultRoom')
    status.membersCount.should.be.equal(1)

    // destroy the connection
    client.destroy()
  })

  describe('middleware', () => {
    let clientA = null
    let clientB = null
    let originalPayload = null

    beforeEach(done => {
      originalPayload = api.helpers.generateMessagePlayload
      clientA = api.helpers.connection()
      clientB = api.helpers.connection()

      done()
    })
  })
})
