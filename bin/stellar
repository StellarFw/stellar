#!/usr/bin/env node
'use strict'

const pkg = require('../package.json')
// console.log(`\x1b[34m# Stellar Framework \x1b[37mversion \x1b[33m${pkg.version}\x1b[39m\n`)

require('sywac')
  .preface(null, `\x1b[34m# Stellar Framework \x1b[37mversion \x1b[33m${pkg.version}\x1b[39m`)
  .commandDirectory('commands')
  .boolean('--daemon', { desc: 'Execute the command as a daemon' })
  .help('-h, --help')
  .showHelpByDefault()
  .outputSettings({ maxWidth: 73 })
  .style({
    usagePrefix: str => yellow(str.slice(0, 6)) + ' ' + white(str.slice(7)),
    usageCommandPlaceholder: str => white(str),
    usagePositionals: str => white(str),
    usageArgsPlaceholder: str => white(str),
    usageOptionsPlaceholder: str => white(str),
    group: str => yellow(str),
    flags: str => white(str),
    desc: str => chalk().cyan(str),
    hints: str => chalk().gray.dim(str),
    groupError: str => redBold(str),
    flagsError: str => redBold(str),
    descError: str => redBold(str),
    hintsError: str => chalk().red(str),
    messages: str => redBold(str)
  })
  .parseAndExit()

let c
function chalk () {
  if (!c) c = require('chalk')
  return c
}

function white (s) {
  return chalk().white(s)
}

function yellow (s) {
  return chalk().yellow(s)
}

function redBold (s) {
  return chalk().red.bold(s)
}
