var fs = require('fs')

function join(){
	var out = []
	for(var i in arguments){
		out.push( arguments[i] )
	}
	return out.join('/')
}

module.exports.config = function(prefix,config){
	
	var resolved_prefix
	var resolved_config
	
	if(prefix) {
		resolved_prefix = prefix
	}else{
		resolved_prefix = (
			process.env.RUDE_PREFIX || 'http://localhost:5984/rude'
		)
	}
	
	if(config) {
		resolved_config = config
	}else{
		var assets_file = process.env.RUDE_ASSETS_FILE || 'assets.json'
		
		var stat = fs.existsSync(assets_file)
		
		var file
		if(stat){
			file = fs.readFileSync(assets_file)
			try{
				resolved_config = JSON.parse(file)
			}catch(e){
				console.warn('[WARN] Assets File %s Courrupted',assets_file)
				resolved_config = {}
			}
		}else{
			console.warn('[WARN] No Assets File Found (%s)',assets_file)
			resolved_config = {}
		}
		
	}
	
	return function(asset){
		var hash = resolved_config[asset]
		if(hash){
			return join(resolved_prefix,hash,asset)
		}else{
			console.error('Missing Asset %s',asset)
			return asset
		}
	}
}

