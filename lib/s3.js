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
	
	async.forEach(Object.keys(config),function(name,done){
		var hash = config[name]
		db.getAttachment(hash,name,function(err,attachment){
			
			var path = "/" + hash + '/' + name
			var headers = {
				"Content-Length": attachment.headers["content-length"],
				"Content-Type"  : attachment.headers["content-type"]
			}
			
			var req  = client.put(path,headers)
			
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
			req.end(attachment.body)
			
		})
	},function(res){
		console.log('Done')
	})
	
}

module.exports.publish = publish
