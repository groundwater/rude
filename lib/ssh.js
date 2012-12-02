var ut = require('util')
var pp = require('path')
var cp = require('child_process')
var fs = require('fs')

var async = require('async')

require('colors')

function dump(config,db,dir,done){
	fs.mkdirSync( dir )
	console.log('[INFO]'.cyan,'Dumping Content to Temporary Directory',dir)
	async.forEach(Object.keys(config),function(name,done){
		var hash = config[name]
		db.getAttachment(hash, name, function(err,data){
			if(err) return console.error('[FAIL]'.red,err)
			
			var hash_path = pp.join(dir,hash)
			var file_path = pp.join(hash_path,name)
			
			fs.mkdirSync(hash_path)
			fs.writeFileSync(file_path,data.body)
			
			console.log('[INFO]'.cyan,'√'.green ,name)
			done(err)
		})
	},done)
}

function upload(dir,loc,path,done){
	
	console.log('[INFO]'.cyan,'Uploading Contents to Remote Host',loc)
	
	var tar_make = ut.format('tar -zc -C %s .' ,dir)
	var tar_exec = ut.format('tar -zx -C %s'   ,path)
	var dir_make = ut.format('mkdir -p %s'     ,path)
	var cpy_exec = ut.format('%s | ssh %s "%s && %s"',
		tar_make,
		loc,
		dir_make,
		tar_exec)
	
	cp.exec(cpy_exec,function(err,stdout,stderr){
		if(err) return console.error('[FAIL]'.red,err)
		done(err)
	})
	
}

function publish(config,db,url){
	
	var cons = url.split(':')
	var head = cons[0]
	var tail = cons[1]
	
	if(tail=='') tail = "."
	
	var temp_dir = '/tmp/rude-' + Date.now()
	
	dump(config,db,temp_dir,function(){
		upload(temp_dir,head,tail,function(err){
			console.log('[OKAY]'.green,'Done!')
		})
	})
	
}

module.exports.publish = publish
