var isPi = require('detect-rpi'); 
if (isPi()) {
    var Gpio = require('pigpio').Gpio

} else {

}

var cBezier = require('adaptive-bezier-curve')
var qBezier = require('adaptive-quadratic-curve')
var svgpath = require('svgpath');
const path = require('path');
const fs = require('fs');
const {parseSVG, makeAbsolute} = require('svg-path-parser');
var arcToBezier = require('./arcToBezier');
var svgpath = require('svgpath');

const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

var currentX = 0;
var currentY = 0;
var cmdIndex = 0;

var BotController = (cfg) => {

    var bc = {}
    var config = cfg.data


    /////////////////////////////////
    // MAIN SETUP VARIABLES
    bc._BOT_ID = config.botID               // || 'two'
    bc._DIRSWAP = config.swapDirections     // || true
    bc.limits = config.limits

    bc.baseDelay = config.baseDelay         // || 2
    bc._D = config.d                        // || 1000// default distance between string starts
    bc.drawingScale = config.drawingScale   // || defaults to 100%
    bc.startPos = config.startPos           // || { x: 100, y: 100 }

    bc.motorSpeed = config.motorSpeed       // || 1000
    bc.accelSpeed = config.accelSpeed       // || 1000

    bc.stepsPerMM = config.stepsPerMM       // || [5000/500, 5000/500] // steps / mm
    bc.penPause = config.penPauseDelay      // || 200 // pause for pen up/down movement (in ms)
    bc.servoMin = config.servo.Min;
    bc.servoMax = config.servo.Max;
    bc.swapServo = config.servo.swap

    if (isPi()) {
        /////////////////////////////////
        // GPIO SETUP
        var gmOut = { mode: Gpio.OUTPUT }
        var gmIn = { mode: Gpio.INPUT}
        var dirPins = [
            new Gpio(config.pins.leftDir, gmOut),
            new Gpio(config.pins.rightDir, gmOut)
        ]
        var stepPins = [
            new Gpio(config.pins.leftStep, gmOut),
            new Gpio(config.pins.rightStep, gmOut)
        ]

        var buttonPins = [
            new Gpio(config.pins.btnOne, gmIn), 
            new Gpio(config.pins.btnTwo, gmIn),
            new Gpio(config.pins.btnThree, gmIn)
        ] 

        var logicPins = [
            new Gpio(config.pins.leftDriver, gmOut),
            new Gpio(config.pins.rightDriver, gmOut),
        ]

        // set up servo GPIO pin
        var servo = new Gpio(config.pins.penServo, gmOut)

    } else {
        // Setup for debugging if not running on a raspberry
        var gmOut = { mode: "localdebug" }
        var dirPins = [config.pins.leftDir, config.pins.rightDir]
        var stepPins = [config.pins.leftStep, config.pins.rightStep]
        var servo = config.pins.penServo
        var logicPins = [config.pins.leftDriver, config.pins.rightDriver]


    }

    const port = new SerialPort(config.serialport, {baudRate: 57600, function (err) {
        if (err) {
          return console.log('Error: ', err.message)
        }
    }})

    /////////////////////////////////
    // CONTROLLER VARIABLES

    bc.pos = { x: 0, y: 0 }
    bc.penPos = 0
    bc.paused = false

    // string length stuff
    bc.startStringLengths = [0, 0]
    bc.stringLengths = [0, 0]
    bc.startSteps = [0, 0]
    bc.currentSteps = [0, 0]
    bc.stepCounts = [0, 0]
    bc.steppeds = [0, 0]
    bc.paths = []
    bc.drawingPath = false


    /////////////////////////////////
    // LIMIT SWITCHES FOR AUTOMATIC HOMING

    if (isPi()) {

    } else {

    }


    /////////////////////////////////
    // HARDWARE METHODS

    bc.setStates = () =>{
        if (isPi()) {
            logicPins[0].digitalWrite(1); // power Left Motor Driver
            logicPins[1].digitalWrite(1); // power Right Motor Driver
            console.log("pin 1:"+logicPins[0]);
            console.log("pin 2:"+logicPins[1]);
        }
    }

    bc.updateStringLengths = () => {
        bc.startStringLengths = [
            Math.sqrt((bc.startPos.x * bc.startPos.x) + (bc.startPos.y * bc.startPos.y)),
            Math.sqrt(((bc._D - bc.startPos.x) * (bc._D - bc.startPos.x)) + (bc.startPos.y * bc.startPos.y))
        ]
        bc.stringLengths = [bc.startStringLengths[0], bc.startStringLengths[1]]
        bc.startSteps = [Math.round(bc.stringLengths[0] * bc.stepsPerMM[0]), Math.round(bc.stringLengths[1] * bc.stepsPerMM[1])]
        bc.currentSteps = [bc.startSteps[0], bc.startSteps[1]]

        console.log('bc.startPos', JSON.stringify(bc.startPos))
        console.log('startStringLengths', JSON.stringify(bc.startStringLengths))
        return bc.startStringLengths
    }

    bc.setStartPos = (data) => {
        cfg.data.startPos.x = bc.startPos.x = Number(data.x)// set values and store in config
        cfg.data.startPos.y = bc.startPos.y = Number(data.y)// set values and store in config
        cfg.save()// save to local config.json file
        bc.updateStringLengths()
    }
    bc.setScale = (data) => {
        console.log("bc.setscale:"+data);
        cfg.data.drawingScale = bc.drawingScale = Number(data)// set value and store in config
        cfg.save()// save to local config.json file
        bc.updateStringLengths()
    }

    bc.setD = (data) => {
        cfg.data.d = bc._D = Number(data)// set value and store in config
        cfg.save()// save to local config.json file
        bc.updateStringLengths()
    }

    bc.setDrawingScale = (data) => {
        cfg.data.drawingScale = bc.drawingScale = Number(data)// set value and store in config
        cfg.save()// save to local config.json file
    }

    bc.pen = (dir) => {
        bc.penPos = dir
        // 0=down, 1=up
        if (bc.swapServo){
            var servoUpPos = bc.servoMax
            var servoDnPos = bc.servoMin
        }else{
            var servoUpPos = bc.servoMin
            var servoDnPos = bc.servoMax
        }

        if (dir == 1) {
            // lift pen up
            console.log('Pen: up ' + servoUpPos)
            if (isPi()) { servo.servoWrite(servoUpPos) }
        } else if( dir == 0) {
            // put pen down
            console.log('Pen: down ' + servoDnPos)
            if (isPi()) { servo.servoWrite(servoDnPos) }
        } else {
			// lift pen up
            console.log('Pen: up ' + servoUpPos)
            if (isPi()) { servo.servoWrite(servoUpPos) }
        }
        if (bc.localio){
            bc.localio.emit('penState', Number(dir))
            //console.log('SendPen: '+Number(dir))
        }
    }
	
    bc.penThen = (dir, callback) => {
        if (dir != bc.penPos) {
            bc.pen(dir)
            if (callback != undefined) {
                setTimeout(callback, bc.penPause)
            }
        } else {
            callback()
        }
    }

    //////////////////// TODO: change this to a wave function with pigpio

    bc.makeStep = (m, d) => {
        // console.log('step',d)
        if (bc._DIRSWAP) d = !d
        if (isPi()) { dirPins[m].digitalWrite(d) }
        if (isPi()) { stepPins[m].digitalWrite(1) }
        if (isPi()) { 
            setTimeout(function () {
                if (isPi()) { stepPins[m].digitalWrite(0) }
            }, 1)
        }
    }
    

    bc.rotateBothESP = (lsteps, rsteps, ldir, rdir, callback) => {
        // make steps positive or negative for movement
        if(ldir == 1){
            lsteps = lsteps*-1;
        }else if(ldir == 0){
            lsteps = lsteps;
        }

        if(rdir == 0){
            rsteps = rsteps*-1;
        }else if(rdir == 1){
            rsteps = rsteps;
        }
        if(lsteps == -0){lsteps = 0};
        if(rsteps == -0){rsteps = 0};
                
        console.log('moveBot(', lsteps, rsteps, bc.motorSpeed, bc.accelSpeed, ')');

        let serialString = 'move '+lsteps+' '+rsteps+' '+bc.motorSpeed+' '+bc.accelSpeed+'\n';
        /*port.write(serialString, function(err) {
            if (err) {
              return console.log('Error on write: ', err.message)
            }
            //console.log('moved: '+serialString);
        })*/

    }
    
    bc.rotateESP = (motorIndex, dirIndex, delay, steps, callback) => {

        if(motorIndex == 1){ // right Motor
            if(dirIndex == 0){
                steps = steps*-1;
            }else if(dirIndex == 1){
                steps = steps;
            }
            //console.log('moveBot(', 0, steps, bc.motorSpeed, bc.accelSpeed, ')');
            console.log("rightMotor");
            let serialString = 'move '+'0 '+steps+' '+bc.motorSpeed+' '+bc.accelSpeed+'\n';
            port.write(serialString, function(err) {
                if (err) {
                  return console.log('Error on write: ', err.message)
                }
                console.log('> '+serialString);
            })

        }else if(motorIndex == 0){ // left Motor
            if(dirIndex == 1){
                steps = steps*-1;
            }else if(dirIndex == 0){
                steps = steps;
            }
            //console.log('moveBot(', steps, 0, bc.motorSpeed,bc.motorSpeed, ')');
            console.log("leftMotor");
            let serialString = 'move '+steps+' '+'0 '+bc.motorSpeed+' '+bc.accelSpeed+'\n';
            
            port.write(serialString, function(err) {
                if (err) {
                  return console.log('Error on write: ', err.message)
                }
                console.log('> '+serialString);
            })

        }
    }
    
    /////////////////////////////////
    // DRAWING METHODS

    bc.moveRelative = (x, y, callback, penDir = 1) => {
        console.log('---------- bc.moveRelative', x, y, ' ----------')
        var tox = Number(bc.pos.x) + Number(x)
        var toy = Number(bc.pos.y) + Number(y)
        bc.moveTo(Number(tox), Number(toy), callback, 1)
    }

    bc.moveTo = (x, y, callback, penDir = 1) => {
        var x = Math.round(x);
        var y = Math.round(y);

        //console.log('---------- bc.moveTo', x, y, ' ----------')
        if (x == 0 && y == 0) {
            console.log("-------> homing <-------")
        }
        // convert x,y to l1,l2 (ideal, precise string lengths)
        // L1 = Math.sqrt( Math.pow(y,2) + Math.pow(x+d/2, 2));
        // L2 = Math.sqrt( Math.pow(y,2) + Math.pow(x-d/2, 2));

        // Inverse kinematics 
        // L1 = Math.sqrt(X² + Y²)
        // L2 = Math.sqrt((d - X)² + Y²)

        var X = Math.round(x + bc.startPos.x);
        var Y = Math.round(y + bc.startPos.y);

        var X2 = X * X
        var Y2 = Y * Y

        var DsubX = bc._D - X
        var DsubX2 = DsubX * DsubX
                
        L1 = Math.sqrt(X2 + Y2)
        L2 = Math.sqrt(DsubX2 + Y2)

        // console.log('L:',L1,L2)

        // convert string lengths to motor steps (float to int)

        var s1 = Math.round(L1 * bc.stepsPerMM[0])
        var s2 = Math.round(L2 * bc.stepsPerMM[1])
        
        // console.log('s:',s1,s2)
        // console.log('bc.currentSteps:',bc.currentSteps[0],bc.currentSteps[1])

        // get difference between target steps and current steps (+/- int)
        var sd1 = s1 - bc.currentSteps[0]
        var sd2 = s2 - bc.currentSteps[1]
        // console.log('sd:',sd1,sd2)

        // get directions from steps difference
        var sdir1 = (sd1 > 0) ? 0 : 1
        var sdir2 = (sd2 > 0) ? 1 : 0
        // console.log('sdir:',sdir1,sdir2)

        // get steps with absolute value of steps difference
        var ssteps1 = Math.abs(sd1)
        var ssteps2 = Math.abs(sd2)
        // console.log('ssteps:',ssteps1,ssteps2)

        // convert step differences to degree movement
        //var deg1 = (ssteps1 * 0.225).toFixed(2);
        //var deg2 = (ssteps2 * 0.225).toFixed(2);
        //var degdir1 = (sd1 > 0) ? "-" : "+"
        //var degdir2 = (sd2 > 0) ? "+" : "-"

        //console.log("Degrees Rotate | l: "+degdir1+""+deg1+" | r: "+degdir2+""+deg2);


        function doRotation() {
            // do the rotation!
            //bc.rotateBoth(ssteps1, ssteps2, sdir1, sdir2, callback)
            bc.rotateBothESP(ssteps1, ssteps2, sdir1, sdir2, callback)
            
            // store new current steps
            bc.currentSteps[0] = s1
            bc.currentSteps[1] = s2

            // store new bc.pos
            bc.pos.x = x
            bc.pos.y = y
        }
    doRotation()
    }

    bc.lineTo = (x, y, callback) => {
        bc.moveTo(Number(x), Number(y), callback, 0)// 0 makes bc.moveTo happen with pen down instead of up
    }


    bc.addPath = (pathString) => {
        console.log('bc.addPath')
        bc.paths.push(pathString)
        console.log('pathcount: ', bc.paths.length)
        if (bc.paths.length == 1 && bc.drawingPath == false) {
            bc.drawNextPath()
        }
    }

    bc.pause = () => {
        bc.paused = !(bc.paused != false)
        console.log("paused: ", bc.paused)
        if(bc.paused){
           // bc.drawPath.doCommand();
        }
        //bc.paused = true
    }

    bc.filelist = (filepath, order, limit) => {
        //console.log(filepath);
        //console.log(order);
        //console.log(limit);

        var drewiefiles = [];
        const directoryPath = path.join(__dirname, filepath);
        fs.readdir(directoryPath, function (err, files) {
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            } 
            files.forEach(function (file) {
                drewiefiles.push(file);
            });

            if (bc.localio) bc.localio.emit('drewieFiles', {
                drewiefiles
            })
        });

    }

    bc.clearcanvas = () => {
        // Todo stopping, moving to home position and clearing input
		bc.penThen(1, function () { // 0=down, 1=up
            console.log("Homing and Clearing...")
		})
    }

    bc.reboot = () => {
        if (isPi()) {
            // Todo reboot Pi
            console.log("Reboot pressed -> rebooting RPI ")
        } else {
            console.log("Reboot pressed -> NOT rebooting PC")
        }
    }

    bc.drawNextPath = () => {
        if (bc.paths.length > 0) {
            bc.drawPath(bc.paths.shift())
        } else {
            console.log("Done drawing all the paths. :)")
            bc.moveTo(0,0);
        }
    }

    bc.drawPath = (pathString) => {

        bc.drawingPath = true
        console.log('generating path...')
        var drawingScale = config.drawingScale/100;
        console.log("drawingScale: "+drawingScale);

        //if(drawingScale != 1){
        //    var transformed = svgpath(pathString).scale(drawingScale).toString();
        //}else{
        //    var transformed = pathString;
        //}

        var commands = parseSVG(pathString);
		makeAbsolute(commands);
        var cmdCount = commands.length
		console.log(commands);
        console.log('drawing path...')
        var prevCmd

        // TODO check if number is not negative or out of drawing bounds for safety reasons
        function checkValue(value){
            return value
        }
		
        function doCommand() {
            //if(!bc.paused){
               // console.log("--- paused:");
                //console.log(bc.paused);
                if (cmdIndex < cmdCount) {
                    var cmd = commands[cmdIndex]
                    var cmdCode = cmd.code

                    console.log("Command-index: " + cmdIndex);
                    console.log("Command-count: " + cmdCount);

                    var tox = checkValue(bc.pos.x)
                    var toy = checkValue(bc.pos.y)

                    cmdIndex++
                    var percentage = Math.round((cmdIndex / cmdCount) * 100)

                    if (bc.client) bc.client.emit('progressUpdate', {
                        botID: bc._BOT_ID,
                        percentage: percentage
                    })
                    if (bc.localio) bc.localio.emit('progressUpdate', {
                        percentage: percentage
                    })

                    if (bc.localio) bc.localio.emit('progressDraw', {
                        cmd: cmdCode,
                        x: checkValue(Number(cmd.x)),
                        y: checkValue(Number(cmd.y)),
                        x0: checkValue(Number(cmd.x0)),
                        y0: checkValue(Number(cmd.y0)),
                        x1: checkValue(Number(cmd.x1)),
                        y1: checkValue(Number(cmd.y1)),
                        x2: checkValue(Number(cmd.x2)),
                        y2: checkValue(Number(cmd.y2)),
                        pen: Number(bc.penPos)
                    })

                    switch (cmdCode) {
                        case 'M':
                            // absolute move
                            tox = checkValue(Number(cmd.x))
                            toy = checkValue(Number(cmd.y))
                            bc.penThen(1, function () { // 0=down, 1=up
                                bc.moveTo(Number(tox), Number(toy), doCommand)
                            })
                            break
                        case 'L':
                            // absolute line
                            tox = checkValue(Number(cmd.x))
                            toy = checkValue(Number(cmd.y))
                            bc.penThen(0, function () { // 0=down, 1=up
                                bc.lineTo(Number(tox), Number(toy), doCommand)
                            })
                            break
                        case 'H':
                            // absolute horizontal line
                            tox = checkValue(Number(cmd.x))
                            bc.penThen(0, function () { // 0=down, 1=up
                                bc.lineTo(Number(tox), Number(toy), doCommand)
                            })
                            break
                        case 'V':
                            // absolute vertical line
                            toy = checkValue(Number(cmd.y))
                            bc.penThen(0, function () { // 0=down, 1=up
                                bc.lineTo(Number(tox), Number(toy), doCommand)
                            })
                            break
                        case 'C':
                            // absolute cubic bezier curve
                            bc.penThen(0, function () { // 0=down, 1=up
                                bc.drawCubicBezier(
                                    // [{x:tox,y:toy}, {x:cmd.x1,y:cmd.y1}, {x:cmd.x2,y:cmd.y2}, {x:cmd.x,y:cmd.y}],
                                    // 0.01,
                                    [[tox, toy], [checkValue(cmd.x1), checkValue(cmd.y1)], [checkValue(cmd.x2), checkValue(cmd.y2)], [checkValue(cmd.x), checkValue(cmd.y)]],
                                    1,
                                    doCommand
                                )
                            })
                            break
                        case 'S':
                            // absolute smooth cubic bezier curve

                            // check to see if previous command was a C or S
                            // if not, the inferred control point is assumed to be equal to the start curve's start point
                            var inf
                            if (prevCmd.command.indexOf('curveto') < 0) {
                                inf = {
                                    x: tox,
                                    y: toy
                                }
                            } else {
                                // get absolute x2 and y2 values from previous command if previous command was relative
                                if (prevCmd.relative) {
                                    prevCmd.x2 = bc.pos.x - prevCmd.x + prevCmd.x2
                                    prevCmd.y2 = bc.pos.y - prevCmd.y + prevCmd.y2
                                }
                                // calculate inferred control point from previous commands
                                // reflection of x2,y2 of previous commands
                                inf = {
                                    x: tox + (tox - prevCmd.x2),// make prevCmd.x2 and y2 values absolute, not relative for calculation
                                    y: toy + (toy - prevCmd.y2)
                                }
                            }

                            // draw it!
                            var pts = [[tox, toy], [inf.x, inf.y], [cmd.x2, cmd.y2], [cmd.x, cmd.y]]
                            console.log('calculated points:', pts)
                            bc.penThen(0, function () { // 0=down, 1=up
                                bc.drawCubicBezier(
                                    pts,
                                    1,
                                    doCommand
                                )
                            })	
                            break
                        case 'Q':
                            // absolute quadratic bezier curve
                            bc.penThen(0, function () { // 0=down, 1=up
                                bc.drawQuadraticBezier(
                                    
                                    [[tox, toy], [checkValue(cmd.x1), checkValue(cmd.y1)], [checkValue(cmd.x), checkValue(cmd.y)]],
                                    1,
                                    doCommand
                                )
                            })	
                            break
                        case 'T':
                            // absolute smooth quadratic bezier curve

                            // check to see if previous command was a C or S
                            // if not, the inferred control point is assumed to be equal to the start curve's start point
                            var inf
                            if (prevCmd.command.indexOf('curveto') < 0) {
                                inf = {
                                    x: tox,
                                    y: toy
                                }
                            } else {
                                // get absolute x1 and y1 values from previous command if previous command was relative
                                if (prevCmd.relative) {
                                    prevCmd.x1 = bc.pos.x - prevCmd.x + prevCmd.x1
                                    prevCmd.y1 = bc.pos.y - prevCmd.y + prevCmd.y1
                                }
                                // calculate inferred control point from previous commands
                                // reflection of x1,y1 of previous commands
                                inf = {
                                    x: tox + (tox - prevCmd.x1),
                                    y: toy + (toy - prevCmd.y1)
                                }
                            }

                            // draw it!
                            bc.penThen(0, function () { // 0=down, 1=up
                                bc.drawQuadraticBezier(
                                    [[tox, toy], [inf.x, inf.y], [cmd.x, cmd.y]],
                                    1,
                                    doCommand
                                )
                            })
                            break
                        case 'A':
                            // absolute arc

                            // convert arc to cubic bezier curves
                            var curves = arcToBezier({
                                px: tox,
                                py: toy,
                                cx: cmd.x,
                                cy: cmd.y,
                                rx: cmd.rx,
                                ry: cmd.ry,
                                xAxisRotation: cmd.xAxisRotation,
                                largeArcFlag: cmd.largeArc,
                                sweepFlag: cmd.sweep
                            })
                            console.log(curves)

                            // draw the arc
                            bc.penThen(0, function () { // 0=down, 1=up
                                bc.drawArc(curves, doCommand)
                            })
                            break
                        case 'Z':
                            tox = checkValue(Number(cmd.x))
                            toy = checkValue(Number(cmd.y))
                            bc.penThen(0, function () { // 0=down, 1=up
                                bc.lineTo(tox, toy, doCommand)
                            })
                            break
                    }

                    prevCmd = cmd

                } else {
                    bc.penThen(1, function () { // 0=down, 1=up
                        cmdCount = 0
                        cmdIndex = 0
                        console.log('path done!')
                        bc.drawingPath = false
                        bc.drawNextPath()
                    })
                }
            /*}else{
                console.log("--- paused:");
                console.log(bc.paused);
                console.log("Command-index: " + cmdIndex);
                console.log("Command-count: " + cmdCount);
                //doCommand();
            }*/
        }
        doCommand()
    }

    bc.drawArc = (curves, callback) => {
        var n = 0
        var cCount = curves.length
        function doCommand() {
            if (n < cCount) {
                var crv = curves[n]
                // draw the cubic bezier curve created from arc input
                bc.drawCubicBezier(
                    [[bc.pos.x, bc.pos.y], [crv.x1, crv.y1], [crv.x2, crv.y2], [crv.x, crv.y]],
                    1,
                    doCommand
                )
                n++
            } else {
                if (callback != undefined) callback()
            }
        }
        doCommand()
    }

    bc.drawCubicBezier = (points, scale = 1, callback) => {
        var n = 0// curret bezier step in iteration
        var pts = cBezier(points[0], points[1], points[2], points[3], scale)
        var ptCount = pts.length
        function doCommand() {
            if (n < ptCount) {
                var pt = pts[n]
                bc.lineTo(Number(pt[0]), Number(pt[1]), doCommand)
                n++
            } else {
                // console.log('bezier done!')
                if (callback != undefined) callback()
            }
        }
        doCommand()
    }
    bc.drawQuadraticBezier = (points, scale = 1, callback) => {
        var n = 0// curret bezier step in iteration
        var pts = qBezier(points[0], points[1], points[2], scale)
        var ptCount = pts.length
        function doCommand() {
            if (n < ptCount) {
                var pt = pts[n]
                bc.lineTo(Number(pt[0]), Number(pt[1]), doCommand)
                n++
            } else {
                // console.log('bezier done!')
                if (callback != undefined) callback()
            }
        }
        doCommand()
    }

 return bc
}
module.exports = BotController

console.log("   ,--.                      ,--.          ,--.  \n ,-|  ,--.--.,--,--,--.   ,--|  |-. ,---.,-'  '-. \n' .-. |  .--' ,-.  |  |.'.|  | .-. | .-. '-.  .-' \n\\ `-' |  |  \\ '-'  |   .'.   | `-' ' '-' ' |  |   \n `---'`--'   `--`--'--'   '--'`---' `---'  `--'  ")
