exports.randomNumber = {
    name: 'randomNumber',
    description: 'Generate a random number',
    outputExample: {
        number: 0.40420848364010453
    },

    run: function(api, data, next) {
        // generate a random number
        var number = Math.random()

        // save the generated number on the response property
        data.response.number = number

        // return a formatted string
        data.response.formatedNumber = 'Your random number is ' + number

        // finish the action execution
        next()
    }
}

