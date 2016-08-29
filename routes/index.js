/**
 * 扫码客户端和路由器必须在同一个局域网，应用必须运行在另一个网段
 */
var express = require('express');
var router = express.Router();
var request = require('request');
var fs = require('fs');
var path = require('path');

var ip = null;
function setIp(_ip){
	ip = _ip;
}
/**
 * 显示二维码主页
 */
router.get('/', function(req, res, next) {
	res.render('index');
});

/**
 * 更新公司ip
 */
router.get('/updateIp', function (req, res, next) {
	var _ip = ip6to4(req.ip);
	//检查是否是公司路由器请求
	var userAgent = req.headers['user-agent'];
	if(userAgent != 'openwrt-caitian'){
		return res.send('error');
	}
	if(_ip == '192.168.1.1'){
		setIp(_ip);
	}else{
		var inspect = 'http://ip.taobao.com/service/getIpInfo.php?ip=' + _ip;
		request.get(inspect, function (err, data) {
			if(err){
				return console.log(err);
			}
			var info = JSON.parse(data.body).data;
			if(info.city_id == '500100' && info.isp_id == '100026'){
				setIp(_ip);
			}
		});
	}
	res.send('success');
});

/**
 * 签到
 */
router.post('/signin/:id', function (req, res, next) {
	if(!ip) {
		return res.send('公司wifi是否正常工作');
	}
	if(ip6to4(req.ip) != ip){
		return res.send('连接到公司wifi扫码');
	}
	var id = req.params.id;
	var deviceInfo = req.body.deviceInfo;
	var name = id.split('*')[0];
	User.findByName(name, function (err, user) {
		if(err){
			err.message = '用户查询失败';
			next(err);
		}else{
			if(!user){
				User.create(id, name, deviceInfo, function (err) {
					if(err){
						err.message = '用户注册失败';
						next(err);
					}else{
						_signin();
					}
				});
			}else{
				//检查信息一致
				if(id != user.id){
					return res.send('id错误，联系管理员');
				}
				for(var k in user.deviceInfo){
					if(user.deviceInfo[k] != deviceInfo[k]){
						return res.send('设备信息错误，联系管理员');
					}
				}
				_signin();
			}
			function _signin() {
				Signinlog.create(id, function (err) {
					if(err){
						err.message = '签到失败';
						next(err);
					}else{
						res.send('success !!!');
					}
				});
			}
		}
	});
});

router.get('/listSigninLog', function (req, res, next) {
	Signinlog.list(function (err, logs) {
		if(err){
			next(err);
		}else{
			res.json(logs);
		}
	});
});

function ip6to4(ip6){
	return ip6.replace('::ffff:', '');
}

var paths = {
	users: path.join(__dirname, '../users'),
	signinlog: path.join(__dirname, '../signinlog')
}
var User = {
		create: function (id, name, deviceInfo, cb) {
			appendToFile(paths.users, [id, name, JSON.stringify(deviceInfo), Date.now()], cb);
		},
		list: function (cb) {
			readFromFile(paths.users, function (err, users) {
				if(err){
					cb(err);
				}else{
					users.forEach(function (o) {
						o.deviceInfo = JSON.parse(o.deviceInfo);
						o.registerTime = new Date(+o.registerTime);
					});
					cb(null, users);
				}
			});
		},
		findByName: function (name, cb) {
			User.list(function (err, users) {
				if(err){
					cb(err);
				}else{
					for(var i in users){
						if(users[i].name == name){
							return cb(null, users[i]);
						}
					}
					cb(null, null);
				}
			});
		}
	},
	Signinlog = {
		create: function (id, cb) {
			appendToFile(paths.signinlog, [id, Date.now()], cb);
		},
		list: function (cb) {
			readFromFile(paths.signinlog, function (err, logs) {
				if(err){
					cb(err);
				}else{
					logs.forEach(function (o) {
						o.time = new Date(+o.time);
					});
					cb(null, logs);
				}
			});
		}
	};

function appendToFile(path, data, cb){
	var str = '\n' + data.join('\t');
	fs.appendFile(path, str, function (err) {
		cb(err);
	});
}

function readFromFile(path, cb){
	fs.readFile(path, function (err, data) {
		if(err){
			cb(err);
		}else{
			data = data.toString();
			var formatted = data.split('\n').reduce(function (out, line, i) {
				var words = line.split('\t');
				if(i == 0){
					out.fields = words;
				}else{
					var obj = {};
					out.fields.forEach(function (field, i) {
						obj[field] = words[i];
					});
					out.push(obj);
				}
				return out;
			}, []);
			cb(null, formatted);
		}
	});
}

module.exports = router;
