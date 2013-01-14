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

function Data(){
    write('%s'.grey, arguments)
}

module.exports.Info  = Info
module.exports.Warn  = Warn
module.exports.Okay  = Okay
module.exports.Error = Error
module.exports.Data  = Data
