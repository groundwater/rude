var fs   = require('fs')

var rude = require('../index').config()

console.log(rude('app.js'))
console.log(rude('package.json'))
