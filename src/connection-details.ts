export default interface ConnectionDetails {
  /**
   * Connection type.
   */
  type: string;

  /**
   * Unique connection identifier.
   */
  id: string;

  /**
   * Connection fingerprint.
   *
   * This is used to uniquely identify connections.
   */
  fingerprint: string;

  /**
   * Remote connection port.
   */
  remotePort: number;

  /**
   * Remote connection string.
   */
  remoteIP: string;

  /**
   * Raw connection details.
   */
  rawConnection: any;

  /**
   * Flag to know if the connection supports chat.
   */
  canChat: boolean;
};
