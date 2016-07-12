'use strict'

module.exports = [ {
  name: 'createPost',
  description: 'Create a new post',

  inputs: {
    title: {required: true},
    content: {required: true}
  },

  run: function (api, action, next) {
    var Post = api.models.get('post')

    var newPost = new Post(action.params)

    // newPost.create('post', params, callback)

    newPost.save(function (err) {
      if (err) {
        // return an error message to the client
        next(new Error('We can create that resource!'))
      } else {
        // put the new post available to the response object
        action.response.post = newPost

        // finish the action execution
        next()
      }
    })
  }
}, {
  name: 'getPosts',
  description: 'Get all posts',

  run: function (api, action, next) {
    api.models.get('post').find({}, function (err, posts) {
      action.response.posts = posts
      next()
    })
  }
},
  {
    name: 'getPost',
    description: 'Get a post',

    inputs: {
      id: {required: true}
    },

    run: function (api, action, next) {
      // search for the request post on the DB
      api.models.get('post').findById(action.params.id, function (err, post) {
        // put post information in response object
        action.response.post = post

        // finish the action execution
        next()
      })
    }
  } ]
