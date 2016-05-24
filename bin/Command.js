'use strict'

module.exports = class {
  
  constructor() {
    // define the console colors
    this.FgRed = "\x1b[31m"
    this.FgGreen = "\x1b[32m"
    this.FgYellow = "\x1b[33m"
    this.FgBlue = "\x1b[34m"
    this.FgWhite = "\x1b[37m"

    // create an usage variable
    this.usage = ''
  }

  /**
   * Print command usage.
   */
  printUsage() {
    console.log(`\n${this.FgYellow}Usage: ${this.FgGreen}${this.usage}\n`)
  }

  /**
   * Print an error message.
   *
   * @param msg Message to be printed.
   */
  printError(msg) {
    console.log(`\n${this.FgRed}Error: ${msg}\n`)
  }

  /**
   * Print a success message.
   *
   * @param msg Message to be printed.
   */
  printSuccess(msg) {
    console.log(`\n${this.FgGreen}Success: ${msg}\n`)
  }

}
