import { Transport } from 'winston';
import chalk from 'chalk';
import { EOL } from 'os';

// List of colors for each level
const colors = {
  emerg: 'Red',
  alert: 'Yellow',
  crit: 'Red',
  error: 'Red',
  warning: 'Red',
  notice: 'Yellow',
  info: 'Green',
  debug: 'Blue',
};

export default class BeautifulLogger extends Transport {
  private api: any = null;

  private json: any = null;
  private colorize: any = null;
  private prettyPrint: any = null;
  private timestamp: any = null;
  private showLevel: any = null;
  private label: any = null;
  private logstash: any = null;
  private depth: any = null;
  private align: any = null;
  private stderrLevels: any = null;
  private eol: any = null;
  private stringify: any = null;

  constructor(api, options) {
    super(options);
    options = options || {};

    this.api = api;

    this.json = options.json || false;
    this.colorize = options.colorize || false;
    this.prettyPrint = options.prettyPrint || false;
    this.timestamp = typeof options.timestamp !== 'undefined' ? options.timestamp : false;
    this.showLevel = options.showLevel === undefined ? true : options.showLevel;
    this.label = options.label || null;
    this.logstash = options.logstash || false;
    this.depth = options.depth || null;
    this.align = options.align || false;
    this.stderrLevels = this.setStderrLevels(options.stderrLevels, options.debugStdout);
    this.eol = options.eol || EOL;

    if (this.json) {
      this.stringify = options.stringify || (obj => JSON.stringify(obj, null, 2));
    }
  }

  private stringArrayToSet(strArray, errMsg) {
    errMsg = errMsg || 'Cannot make set from Array with non-string elements';

    return strArray.reduce((set, el) => {
      if (typeof el !== 'string') {
        throw new Error(errMsg);
      }

      set[el] = true;
      return set;
    }, {});
  }

  private setStderrLevels(levels, debugStdout) {
    const defaultMsg = 'Cannot have non-string elements in stderrLevels Array';
    if (debugStdout) {
      if (levels) {
        //
        // Don't allow setting both debugStdout and stderrLevels together,
        // since this could cause behaviour a programmer might not expect.
        //
        throw new Error('Cannot set debugStdout and stderrLevels together');
      }

      return this.stringArrayToSet([ 'error' ], defaultMsg);
    }

    if (!levels) {
      return this.stringArrayToSet([ 'error', 'debug' ], defaultMsg);
    } else if (!(Array.isArray(levels))) {
      throw new Error('Cannot set stderrLevels to type other than Array');
    }

    return this.stringArrayToSet(levels, defaultMsg);
  }

  /**
   * Return the current date formatted.
   *
   * Format: 2017-04-21 18:23:38.310
   *
   * @returns {string}
   */
  private getCurrentDate() {
    // get the current date
    const data = new Date();

    // build a string with the correct formatted date
    return data.getFullYear() + '-' +
      ('0' + (data.getMonth() + 1)).slice(-2) + '-' +
      ('0' + data.getDate()).slice(-2) + ' ' +
      ('0' + data.getHours()).slice(-2) + ':' +
      ('0' + data.getMinutes()).slice(-2) + ':' +
      ('0' + data.getSeconds()).slice(-2) + '.' +
      ('00' + data.getMilliseconds()).slice(-3);
  }

  /**
   * Function log.
   *
   * @param level Level at which to log the message.
   * @param msg Message to log
   * @param meta **Optional** Additional metadata to attach
   * @param callback Continuation to respond to when complete.
   */
  public log(level, msg, meta, callback) {
    // don't print when the transport is in silent
    if (this.silent) {
      return callback(null, true);
    }

    let output = '';

    // append the date if enabled
    if (this.timestamp) {
      const toPrint = ` ${this.getCurrentDate()} `;
      output += this.colorize ? chalk.bgWhite.black(toPrint) : toPrint;
    }

    // append the level if enabled
    if (this.showLevel) {
      const backgroundColor = chalk[ `bg${colors[ level ]}` ];
      output += backgroundColor.black(` ${level.toUpperCase()} `) + ' ';
    }

    // append the message
    output += msg;

    // append metadata
    if (meta !== null && meta !== undefined) {
      // get stack from an Error instance
      if (meta && meta instanceof Error && meta.stack) {
        meta = meta.stack;
      }

      if (typeof meta !== 'object') {
        output += ` ${meta}`;
      } else if (Object.keys(meta).length > 0) {
        if (typeof this.prettyPrint === 'function') {
          output += ` ${this.prettyPrint(meta)}`;
        } else if (this.prettyPrint) {
          output += ` \n${this.api.inspect(meta, false, this.depth || null, this.colorize)}`;
        } else if (
          Object.keys(meta).length &&
          meta.hasOwnProperty('date') &&
          meta.hasOwnProperty('process') &&
          meta.hasOwnProperty('os') &&
          meta.hasOwnProperty('trace') &&
          meta.hasOwnProperty('stack')) {
          // if meta carries unhandled exception data serialize the stack nicely
          const stack = meta.stack;
          delete meta.stack;
          delete meta.trace;
          output += ` ${this.serialize(meta)}`;

          if (stack) {
            output += `\n${stack.join('\n')}`;
          }
        } else {
          output += ` ${this.serialize(meta)}`;
        }
      }
    }

    // print output the message to the STDOUT or STDERR, depending on log level
    if (this.stderrLevels[ level ]) {
      process.stderr.write(output + this.eol);
    } else {
      process.stdout.write(output + this.eol);
    }

    // Emit the `logged` event immediately because the event loop will not exit until `process.stdout` has drained
    // anyway.
    this.emit('logged');
    callback(null, true);
  }

  private serialize(obj, key = null) {
    // symbols cannot be directly casted to strings
    if (typeof key === 'symbol') {
      key = key.toString();
    }
    if (typeof obj === 'symbol') {
      obj = obj.toString();
    }

    if (obj === null) {
      obj = 'null';
    } else if (obj === undefined) {
      obj = 'undefined';
    } else if (obj === false) {
      obj = 'false';
    }

    if (typeof obj !== 'object') {
      return key ? key + '=' + obj : obj;
    }

    if (obj instanceof Buffer) {
      return key ? key + '=' + obj.toString('base64') : obj.toString('base64');
    }

    let msg = '';
    const keys = Object.keys(obj);
    const length = keys.length;

    for (let i = 0; i < length; i++) {
      if (Array.isArray(obj[ keys[ i ] ])) {
        msg += keys[ i ] + '=[';

        for (let j = 0, l = obj[ keys[ i ] ].length; j < l; j++) {
          msg += this.serialize(obj[ keys[ i ] ][ j ]);
          if (j < l - 1) {
            msg += ', ';
          }
        }

        msg += ']';
      } else if (obj[ keys[ i ] ] instanceof Date) {
        msg += keys[ i ] + '=' + obj[ keys[ i ] ];
      } else {
        msg += this.serialize(obj[ keys[ i ] ], keys[ i ]);
      }

      if (i < length - 1) {
        msg += ', ';
      }
    }

    return msg;
  }
}
