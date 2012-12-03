#!/usr/bin/env node

var fs      = require('fs')
var crypto  = require('crypto');
var Path    = require('path')

var program = require('commander')
var cradle  = require('cradle');

function connect(host,port,database){
	return new(cradle.Connection)(host,port).database(database)
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
program.option('-n, --name  <NAME>' , 'use database NAME'    ,'rude')
program.option('-H, --host  <HOST>' , 'connect to host NAME' ,'http://localhost')
program.option('-p, --port  <PORT>' , 'connect to port PORT' ,5984)
program.option('-f, --file  <FILE>' , 'track assets in file FILE' ,'assets.json')

program
.command('init')
.description('Initialize a new Rude database')
.action(function(command){
	connect(program.host,program.port,program.name).create()
	
	var file
	try{
		file = fs.readFileSync(program.file)
	}catch(e){
		file = "{}"
	}
	
	try{
		var json = JSON.parse(file)
		fs.writeFileSync(program.file,JSON.stringify(json))
		console.log('[OKAY] New Rude database initialized')
		console.log('[OKAY] Asset Manifest at %s',program.file)
	}catch(e){
		console.error('[FAIL] Asset File Exists and is Invalid')
	}
	
	
})

program
.command('add')
.option('-n, --name <NAME>', 'track asset using NAME', null)
.description('Track a new asset in the local database')
.action(function(asset,command){
	if(asset == 'assets.json') return Error('Cannot Track Asset File')
	if(arguments.length != 2 ) return Error('Incorrect Usage')
	
	var db     = connect(program.host,program.port,program.name)
	
	var name   = command.name || strip(asset)
	var shasum = crypto.createHash('sha1');
	
	var file   = fs.readFileSync(asset)
	var json
	try{
		json   = JSON.parse(fs.readFileSync(program.file))
	}catch(e){
		json   = {}
	}
	var hash   = shasum.update(file).digest('hex')
	
	var extn   = Path.extname(asset)
	var path   = name
	
	var attachment = {
		name : path,
		body : file
	}
	
	var id = hash
	
	db.save(id, {}, function(err,res){
		if(err) return Error(err)
		
		db.saveAttachment(res,attachment,function(err,ok){
			if(err) return Error(err)
			console.log('Asset Added:',name)
			
			json[name] = hash
			fs.writeFileSync(program.file, JSON.stringify(json,null,'\t'))
			
		})
		
	})
	
})

program
.command('push')
.usage('REMOTE_URL')
.description('replicate your local database to URL')
.action(function(url,command){
	var db   = connect(program.host,program.port,program.name)
	var opts = {
		connection_timeout: 1000
	}
	var res = db.replicate(url,opts,function(err){
		if(err) return Error('Replication Error:', err.error)
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
.action(function(url,command){
	
	if(!command) return Error('Invalid Usage')
	
	var db   = connect(program.host,program.port,program.name)
	var file = fs.readFileSync(program.file)
	var json = JSON.parse(file)
	
	var cons = url.split('://')
	var prot = cons[0]
	var dest = cons[1]
	
	if(!dest) return Error('Invalid URL, see `rude -h` for more info')
	
	publishers[prot]( json, db, dest )
	
})

program.parse(process.argv)

if(program.args.length==0) {
	program.help();
}








