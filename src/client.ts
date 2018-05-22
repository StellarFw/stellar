import * as Primus from 'primus';

const warn = msg => console.warn(`[StellarClient warn]: ${msg}`);
const error = msg => console.error(`[StellarClient error]: ${msg}`);
const isFunction = val => typeof val === 'function';
const isObject = obj => obj !== null && typeof obj === 'object';

enum ClientState {
  Disconnect,
  Connected,
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
  private rooms = [];

  /**
   * Number of sent messages.
   */
  private messageCount: number = 0;

  /**
   * Client options.
   */
  private options = {};

  /**
   * Informs if is to use an external client.
   */
  private useExternalClient: boolean = false;

  /**
   * External client.
   */
  private client = null;

  constructor(options: any, client: any) {
    super();

    this.options = {
      ...options,
    };

    if (client) {
      this.client = client;
      this.useExternalClient = true;
    }
  }
}
