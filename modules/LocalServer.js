
// LOCAL SERVER
// LocalServer.js

var express = require('express')
var app = express()
var server = require('http').Server(app)
var io = require('socket.io')(server)
var cheerio = require('cheerio')

var LocalServer = (cfg, controller) => {
    var c = controller
    var config = cfg.data

    var ls = {
        express: express,
        app: app,
        server: server,
        io: io
    }

    app.use(express.static('public'))

    io.on('connection', function (socket) {
        console.log('connection!')
        socket.emit('connected', { hello: 'world' })

        socket.on('pen',function(data){
            c.pen(data.up)
        })

        socket.on('r', function (data) {
            c.rotate(Number(data.m), Number(data.dir), Number(data.d), Number(data.steps))
            //console.log(data.d, Number(data.x), Number(data.y))
            //c.moveRelative(data.x, data.y)
        })

        socket.on('drawpath',function(data){
            c.addPath(data.path)
        })
        socket.on('drawart',function(data){
            // Get whole svg, extract all path tags and concatenate them
            var $ = cheerio.load(data.content, { xmlMode: true })
            var fullpath = ''
            $('path').each(function () {
                var d = $(this).attr('d');
                fullpath += d.replace(/\s+/g, ' ') + ' '
            })

            c.paths = []
            c.drawingPath = false
            c.addPath(fullpath.trim())
			//console.log(fullpath.trim())

        })
        socket.on('setStartPos',function(data){
            c.setStartPos(data)
        })
        socket.on('drawingScale',function(data){
            c.setDrawingScale(data.drawingScale);
            console.log("setscale:" + data.drawingScale)
        })
        socket.on('setD',function(data){
            c.setD(Number(data.d))
        })
        socket.on('moveto',function(data){
		    c.moveTo(data.x,data.y)
        })
        
        socket.on('getDXY', function(data){
            socket.emit('DXY',{
              d: c._D,
              x: c.startPos.x,
              y: c.startPos.y,
              s: c.drawingScale,
              limx: c.limits.x,
              limy: c.limits.y,
              strings: c.startStringLengths
          })
        })

        socket.on('pause', function(data){
            c.pause()
        })

        socket.on('reboot', function(data){
            c.reboot()
        })

        socket.on('clearCanvas', function(data){
            c.clearcanvas()
        })



    })

    ls.start = () => {
        server.listen(config.localPort, function(){
            console.log('listening on port '+config.localPort+'...')
        })
    }

    return ls
}
module.exports = LocalServer