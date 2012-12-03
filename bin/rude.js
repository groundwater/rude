#!/usr/bin/env node

var fs      = require('fs')
var cp      = require('child_process')
var crypto  = require('crypto');
var Path    = require('path')
var util    = require('util')

var program = require('commander')
var nano    = require('nano');

var rude    = require('../index')

function connect(host,port,database){
	var url = util.format('http://%s:%s/%s',host,port,database)
	console.log(url)
	var db  = nano(url)
	return db
}

function Error(){
	console.error.apply(this,arguments)
}

function strip(path){
	var paths = path.split('/')
	
	if(paths.length==1) return path
	
	return paths.pop()
}

program.version('0.0.0');
program.option('-n, --name      <NAME>' , 'use database NAME'    ,'rude')
program.option('-H, --host      <HOST>' , 'connect to host NAME' ,'localhost')
program.option('-p, --port      <PORT>' , 'connect to port PORT' ,5984)
program.option('-m, --manifest  <FILE>' , 'track assets in manifest FILE' ,'assets.json')

program
.command('init')
.description('Initialize a new Rude database')
.action(function(command){
	connect(program.host,program.port,program.name).create()
	
	var file
	try{
		file = fs.readFileSync(program.manifest)
	}catch(e){
		file = "{}"
	}
	
	try{
		var json = JSON.parse(file)
		fs.writeFileSync(program.manifest,JSON.stringify(json))
		console.log('[OKAY] New Rude database initialized')
		console.log('[OKAY] Asset Manifest at %s',program.manifest)
	}catch(e){
		console.error('[FAIL] Asset File Exists and is Invalid')
	}
	
	
})

function insert(db, doc,id,name,data,json,hash,file){
	db.insert(doc, id, function(err,res){
		
		if(err && err.error=='conflict'){
			
			console.log('[INFO] Asset Already in Database')
			
			json[name] = hash
			fs.writeFileSync(file, JSON.stringify(json,null,'\t'))
			
			console.log('[INFO] Asset Added to Manifest')
			
		} else if(err && err.error != 'conflict') {
			return Error('Asset Conflict! Use `rude add -f %s` to Overwrite',name)
		} else {
		
			var type = 'text/plain'
			var opts = {
				rev: res.rev
			}
		
			db.attachment.insert(id, name, data, type, opts, function(err,ok){
				if(err) return Error(err)
			
				console.log('Asset Added:',name)
			
				json[name] = hash
				fs.writeFileSync(file, JSON.stringify(json,null,'\t'))
			
			})
			
		}
		
	})
}

program
.command('add')
.option('-n, --name <NAME>', 'track asset using NAME', null)
.option('-f, --force'      , 'force update')
.description('Track a new asset in the local database')
.action(function(asset,command){
	if(asset == 'assets.json') return Error('Cannot Track Asset File')
	if(arguments.length != 2 ) return Error('Incorrect Usage')
	
	var db     = connect(program.host,program.port,program.name)
	
	var name   = command.name || strip(asset)
	var shasum = crypto.createHash('sha1');
	
	var data   = fs.readFileSync(asset)
	var json
	try{
		json   = JSON.parse(fs.readFileSync(program.manifest))
	}catch(e){
		json   = {}
	}
	var hash   = shasum.update(data).digest('hex')
	
	var extn   = Path.extname(asset)
	var path   = name
	
	var id = hash
	
	if(command.force){
		doc = db.get(id, function(err,doc){
			if(err && err.status_code == 404){
				doc = {}
			}else if(err){
				return Error(err)
			}
			
			insert(db,doc,id,name,data,json,hash,program.manifest)
		})
	}else{
		insert(db,{},id,name,data,json,hash,program.manifest)
	}
	
})

program
.command('push')
.usage('REMOTE_URL')
.description('Replicate your local database to URL')
.action(function(url,command){
	
	if(!command) return Error('Invalid Usage')
	
	var db   = connect(program.host,program.port,program.name)
	var opts = {
		connection_timeout: 1000,
		create_target: true
	}
	
	var res = db.replicate(url,opts,function(err){
		if(err) return Error('Replication Error:', err.error)
		
		console.log('[DONE] Replication Complete')
	})
})

program
.command('pull')
.usage('REMOTE_URL')
.description('Pull remote changes into your local database')
.action(function(url,command){
	
	if(!command) return Error('Invalid Usage')
	
	var db   = nano('http://' + program.host + ':' + program.port).db
	var opts = {
		connection_timeout: 1000,
		create_target: true
	}
	
	var res = db.replicate(url,program.name,opts,function(err){
		if(err) return Error('Replication Error:', err.error)
		
		console.log('[DONE] Replication Complete')
	})
})

var publishers = {
	'git': require('../lib/ssh').publish,
	's3' : require('../lib/s3').publish
}

program
.command('publish')
.usage([
	'REMOTE_URL',
	'',
	'Rude accepts ssh, http, and s3 URLs:',
	'',
	'  rude publish s3://bucket',
	'  rude publish ssh://server/path',
	'  rude publish http://server/path',
	'',
	'Amazon S3 publish requires the ENV variables AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY'
].join('\n  '))
.description('Publish your assets to a production environment')
.action(function(url,command){
	
	if(!command) return Error('Invalid Usage')
	
	var db   = connect(program.host,program.port,program.name)
	var file = fs.readFileSync(program.manifest)
	var json = JSON.parse(file)
	
	var cons = url.split('://')
	var prot = cons[0]
	var dest = cons[1]
	
	if(!dest) return Error('Invalid URL, see `rude -h` for more info')
	
	publishers[prot]( json, db, dest )
	
})

function pad(string,min){
	var out = string
	for(var i=string.length; i<min; i++){
		out += ' '
	}
	return out
}

program
.command('list')
.description('List assets in your manifest')
.action(function(command){
	
	var db   = connect(program.host,program.port,program.name)
	var file = fs.readFileSync(program.manifest)
	var json = JSON.parse(file)
	
	var rude_ = rude.config()
	
	for(name in json){
		
		console.log("%s --> %s", pad(name,20), rude_(name))
		
	}
	
})

program
.command('open')
.description('Open an asset in your browser')
.action(function(name,command){
	
	if(!command) return Error('Invalid Usage')
	
	var rude_ = rude.config()
	
	var exec_command = util.format( 'open "%s"', rude_(name) )
	
	cp.exec(exec_command)
	
})

program
.command('rm')
.description('Remove an asset from your manifest')
.action(function(name,command){
	
	var manifest = JSON.parse( fs.readFileSync(program.manifest) )
	delete manifest[name]
	
	fs.writeFileSync(program.manifest, JSON.stringify(manifest))
	
	console.log('[INFO] Asset %s Removed from Manifest',name)
	console.log('[INFO] Use `rude purge %s` to Permenantly Delete Asset from Database',name)
	
})

if(process.argv[2] == 'ls') process.argv[2] = 'list'

program.parse(process.argv)

if(program.args.length==0) {
	program.help();
}








