#!/usr/bin/env node

var fs      = require('fs')
var cp      = require('child_process')
var crypto  = require('crypto');
var Path    = require('path')
var util    = require('util')

var program = require('commander')
var nano    = require('nano');

var rude    = require('../index')
var log     = require('../lib/log')
var git     = require('../lib/git')

function connect(host,port,database){
	var url = util.format('http://%s:%s/%s',host,port,database)
	var db  = nano(url)
	return db
}

function strip(path){
	var paths = path.split('/')
	
	if(paths.length==1) return path
	
	return paths.pop()
}

var assetfile
try{
	assetfile = Path.join(git.gitroot('.'),'assets.json')
	log.Info('Found Asset File',assetfile)
}catch(e){
	log.Warn('No Git Repository Found')
	assetfile = 'asset.json'
}

program.version('0.0.0');
program.option('-n, --name      <NAME>' , 'use database NAME'    ,'rude')
program.option('-H, --host      <HOST>' , 'connect to host NAME' ,'localhost')
program.option('-p, --port      <PORT>' , 'connect to port PORT' ,5984)
program.option('-m, --manifest  <FILE>' , 'track assets in manifest FILE' , assetfile)

program
.command('init')
.description('Initialize a new Rude database')
.action(function(command){
	
	nano('http://' + program.host + ':' + program.port ).db.create(program.name)
	
	var file
	try{
		file = fs.readFileSync(program.manifest)
	}catch(e){
		file = "{}"
	}
	
	try{
		var json = JSON.parse(file)
		fs.writeFileSync(program.manifest,JSON.stringify(json,null,'\t'))
		log.Info('Asset Manifest at %s',program.manifest)
		log.Okay('New Rude database initialized')
	}catch(e){
		log.Error('Asset File Exists and is Invalid')
	}
	
	
})

function insert(db, doc,id,name,data,json,hash,file){
	db.insert(doc, id, function(err,res){
		
		if(err && err.error=='conflict'){
			
			log.Info('Asset Already in Database')
			
			json[name] = hash
			fs.writeFileSync(file, JSON.stringify(json,null,'\t'))
			
			log.Okay('Asset Added to Manifest')
			
		} else if(err && err.error != 'conflict') {
			return log.Error('Asset Conflict! Use `rude add -f %s` to Overwrite',name)
		} else {
		
			var type = 'text/plain'
			var opts = {
				rev: res.rev
			}
		
			db.attachment.insert(id, name, data, type, opts, function(err,ok){
				if(err) return log.Error(err)
			
				log.Okay('Asset Added:',name)
			
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
	if(asset == 'assets.json') return log.Error('Cannot Track Asset File')
	if(arguments.length != 2 ) return log.Error('Please Specify an Asset to Track')
	
	var db     = connect(program.host,program.port,program.name)
	
	var name   = command.name || strip(asset)
	var shasum = crypto.createHash('sha1');
	
	if(!fs.existsSync(asset)) return log.Error('Nothing Exists at `%s`',asset)
	
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
				return log.Error(err)
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
	
	if(!command) return log.Error('Please Specify a Remote URL for Replication')
	
	var db   = connect(program.host,program.port,program.name)
	var opts = {
		connection_timeout: 1000,
		create_target: true
	}
	
	var res = db.replicate(url,opts,function(err){
		if(err) return log.Error('Replication Error:', err.error)
		
		log.Info('Replication Complete')
	})
})

program
.command('pull')
.usage('REMOTE_URL')
.description('Pull remote changes into your local database')
.action(function(url,command){
	
	if(!command) return log.Error('Please Specify a Remote URL for Synchronization')
	
	var db   = nano('http://' + program.host + ':' + program.port).db
	var opts = {
		connection_timeout: 1000,
		create_target: true
	}
	
	var res = db.replicate(url,program.name,opts,function(err){
		if(err) return log.Error('Replication Error:', err.error)
		
		log.Info('Replication Complete')
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
	'  rude publish s3://region/bucket',
	'  rude publish ssh://server/path',
	'',
	'Amazon S3 publish requires the ENV variables AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY'
].join('\n  '))
.description('Publish your assets to a production environment')
.action(function(url,command){
	
	if(!command) {
		log.Error('Please Specify a Publishable URL')
		log.Info('For SSH use ssh://server-name:relative/path or ssh://server-name:/absolute/path')
		log.Info('For Amazon S3 use s3://region/bucket-name,')
		log.Info(' - ensure to set the AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY environment variables')
		return
	}
	
	var db   = connect(program.host,program.port,program.name)
	var file = fs.readFileSync(program.manifest)
	var json = JSON.parse(file)
	
	var cons = url.split('://')
	var prot = cons[0]
	var dest = cons[1]
	
	if(!dest) return log.Error('Invalid URL, see `rude -h` for more info')
	
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
	
	var i=0
	for(name in json){
		
		log.Info("%s --> %s", pad(name,20), rude_(name))
		i++
		
	}
	
	log.Done('Total %d Assets',i)
	
})

program
.command('open')
.description('Open an asset in your browser')
.action(function(name,command){
	
	if(!command) return log.Error('Please Specify an Asset to Open')
	
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
	
	log.Info('Use `rude purge %s` to Permenantly Delete Asset from Database',name)
	log.Okay('Asset %s Removed from Manifest',name)
	
})

if(process.argv[2] == 'ls') process.argv[2] = 'list'

program.parse(process.argv)

if(program.args.length==0) {
	console.log('      ____  __  ______  ______'.red)
	console.log('     / __ \\/ / / / __ \\/ ____/'.red)
	console.log('    / /_/ / / / / / / / __/   '.red)
	console.log('   / _  _/ /_/ / /_/ / /___   '.red)
	console.log('  /_/ |_|\\____/_____/_____/   '.red)
	program.help();
}








