/**
 * This is just an example to show the usage of a listener.
 */
export default {
  event: "example",

  async run(params) {
    return { ...params, value: "thisIsATest" };
  },
};
