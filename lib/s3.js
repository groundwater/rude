var util  = require('util')

var async = require('async')
var knox  = require('knox')

function publish(config,db,url){
	
	var cons = url.split('/')
	var head = cons.shift()
	var tail = cons.join('/')
	
	var AWS_S3_KEY    = process.env.AWS_S3_KEY
	var AWS_S3_SECRET = process.env.AWS_S3_SECRET
	
	if(!AWS_S3_KEY) return console.error('[FAIL] Please Set AWS_S3_KEY')
	if(!AWS_S3_SECRET) return console.error('[FAIL] Please Set AWS_S3_SECRET')
	
	var opts = {
		key    : AWS_S3_KEY,
		secret : AWS_S3_SECRET,
		bucket : head,
		region : 'us-west-2'
	}
	
	var client = knox.createClient(opts)
	var head
	
	console.log('[INFO] Uploading to S3')
	
	async.forEach(Object.keys(config),function(name,done){
		var hash = config[name]
		db.attachment.get(hash,name,function(err,body){
			if(err) return console.error('[WARN] ',err)
			
			var path = "/" + hash + '/' + name
			var headers = {
				"Content-Length": body.length,
				"Content-Type"  : 'text/plain',
				'x-amz-acl'     : 'public-read'
			}
			
			var req  = client.put(path,headers)
			var url  = req.url
			
			var li   = url.indexOf(path)
			
			head = url.substr(0,li)
			
			req.on('response',function(res){
				if(res.statusCode == 200) {
					console.log('  √',name)
					done()
				}else{
					console.error('[FAIL] Failed to Upload to S3')
					console.error('[FAIL] Status Code %d',res.statusCode)
					done(res)
				}
			})
			req.end(body)
			
		})
	},function(res){
		console.log('[DONE] Use environment variable RUDE_PREFIX=%s',head)
	})
	
}

module.exports.publish = publish
