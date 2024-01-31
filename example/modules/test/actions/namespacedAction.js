export const status = {
  name: "isolated.action",
  description: "This is an example of a namespaced action",

  outputExample: {
    success: "ok",
  },

  run: (api, action, next) => {
    action.response.success = "ok";
    next();
  },
};
