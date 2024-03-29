export const modTest = {
  name: "modTest",
  description: "This action is used to test the action metadata manipulation",

  outputExample: {
    result: "OK",
  },

  run(api, action, next) {
    action.response.result = action.actionTemplate.modProp;
    next();
  },
};

export const groupTest = {
  name: "groupTest",
  description:
    "This action is used to test the group definition directly on the action",

  // this is the property that are under testing, this can't be changed without
  // pay attention to other files.
  group: "example",

  outputExample: {
    result: "OK",
  },

  run(api, action, next) {
    action.response.result = action.actionTemplate.modProp;
    next();
  },
};

export const groupAddItems = {
  name: "groupAddItems",
  description: "This action is used to test the modification system",

  // this is the property that are under testing, this can't be changed without
  // pay attention to other files.
  group: "example",

  customProp: ["a", "b"],

  outputExample: {
    result: "OK",
  },

  run(api, action, next) {
    action.response.result = action.actionTemplate.customProp;
    next();
  },
};

export const groupRmItems = {
  name: "groupRmItems",
  description: "This action is used to test the modification system",

  // this is the property that are under testing, this can't be changed without
  // pay attention to other files.
  group: "example",

  customProp2: ["a", "b"],

  outputExample: {
    result: "OK",
  },

  run(api, action, next) {
    action.response.result = action.actionTemplate.customProp2;
    next();
  },
};
