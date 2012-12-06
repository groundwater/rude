var Path = require('path')
var fs   = require('fs')

function gitroot(path_raw){
	
	var path = Path.resolve(path_raw)
	
	if(path == '/') throw "No Git Root Found"
	
	var root = Path.join(path,'.git')
	
	if(fs.existsSync(root)) {
		return path
	}else{
		return gitroot( Path.dirname(path) )
	}
	
}

if(!module.parent){
	try{
		var root = gitroot(process.argv[2] || '.')
		console.log('Git Root Exists at %s',root)
	}catch(e){
		console.log('No Git Root Found')
	}
}

module.exports.gitroot = gitroot
