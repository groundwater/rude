var util    = require('util')

var rude    = require('../index').config()
var express = require('express')
var app     = express()

var PORT    = process.env.PORT

app.get('/',function(req,res){
	var img = util.format('<img src="%s">',rude('momo.png'))
	res.write('<!DOCTYPE html>')
	res.write(img)
	res.end()
})

app.use(express.static(__dirname + '/public'));

app.listen(PORT || 8888)

console.log('Express Server Listening on Port: %d',PORT)
