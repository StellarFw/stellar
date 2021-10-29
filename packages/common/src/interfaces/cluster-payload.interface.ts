export default interface ClusterPayload {
  /**
   * Message type.
   */
  messageType: string;

  /**
   * Server identifier.
   */
  serverId: string;

  /**
   * Server token.
   */
  serverToken: string;

  /**
   * Unique request identifier.
   */
  requestId: string;

  connectionId?: string;

  /**
   * Method to be executed by the cluster member.
   */
  method?: string;

  /**
   * Arguments to be passed into the method.
   */
  args?: string | number | Array<any>;

  /**
   * Optionally a response can be sent with the payload.
   */
  response?: any;
}
