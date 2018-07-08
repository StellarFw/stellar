declare const Primus;

import { callbackify } from 'util';
import { timingSafeEqual } from 'crypto';

const warn = msg => console.warn(`[Stellar warn]: ${msg}`);
const error = msg => console.error(`[Stellar error]: ${msg}`);
const isFunction = val => typeof val === 'function';
const isObject = obj => obj !== null && typeof obj === 'object';

export interface ConnectionDetailsInterface {
  id: string;
  fingerprint: string;
  remoteIP: string;
  remotePort: number;
  params: any;
  connectedAt: Date;
  rooms: Array<string>;
  totalActions: number;
  pendingActions: number;
}

export interface ConnectionDetailsResponse {
  data: ConnectionDetailsInterface;
}

/**
 * Possible states for the client.
 */
export enum ClientState {
  Disconnect = 'disconnected',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Timeout = 'timeout',
}

// Save the original emit method to use as local event emitter.
const _emit = Primus.emit;

export class BuildEvent {
  /**
   * Client instance.
   */
  private client: Stellar;

  /**
   * Selected rooms.
   */
  private rooms: Array<string>;

  constructor(room: string | Array<string>, client: Stellar) {
    this.client = client;

    if (Array.isArray(room)) {
      this.rooms = room;
    } else {
      this.rooms = [room];
    }
  }

  /**
   * Internal method to add room.
   *
   * @param room Room to add.
   */
  private innerRoomAdd(room: string | Array<string>): BuildEvent {
    if (Array.isArray(room)) {
      this.rooms = this.rooms.concat(room);
    } else {
      this.rooms.push(room);
    }

    return this;
  }

  /**
   * Add a new room where the vent must be sent.
   *
   * @param room New room to append or an array.
   */
  public to(room: string): BuildEvent {
    return this.innerRoomAdd(room);
  }

  /**
   * Send the event to the server.
   *
   * We send an event for each room.
   *
   * @param event Event name.
   * @param data Data to send with the vent.
   */
  public emit(event: string, data: any): Promise<Array<void>> {
    const work = [];

    this.rooms.forEach(room => {
      work.push(
        this.client.send({
          event: 'event',
          param: {
            room,
            event,
            data,
          },
        }),
      );
    });

    return Promise.all(work);
  }

  /**
   * Add a new room, to filter the vent handler.
   *
   * @param room Room to filter.
   */
  public from(room: string): BuildEvent {
    return this.innerRoomAdd(room);
  }

  /**
   * Handle an event reception.
   *
   * @param event Event name.
   * @param handler Event handler.
   */
  public on(event: string, handler: () => void): BuildEvent {
    this.rooms.forEach(room => {
      this.client.on(`[${room}].${event}`, handler);
    });

    return this;
  }

  public off(event: string, handler: () => void): BuildEvent {
    this.rooms.forEach(room => {
      this.client.removeListener(`[${room}].${event}`, handler);
    });

    return this;
  }
}

export default class Stellar extends Primus {
  /**
   * Client identifier.
   */
  public id: string = null;

  /**
   * Client state.
   */
  private state: ClientState = ClientState.Disconnect;

  /**
   * Dictionary with all existing events.
   */
  private events = {};

  /**
   * Array of available rooms.
   */
  private rooms: Array<string> = [];

  /**
   * Number of sent messages.
   */
  private messageCount: number = 0;

  /**
   * Client options.
   */
  private options: any = {};

  /**
   * Informs if is to use an external client.
   */
  private useExternalClient: boolean = false;

  /**
   * External client.
   */
  private client = null;

  /**
   * Dictionary of callbacks.
   */
  private callbacks: any;

  private fingerprint: string;

  /**
   * Pending requests queue.
   */
  private pendingRequestsQueue: Array<Function>;

  constructor(options: any, client: any) {
    super();

    // Fill options with the default ones and after it
    // merge with the ones passed by parameter to allow
    // overwrite the default.
    this.options = {
      ...this.defaults(),
      ...options,
    };

    if (client) {
      this.client = client;
      this.useExternalClient = true;
    }

    // Print out an error when Promises aren't supported
    if (Promise === undefined || typeof Promise !== 'function') {
      error(
        `Th browser doesn't support Promises! You must load a polyfill before load Stellar client lib.`,
      );
    }
  }

  /**
   * Default options.
   */
  private defaults(): any {
    return '%%DEFAULTS%%';
  }

  private setEventHandler() {
    const promise = new Promise((resolve, reject) => {
      this.client.on('open', async () => {
        const details = await this.configure();

        if (this.state === ClientState.Connected) {
          this.state = ClientState.Connected;
          resolve(details);
        }

        this._emit('connected');
      });

      this.client.on('error', err => {
        reject(err);
        this._emit('error', err);
      });
    });

    this.client.on('reconnect', () => {
      this.messageCount = 0;
      this._emit('reconnect');
    });

    this.client.on('reconnecting', () => {
      this._emit('reconnecting');
      this.state = ClientState.Reconnecting;
      this._emit('disconnected');
    });

    this.client.on('timeout', () => {
      this.state = ClientState.Timeout;
      this._emit('timeout');
    });

    return promise;
  }

  public connect() {
    this.messageCount = 0;

    if (this.client && !this.useExternalClient) {
      this.client.end();
      this.client.removeAllListeners();
      this.client = Primus.connect(this.options.url, this.options);
    } else if (this.client && this.useExternalClient) {
      this.client.end();
      this.client.open();
    } else {
      this.client = Primus.connect(this.options.url, this.options);
    }

    return this.setEventHandler();
  }

  /**
   * Send a message.
   *
   * @param data Data to be sent.
   */
  public send(data: any): Promise<any> {
    return new Promise(resolve => {
      this.messageCount += 1;
      this.callbacks[this.messageCount] = resolve;
      this.client.write(data);
    });
  }

  public async configure(): Promise<ConnectionDetailsInterface> {
    if (this.options.rooms) {
      this.options.rooms.forEach(room => this.send({ event: 'roomAdd', room }));
    }

    const details = await this.detailsView();

    // Save connection information
    this.id = details.data.id;
    this.fingerprint = details.data.fingerprint;
    this.rooms = details.data.rooms;

    return details.data;
  }

  private _emit(event: string, data: any = null) {
    return _emit.call(this, event, data);
  }

  /**
   * Send an event to the server.
   *
   * @param event Event name.
   * @param data Data to send with the event. This can be optional.
   */
  public emit(event: string, data: any = null): Promise<void> {
    const room = this.options.defaultRoom;
    return this.send({ event: 'event', params: { event, room, data } });
  }

  /**
   * Request the details view.
   */
  public detailsView(): Promise<ConnectionDetailsResponse> {
    return this.send({ event: 'detailsView' }) as Promise<
      ConnectionDetailsResponse
    >;
  }

  /**
   * Process the next pending request if available.
   */
  public processNextPendingRequest(): void {
    if (this.pendingRequestsQueue.length === 0) {
      return;
    }

    const requestFn = this.pendingRequestsQueue.shift();

    requestFn();
  }

  /**
   * Send an event to a specific room.
   *
   * @param room Room name.
   */
  public to(room: string): BuildEvent {
    return new BuildEvent(room, this);
  }

  /**
   * Receive an event to a specific room.
   *
   * @param room Room name.
   */
  public from(room: string): BuildEvent {
    return new BuildEvent(room, this);
  }

  /**
   * Remove a listener for a given event.
   *
   * @param event Event name.
   * @param handler Listener to be removed.
   */
  public off(event: string, handler: Function) {
    return this.removeListener(event, handler);
  }

  /**
   * Send a message to a room.
   *
   * @param room Room name.
   * @param message Message to be sent.
   */
  public say(room: string, message: any): Promise<any[]> {
    if (message === undefined) {
      message = room;
      room = this.options.defaultRoom;
    }

    return this.to(room).emit('message', message);
  }

  /**
   * Make a file request.
   *
   * @param file File to be requested.
   */
  public file(file: string): Promise<any> {
    return this.send({ event: 'file', file });
  }

  /**
   * Request a room state.
   *
   * @param room Room name.
   */
  public roomView(room: string) {
    return this.send({ event: 'roomView', room });
  }

  /**
   * Join to a room.
   *
   * @param room Room name.
   */
  public async join(room: string): Promise<ConnectionDetailsInterface> {
    await this.send({ event: 'roomJoin', room });
    return this.configure();
  }

  /**
   * Leave a room.
   *
   * @param room Name of the room to be left.
   */
  public async leave(room: string) {
    const index = this.rooms.indexOf(room);

    if (index > -1) {
      this.rooms.splice(index, 1);
    }

    await this.send({ event: 'roomLeave', room });

    return this.configure();
  }

  /**
   * Disconnect the client from the server.
   */
  public disconnect() {
    this.state = ClientState.Disconnect;
    this.client.end();
    this._emit('disconnected');
  }
}
