"use strict";

/**
 * This example show how to subscribe to multiple events and execute the same handler.
 */
exports.default = {
  event: ["multiple", "multiple_two"],
  description: `This event is used to test the multiple event support`,

  async run(params) {
    return {
      ...params,
      value: `${params.value}_mod`,
    };
  },
};
