var util  = require('util')

var async = require('async')
var knox  = require('knox')

var log   = require('./log')

function publish(config,db,url){
	
	var cons   = url.split('/')
	var region = cons.shift()
	var bucket = cons.shift()
	
	var AWS_S3_KEY    = process.env.AWS_S3_KEY
	var AWS_S3_SECRET = process.env.AWS_S3_SECRET
	
	var need_credentials = false
	if(!AWS_S3_KEY)    {
		need_credentials = true
		log.Error('Please Set Environment Variable AWS_S3_KEY')
	}
	if(!AWS_S3_SECRET) {
		need_credentials = true
		log.Error('Please Set Environment Variable AWS_S3_SECRET')
	}
	
	if(need_credentials){
		return log.Info('AWS Credentials https://portal.aws.amazon.com/gp/aws/securityCredentials')
	}
	
	log.Info('Connecting to Region:'    ,region)
	log.Info('Connecting with User Key:',AWS_S3_KEY)
	
	var opts = {
		key    : AWS_S3_KEY,
		secret : AWS_S3_SECRET,
		region : region,
		bucket : bucket
	}
	
	var client = knox.createClient(opts)
	var head
	
	log.Info('Beginning Upload …')
	
	async.forEach(Object.keys(config),function(name,done){
		var hash = config[name]
		db.attachment.get(hash,name,function(err,body){
			if(err) return log.Error('',err)
			
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
					log.Info('  √',name)
					done()
				}else{
					var code = res.statusCode
					if(code==404){
						log.Error('Bucket `%s` Not Found',bucket)
					}else if(code==307){
						log.Error('Upload Error, Please Check that Your AWS Bucket Agrees with Your Region')
					}else{
						log.Error('Status Code %d',code)
					}
					
					done(code)
				}
			})
			req.end(body)
			
		})
	},function(err){
		if(err) return log.Error('Amazon S3 Upload Failed')
		log.Okay('Upload Complete')
		log.Info('Use environment variable RUDE_PREFIX=%s',head)
	})
	
}

module.exports.publish = publish
