var WebSocketServer = require('ws').Server;
var uuidv4 = require('uuid/v4');
var events = require('events');
var util = require('util');
var errorCb = function(rtc) {
	return function(error) {
		if (error) {
			rtc.emit("error", error);
		}
	};
};

function SkyRTC() {
	this.sockets = [];
	this.rooms = {};
	this.on('__join', function(data, socket) {
		console.log(this.sockets.length);
		var ids = [],
			i, m,
			room = data.room || "__default",
			windowId = data.windowId || "__default",
			curSocket,
			curRoom;

		var windowIds = {};

		socket.windowId = windowId;

		curRoom = this.rooms[room] = this.rooms[room] || [];

		for (i = 0, m = curRoom.length; i < m; i++) {
			curSocket = curRoom[i];
			if (curSocket.id === socket.id) {
				continue;
			}
			ids.push(curSocket.id);
			windowIds[curSocket.id] = curSocket.windowId;
			curSocket.send(JSON.stringify({
				"eventName": "_new_peer",
				"data": {
					"socketId": socket.id,
					"windowId": socket.windowId
				}
			}), errorCb);
		}

		curRoom.push(socket);
		socket.room = room;

		socket.send(JSON.stringify({
			"eventName": "_peers",
			"data": {
				"connections": ids,
				"windowIds": windowIds,
				"you": socket.id
			}
		}), errorCb);

		this.emit('new_peer', socket, room);
	});

	this.on('__ice_candidate', function(data, socket) {
		var soc = this.getSocket(data.socketId);

		if (soc) {
			soc.send(JSON.stringify({
				"eventName": "_ice_candidate",
				"data": {
					"label": data.label,
					"candidate": data.candidate,
					"socketId": socket.id,
					"windowId": socket.windowId
				}
			}), errorCb);

			this.emit('ice_candidate', socket, data);
		}
	});

	this.on('__offer', function(data, socket) {
		var soc = this.getSocket(data.socketId);

		if (soc) {
			soc.send(JSON.stringify({
				"eventName": "_offer",
				"data": {
					"sdp": data.sdp,
					"socketId": socket.id,
					"windowId": socket.windowId
				}
			}), errorCb);
		}
		this.emit('offer', socket, data);
	});

	this.on('__answer', function(data, socket) {
		var soc = this.getSocket(data.socketId);
		if (soc) {
			soc.send(JSON.stringify({
				"eventName": "_answer",
				"data": {
					"sdp": data.sdp,
					"socketId": socket.id,
					"windowId": socket.windowId
				}
			}), errorCb);
			this.emit('answer', socket, data);
		}
	});
}

util.inherits(SkyRTC, events.EventEmitter);

SkyRTC.prototype.addSocket = function(socket) {
	this.sockets.push(socket);
};

SkyRTC.prototype.removeSocket = function(socket) {
	var i = this.sockets.indexOf(socket),
		room = socket.room;
	this.sockets.splice(i, 1);
	if (room) {
		i = this.rooms[room].indexOf(socket);
		this.rooms[room].splice(i, 1);
		if (this.rooms[room].length === 0) {
			delete this.rooms[room];
		}
	}
};

SkyRTC.prototype.broadcast = function(data, errorCb) {
	var i;
	for (i = this.sockets.length; i--;) {
		this.sockets[i].send(data, errorCb);
	}
};

SkyRTC.prototype.broadcastInRoom = function(room, data, errorCb) {
	var curRoom = this.rooms[room],
		i;
	if (curRoom) {
		for (i = curRoom.length; i--;) {
			curRoom[i].send(data, errorCb);
		}
	}
};

SkyRTC.prototype.getRooms = function() {
	var rooms = [],
		room;
	for (room in this.rooms) {
		rooms.push(room);
	}
	return rooms;
};

SkyRTC.prototype.getSocket = function(id) {
	var i,
		curSocket;
	if (!this.sockets) {
		return;
	}
	for (i = this.sockets.length; i--;) {
		curSocket = this.sockets[i];
		if (id === curSocket.id) {
			return curSocket;
		}
	}
	return;
};

SkyRTC.prototype.init = function(socket) {
	var that = this;
	socket.id = uuidv4();
	that.addSocket(socket);
	//?????????????????????????????????
	socket.on('message', function(data) {
		var json = JSON.parse(data);
		if (json.eventName) {
			that.emit(json.eventName, json.data, socket);
		} else {
			that.emit("socket_message", socket, data);
		}
	});
	//??????????????????SkyRTC?????????????????????????????????????????????
	socket.on('close', function() {
		var i, m,
			room = socket.room,
			curRoom;
		if (room) {
			curRoom = that.rooms[room];
			for (i = curRoom.length; i--;) {
				if (curRoom[i].id === socket.id) {
					continue;
				}
				curRoom[i].send(JSON.stringify({
					"eventName": "_remove_peer",
					"data": {
						"socketId": socket.id,
						"windowId": socket.windowId
					}
				}), errorCb);
			}
		}

		that.removeSocket(socket);

		that.emit('remove_peer', socket.id, that);
	});
	that.emit('new_connect', socket);
};

module.exports.listen = function(server) {
	var SkyRTCServer;
	if (typeof server === 'number') {
		SkyRTCServer = new WebSocketServer({
			port: server
		});
	} else {
		SkyRTCServer = new WebSocketServer({
			server: server
		});
	}

	SkyRTCServer.rtc = new SkyRTC();
	errorCb = errorCb(SkyRTCServer.rtc);
	SkyRTCServer.on('connection', function(socket) {
		this.rtc.init(socket);
	});

	return SkyRTCServer;
};
