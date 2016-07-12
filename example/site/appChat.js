'use strict'

class App {

  constructor () {
    // setup application
    this._setup()
  }

  _setup () {
    let self = this

    // get the visual elements
    this.messagesBox = document.getElementById('messagesBox')
    this.input = document.getElementById('messageInput')
    this.sendBtn = document.getElementById('sendBtn')

    // assign the behavior to send button
    this.sendBtn.addEventListener('click', this._callbackSendBtn.bind(this))

    // open a new connection with the Server
    this.client = new StellarClient({url: 'http://0.0.0.0:8080/'})

    // define some connection events
    this.client.on('connected', () => {
      // print out a connection message
      self._printMessage('[SERVER] You are now connected with the server!!!')

      // add the user to the defaultRoom
      this.client.roomAdd('defaultRoom', res => {
        // print the number of online users
        this.client.roomView('defaultRoom', res => {
          self._printMessage(`[SERVER] there is ${res.data.membersCount} online users`)
        })
      })
    })

    this.client.on('say', res => { self._printMessage(`[USER] ${res.message}`) })

    // open the server connection
    this.client.connect()
  }

  _callbackSendBtn () {
    if (this.input.value === '') { return }

    // send the message
    this.client.say('defaultRoom', this.input.value)
  }

  _printMessage (message) {
    // create a new message entry
    let messageEntry = document.createElement('p')
    messageEntry.className = 'messageEntry'

    // create the text node and append it to the messageEntry
    let textNode = document.createTextNode(message)
    messageEntry.appendChild(textNode)

    // append the message entry on the messages box
    this.messagesBox.appendChild(messageEntry)
  }

}

// start the application
new App()
