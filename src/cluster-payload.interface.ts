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
  requestId: number;

  connectionId: string;

  /**
   * Method to be executed by the cluster member.
   */
  methods: string;

  /**
   * Arguments to be passed into the method.
   */
  args: Array<any>;
}
