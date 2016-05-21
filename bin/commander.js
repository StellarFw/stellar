'use strict';

let minimist = require('minimist')
let pkg = require('../package.json')

// console colors
const FgRed = "\x1b[31m"
const FgGreen = "\x1b[32m"
const FgYellow = "\x1b[33m"
const FgBlue = "\x1b[34m"
const FgWhite = "\x1b[37m"

/**
 * Class to represent a command.
 */
class Command {
  constructor(name, args, description, actionFn) {
    this.name = name
    this.args = args || {}
    this.desc = description || ''
    this.actionFn = actionFn
  }

  /**
   * Set the command description string.
   *
   * @param  {String} desc Command description.
   * @return {Command}      This command instance.
   */
  description(desc) {
    this.desc = desc
    return this
  }

  /**
   * Set the command action.
   *
   * @param  {Function} actionFn Command action.
   * @return {Command}      This command instance.
   */
  action(actionFn) {
    this.actionFn = actionFn
    return this
  }

  /**
   * Define a new command options.
   *
   * @param  {String} name  Command name.
   * @param  {String} desc  Command description.
   * @return {Command}      This command instance.
   */
  option(name, desc) {
    this.args[ name ] = desc
    return this
  }
}

/**
 * Commander class.
 */
module.exports = class Commander {

  /**
   * Create a new Commander instance.
   */
  constructor() {
    this.commands = new Map()
    this.args = null
  }

  /**
   * Register a new command.
   *
   * The args should be an hash with the follow structure {'argName': 'description'}
   *
   * @param  {String} name        Command name.
   * @param  {Function} actionFn  Command action.
   * @param  {Array} args         Command args.
   * @return {Command}            Return the command instance.
   */
  command(name, actionFn, args) {
    // check if the name is already registered
    if (this.commands.has(name)) {
      throw new Error('The command name are already registered!')
    }

    // create a new command instance
    let newCommand = new Command(name, args, '', actionFn)

    // register the new command
    this.commands.set(name, newCommand)

    // return the created command instance
    return newCommand
  }

  /**
   * Normalize a string to be printed.
   *
   * @param str       String to normalize.
   * @param length    Final size who da string must have.
   * @returns {*}     Normalized string.
   * @private
   */
  static _normalizeString(str, length) {
    if (str.length < length) {
      str += ' '.repeat(length - str.length)
    }

    return str
  }

  /**
   * Print all available commands.
   */
  printHelper() {
    let self = this

    // print stellar version
    console.log(`${FgBlue}> Stellar Framework ${FgWhite}version ${FgYellow}${pkg.version}\n`)

    // print all the available commands
    console.log(`${FgYellow}Available commands:`)
    this.commands.forEach(command => {
      // normalize the string to have always the same size
      let cmdName = Commander._normalizeString(command.name, 25)

      // print out the command info
      console.log(` ${FgBlue}${cmdName}${FgWhite}${command.desc}`)
    })
  }

  /**
   * Print the command info.
   *
   * This also prints the command options.
   *
   * @param  {String} name Command name.
   */
  printCommandHelp(name) {
    // check if the command exists
    if (!this.commands.has(name)) {
      console.log(`\n${FgRed}Command "${name}" is not defined.\n`)
      return
    }

    // get the command instance
    let command = this.commands.get(name)

    // print the command name
    console.log(`${FgBlue}${command.name}\n`)

    // print command description
    console.log(`${FgYellow}Help:\n ${FgWhite}${command.desc}\n`)

    // iterate all command options an print it
    if (Object.keys(command.args).length > 0) {
      console.log(`${FgYellow}Options:`)

      for (let key in command.args) {
        // get the command description
        let desc = command.args[ key ] || ''

        // print it
        console.log(`  ${FgGreen}${key}\t\t${FgWhite}${desc}`);
      }
    }
  }

  /**
   * Do some initialization operations.
   */
  init() {
    // register the help command
    this.command('help')
      .description('show the command description')
      .action(this.helperCommand)

    // @todo: order the command by alphabetic order
  }

  /**
   * Make the parse of the console arguments and execute the correspondent action.
   *
   * @param args Console arguments.
   */
  parse(args) {
    // do some initialize operations
    this.init()

    // slice the two first arguments to remove the node and the binary identify
    args = args.splice(2)

    // parse the command line arguments
    this.args = minimist(args)

    // if the '-V' or '--version' options are present the version should be
    // printed out and the execution finished
    if (this.args.hasOwnProperty('V') || this.args.hasOwnProperty('version')) {
      console.log(`${FgBlue}> Stellar Framework ${FgWhite}version ${FgYellow}${pkg.version}`)
      return
    }

    // is to show the help function?
    if (this.args._.length === 0) {
      this.printHelper()
      return
    }

    // check if the requested command exists
    if (!this.commands.has(this.args._[ 0 ])) {
      console.log(`\n${FgRed}Command "${this.args._[ 0 ]}" is not defined.\n`)
      return
    }

    // execute the command
    this.commands.get(this.args._[ 0 ]).actionFn.bind(this)(this.args)
  }

  // ---------------------------------------------------------------- [Commands]

  /**
   * Help command.
   *
   * This will print out the requested command description.
   *
   * @param  {Object} args Command line arguments.
   */
  helperCommand(args) {
    // check if was all the required arguments
    if (args._.length < 2) {
      console.log(`\n${FgYellow}Usage: stellar help <command name>\n`)
      return
    }

    this.printCommandHelp(args._[ 1 ])
  }

}
