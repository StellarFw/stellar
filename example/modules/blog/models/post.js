'use strict'

exports.default = {
  primaryKey: 'id',

  attributes: {
    id: {
      type: 'number',
      autoMigrations: {
        autoIncrement: true,
      },
    },
    title: {
      type: 'string',
    },
    content: {
      type: 'string',
    },
  },
};
