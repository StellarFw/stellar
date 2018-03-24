import { Satellite } from '../satellite';
import { setTimeout } from 'timers';
import {
  readdirSync,
  statSync,
  Stats,
  existsSync,
  readlinkSync,
  unlinkSync,
  rmdirSync,
  mkdirSync,
  createReadStream,
  createWriteStream,
  accessSync,
  unlink,
} from 'fs';
import { normalize, dirname } from 'path';
import { F_OK } from 'constants';
import { networkInterfaces } from 'os';

class Utils {
  private api: any = null;

  constructor(api) {
    this.api = api;
  }

  /**
   * A Promise abstraction for the setTimeout function.
   *
   * This helper method is interesting when it's necessary waiting for a
   * period of time to execute something, and there is no other work to
   * preform until that time doesn't pass.
   *
   * @param time Period of time to wait for until the Promise isn't
   * resolved.
   */
  public delay(time: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, time);
    });
  }

  /**
   * Read all files from the given directory.
   *
   * @param dir Folder path to search.
   */
  public getFiles(dir: string): Array<string> {
    const results = [];

    readdirSync(dir).forEach(file => {
      file = `${dir}/${file}`;
      const stat = statSync(file);

      if (stat && !stat.isDirectory()) {
        results.push(file);
      }
    });

    return results;
  }

  /**
   * Get all files of a given extensions inside a directory and its
   * subdirectories.
   *
   * @param dir Root directory to be searched.
   * @param extension File extension filter. By default the filter is
   * 'js.
   */
  public recursiveDirSearch(
    dir: string,
    extension: string = 'js'
  ): Array<string> {
    const results = [];

    extension = extension.replace('.', '');
    if (dir[dir.length - 1] !== '/') {
      dir += '/';
    }

    if (!existsSync(dir)) {
      return results;
    }

    readdirSync(dir).forEach(file => {
      const fullFilePath = normalize(dir + file);

      // ignore hidden files
      if (file[0] === '.') {
        return;
      }

      const stats = statSync(fullFilePath);

      if (stats.isDirectory()) {
        const child = this.recursiveDirSearch(fullFilePath, extension);
        results.concat(child);
      } else if (stats.isSymbolicLink()) {
        const realPath = readlinkSync(fullFilePath);
        const child = this.recursiveDirSearch(fullFilePath, extension);
        results.concat(child);
      } else if (stats.isFile()) {
        const fileParts = file.split('.');
        const ext = fileParts[fileParts.length - 1];
        if (ext === extension) {
          results.push(fullFilePath);
        }
      }
    });

    return results.sort();
  }

  /**
   * Create a new directory.
   *
   * @param path Path where the directory must be created.
   */
  public createDir(path: string, mode: number = 0o777): void {
    try {
      mkdirSync(path, mode);
    } catch (e) {
      if (e.code === 'ENOENT') {
        this.createDir(dirname(path), mode);
        this.createDir(path, mode);
      }
    }
  }

  /**
   * Remove a directory.
   *
   * @param path Directory to be removed.
   */
  public removeDir(path: string): void {
    let filesList: Array<string>;

    try {
      filesList = readdirSync(path);
    } catch (e) {
      return;
    }

    filesList.forEach(file => {
      const filePath = `${path}/${file}`;

      if (statSync(filePath).isFile()) {
        unlinkSync(filePath);
      } else {
        this.removeDir(filePath);
      }
    });

    rmdirSync(path);
  }

  /**
   * Check if the directory exists.
   *
   * @param dir Path to check.
   */
  public dirExists(dir): boolean {
    try {
      statSync(dir).isDirectory();
    } catch (_) {
      return false;
    }

    return true;
  }

  /**
   * Check if a file exists.
   *
   * @param dir Path to check.
   */
  public fileExists(dir): boolean {
    try {
      statSync(dir).isFile();
    } catch (_) {
      return false;
    }

    return true;
  }

  /**
   * Copy a file.
   *
   * @param source Source path.
   * @param destination Destination path.
   */
  public copyFile(source: string, destination: string): void {
    createReadStream(source).pipe(createWriteStream(destination));
  }

  /**
   * Check if a file/folder exists.
   *
   * @param path Path to check if exists.
   */
  public exists(path: string): boolean {
    try {
      accessSync(path, F_OK);
    } catch (_) {
      return false;
    }

    return true;
  }

  /**
   * Check if the passed argument is a plain object.
   *
   * @param o Object to be tested.
   */
  public isPlainObject(o: any = false): boolean {
    const safeTypes = [
      Boolean,
      Number,
      String,
      Function,
      Array,
      Date,
      RegExp,
      Buffer,
    ];
    const safeInstances = ['boolean', 'number', 'string', 'function'];
    const expandPreventMatchKey = '_toExpand';

    if (o instanceof Object === false) {
      return false;
    }

    for (const type of safeTypes) {
      if (o instanceof type) {
        return false;
      }
    }

    for (const inst of safeInstances) {
      if (typeof o === inst) {
        return false;
      }
    }

    if (o[expandPreventMatchKey] === false) {
      return false;
    }

    return o.toString() === '[object Object]';
  }

  /**
   * Remove the object pointed by the path (file/directory).
   *
   * @param path Path to be removed.
   */
  public removePath(path: string) {
    if (!this.exists(path)) {
      return;
    }

    if (this.fileExists(path)) {
      return unlinkSync(path);
    }

    this.removeDir(path);
  }

  /**
   * Merge two hashes recursively.
   *
   * @param a First hash.
   * @param b Second hash.
   * @param args Additional arguments.
   */
  public hashMerge(a: object, b: object, args: any): object {
    const c = {};
    let response = null;

    for (const i in a) {
      if (this.isPlainObject(a[i]) && Object.keys(a[i]).length > 0) {
        c[i] = this.hashMerge(c[i], a[i], args);
      } else {
        if (typeof a[i] === 'function') {
          response = a[i](args);

          if (this.isPlainObject(response)) {
            c[i] = this.hashMerge(c[i], response, args);
          } else {
            c[i] = response;
          }
        } else {
          c[i] = a[i];
        }
      }
    }

    for (const i in b) {
      if (this.isPlainObject(b[i]) && Object.keys(b[i]).length > 0) {
        c[i] = this.hashMerge(c[i], b[i], args);
      } else {
        if (typeof b[i] === 'function') {
          response = b[i](args);

          if (this.isPlainObject(response)) {
            c[i] = this.hashMerge(c[i], response, args);
          } else {
            c[i] = response;
          }
        } else {
          c[i] = b[i];
        }
      }
    }

    return c;
  }

  /**
   * Get this server external interface.
   */
  public getExternalIPAddress(): string | boolean {
    const ifaces = networkInterfaces();
    let ip: boolean | string = false;

    Object.keys(ifaces).forEach(dev => {
      ifaces[dev].forEach(details => {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          ip = details.address;
        }
      });
    });

    return ip;
  }

  /**
   * Custom require function to load from the core scope and then from the
   * project scope.
   *
   * @note: this is a ugly hack but it works!
   */
  public require(path: string): any {
    // Try load the module from the core.
    try {
      return require(path);
    } catch (e) {
      if (this.api == null) {
        throw e;
      }

      // If it fails, try load from the project folder.
      try {
        return require(`${this.api.scope.rootPath}/node_modules/${path}`);
      } catch (e) {
        throw e;
      }
    }
  }

  /**
   * Get an object property that resides on the given path.
   *
   * @param object Object.
   * @param path Path to a property that is part of the API object.
   */
  public stringToHash(object: any, path: string): any {
    return path.split('.').reduce((obj, i) => obj[i], object);
  }

  /**
   * Checks if the given var is an non empty string.
   *
   * @param {string} value Value to be validated.
   */
  public isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
  }

  /**
   * Unique-ify an array.
   *
   * @param array Array to be uniquefied.
   * @returns {Array} New array.
   */
  public arrayUniqueify(array) {
    array.filter((value, index, self) => {
      return self.indexOf(value) === index;
    });

    return array;
  }
}

export default class UtilsSatellite extends Satellite {
  public loadPriority: number = 0;
  protected _name: string = 'Utils';

  public async load(): Promise<void> {
    this.api.utils = new Utils(this.api);
  }
}
