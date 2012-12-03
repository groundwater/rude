var util = require('util')

require('colors')

function write(header,args){
	var message = util.format.apply(null,args)
	console.log(header,message)
}

function Info(){
	write('[INFO]'.cyan, arguments)
}

function Error(){
	write('[FAIL]'.red, arguments)
}

function Warn(){
	write('[WARN]'.yellow, arguments)
}

function Okay(){
	write('[OKAY]'.green, arguments)
}

function Done(){
	write('[DONE]'.blue, arguments)
}

module.exports.Info  = Info
module.exports.Warn  = Warn
module.exports.Okay  = Okay
module.exports.Done  = Done
module.exports.Error = Error
