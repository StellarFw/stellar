import async from 'async'

/**
 * This class process an action request.
 */
class ActionProcessor {
  /**
   * API reference.
   *
   * @type {null}
   */
  api = null

  connection = null
  action = null
  toProcess = true
  toRender = true
  messageCount = null
  params = null
  callback = null
  validatorErrors = new Map()
  actionStartTime = null
  actionTemplate = null
  working = false
  response = {}
  duration = null
  actionStatus = null

  /**
   * Timer that is used to timeout the action call.
   */
  timeoutTimer = null

  /**
   * When this flag is set to true we block any after response.
   *
   * This is essential used when a timeout happens.
   *
   * @type {boolean}
   */
  errorRendered = false

  /**
   * Create a new Action Processor instance.
   *
   * @param api API reference.
   * @param connection Connection object.
   * @param callback Callback function.
   */
  constructor (api, connection, callback) {
    this.api = api
    this.connection = connection
    this.messageCount = connection.messageCount
    this.params = connection.params
    this.callback = callback
  }

  /**
   * Operations to be performed before the real action execution.
   *
   * @param callback Callback function.
   */
  preProcessAction (callback) {
    let self = this

    // if the action is private this can only be executed internally
    if (self.actionTemplate.private === true && self.connection.type !== 'internal') {
      callback(self.api.config.errors.privateActionCalled(self.actionTemplate.name))
      return
    }

    let processors = []
    let processorsNames = self.api.actions.globalMiddleware.slice(0)

    // get action processor names
    if (self.actionTemplate.middleware) { self.actionTemplate.middleware.forEach(m => { processorsNames.push(m) }) }

    processorsNames.forEach(name => {
      if (typeof self.api.actions.middleware[ name ].preProcessor === 'function') {
        processors.push(next => { self.api.actions.middleware[ name ].preProcessor(self, next) })
      }
    })

    async.series(processors, callback)
  }

  /**
   * Operations to be performed after the action execution.
   *
   * @param callback
   */
  postProcessAction (callback) {
    let self = this
    let processors = []
    let processorNames = self.api.actions.globalMiddleware.slice(0)

    if (self.actionTemplate.middleware) { self.actionTemplate.middleware.forEach(m => { processorNames.push(m) }) }

    processorNames.forEach(name => {
      if (typeof self.api.actions.middleware[ name ].postProcessor === 'function') {
        processors.push(next => { self.api.actions.middleware[ name ].postProcessor(self, next) })
      }
    })

    async.series(processors, callback)
  }

  /**
   * Process the action.
   */
  processAction () {
    let self = this

    // initialize the processing environment
    self.actionStartTime = new Date().getTime()
    self.working = true
    self.incrementTotalActions()
    self.incrementPendingActions()
    self.action = self.params.action

    if (self.api.actions.versions[ self.action ]) {
      if (!self.params.apiVersion) {
        self.params.apiVersion = self.api.actions.versions[ self.action ][ self.api.actions.versions[ self.action ].length - 1 ]
      }
      self.actionTemplate = self.api.actions.actions[ self.action ][ self.params.apiVersion ]
    }

    if (self.api.status !== 'running') {
      self.completeAction('server_shutting_down')
    } else if (self.getPendingActionCount(self.connection) > self.api.config.general.simultaneousActions) {
      self.completeAction('too_many_requests')
    } else if (!self.action || !self.actionTemplate) {
      self.completeAction('unknown_action')
    } else if (self.actionTemplate.blockedConnectionTypes && self.actionTemplate.blockedConnectionTypes.indexOf(self.connection.type) >= 0) {
      self.completeAction('unsupported_server_type')
    } else {
      try {
        self.runAction()
      } catch (err) {
        self.api.exceptionHandlers.action(err, self, () => self.completeAction('server_error'))
      }
    }
  }

  /**
   * Run an action.
   */
  runAction () {
    this.preProcessAction(error => {
      // validate the request params with the action requirements
      this.validateParams()

      if (error) {
        this.completeAction(error)
      } else if (this.validatorErrors.size > 0) {
        this.completeAction('validator_errors')
      } else if (this.toProcess === true && !error) {
        // create a timer that will be used to timeout the action if needed. The time timeout is reached a timeout error
        // is sent to the client.
        this.timeoutTimer = setTimeout(() => {
          // finish action with a timeout error
          this.completeAction('response_timeout')

          // ensure that the action wouldn't respond
          this.errorRendered = true
        }, this.api.config.general.actionTimeout)

        // execute the action logic
        const returnVal = this.actionTemplate.run(this.api, this, error => {
          // stop the timeout timer
          clearTimeout(this.timeoutTimer)

          // when the error rendered flag is set we don't send a response
          if (this.errorRendered) { return }

          // catch the error messages and send to the client an error as a response
          if (error) { return this.completeAction(error) }

          // execute the post action process
          this.postProcessAction(error => this.completeAction(error))
        })

        // if the returnVal is a Promise we wait for the resolve/rejection and
        // after that we finish the action execution
        if (returnVal && typeof returnVal.then === 'function') {
          returnVal
            // execute the post action process
            .then(() => {
              // when the error rendered flag is set we don't send a response
              if (this.errorRendered) { return }

              // post process the action
              this.postProcessAction(error => this.completeAction(error))
            })

            // catch error responses
            .catch(error => {
              // when the error rendered flag is set we don't send a response
              if (this.errorRendered) { return }

              // complete the action with an error message
              this.completeAction(error)
            })

            // stop the timeout timer
            .then(() => clearTimeout(this.timeoutTimer))
        }
      } else {
        this.completeAction()
      }
    })
  }
}
