"use strict";

/**
 * This is just an example to show the usage of a listener.
 */
exports.example = {
  event: "example",

  async run(params) {
    return { ...params, value: "thisIsATest" };
  },
};
