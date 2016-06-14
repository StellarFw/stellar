#!/usr/bin/env node

'use strict'

/**
 This file defines some environment variables to run mocha without problems in all systems.
 **/

let path = require('path')
let spawn = require('child_process').spawn

let testEnv = {}

// merge process environment in the testEnv variable
for (let k in process.env) { testEnv[ k ] = process.env[ k ]; }

// enable test environment
testEnv.NODE_ENV = 'test'

console.log('\x1b[34mstarting Stellar test suit with NODE_ENV=test\x1b[37m')

// obtain the correct executable name giving the execution platform
let mochaExec = null
if (process.platform === 'win32') {
  mochaExec = 'mocha.cmd'
} else {
  mochaExec = 'mocha'
}

let mocha = __dirname + path.sep + 'node_modules' + path.sep + '.bin' + path.sep + mochaExec
let child = spawn(mocha, [ 'test' ], {
  cwd: __dirname,
  env: testEnv
})

child.stdout.on('data', s => process.stdout.write(String(s)))
child.stderr.on('data', s => process.stderr.write(String(s)))

child.on('close', process.exit)
