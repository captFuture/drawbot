var isPi = require('detect-rpi');
if (isPi()) {
    var Gpio = require('pigpio').Gpio

} else {

}
var Xmax = 0;
var Ymax = 0;
var cBezier = require('adaptive-bezier-curve')
var qBezier = require('adaptive-quadratic-curve')
var svgpath = require('svgpath');
const path = require('path');
const fs = require('fs');
const { parseSVG, makeAbsolute } = require('svg-path-parser');
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
    bc.decelSpeed = config.decelSpeed       // || 1000
    bc.lineFactor = config.lineFactor       // || 1000
    bc.moveFactor = config.moveFactor       // || 1000
    bc.curveFactor = config.curveFactor     // || 1000
    bc.curveSmoothing = config.curveSmoothing // || 1

    bc.stepsPerMM = config.stepsPerMM       // || [5000/500, 5000/500] // steps / mm
    bc.penPause = config.penPauseDelay      // || 200 // pause for pen up/down movement (in ms)
    bc.servoMin = config.servo.Min;
    bc.servoMax = config.servo.Max;
    bc.swapServo = config.servo.swap

    if (isPi()) {
        /////////////////////////////////
        // GPIO SETUP
        var gmOut = { mode: Gpio.OUTPUT }
        var gmIn = { mode: Gpio.INPUT }
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

    const port = new SerialPort(config.serialport, {
        baudRate: 115200, function(err) {
            if (err) {
                return console.log('Error: ', err.message)
            }
        }
    })
    const parser = port.pipe(new Readline({ delimiter: '\n', encoding: 'ascii' }));

    let serialString = 'G91;\n';
    console.log(serialString);
    port.write(serialString);
    var waitForOk = (data) => {
        console.log(data.toString());
        if (data.toString().indexOf('ok') != -1) {
            console.log("Set GRBL to Move Relative");
            port.off('data', waitForOk);
        }
    };
    port.once('data', waitForOk);

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

    bc.setStates = () => {
        if (isPi()) {
            logicPins[0].digitalWrite(1); // power Left Motor Driver
            logicPins[1].digitalWrite(1); // power Right Motor Driver
            console.log("pin 1:" + logicPins[0]);
            console.log("pin 2:" + logicPins[1]);
        }
    }

    bc.updateStringLengths = () => {
        // L1 = Math.sqrt(x² + y²);
        // L2 = Math.sqrt((d - x)² + y²);
        bc.startStringLengths = [
            Math.sqrt(Math.pow((bc._D / 2), 2) + Math.pow((bc._D / 2), 2)),
            Math.sqrt(Math.pow((bc._D / 2), 2) + Math.pow(bc.startPos.y, 2))
        ]
        bc.stringLengths = [bc.startStringLengths[0], bc.startStringLengths[1]];
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
        console.log("bc.setscale:" + data);
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

    bc.setH = (data) => {
        console.log("Setting Home");
        console.log(data);
        let serialString = 'G92' + ' X0Y0;\n';
        //let serialString = '0x18\n';
        console.log(serialString);
        port.write(serialString);
        var waitForOk = (data) => {
            console.log(data.toString());
            if (data.toString().indexOf('ok') != -1) {
                console.log("Reset GRBL to X0Y0");
                port.off('data', waitForOk);
            }
        };
        port.once('data', waitForOk);
        bc.updateStringLengths();
    }

    bc.sendGcode = (serialString) => {
        port.write(serialString);
        var waitForOk = (data) => {
            //console.log(data.toString());
            if (data.toString().indexOf('ok') != -1) {
                port.off('data', waitForOk);
            }
        };
        port.once('data', waitForOk);
    }

    bc.pen = (dir) => {
        bc.penPos = dir
        // 0=down, 1=up
        if (bc.swapServo) {
            var servoUpPos = bc.servoMax
            var servoDnPos = bc.servoMin
        } else {
            var servoUpPos = bc.servoMin
            var servoDnPos = bc.servoMax
        }

        if (dir == 1) {
            // lift pen up
            console.log('Pen: up ' + servoUpPos)
            serialString = 'G90;\n'; // Set mode Absolute
            //console.log(serialString);
            bc.sendGcode(serialString);

            //serialString = 'G00 '+'Z'+servoUpPos+'F10000;\n'; // send Pen state
            serialString = 'Z' + servoUpPos + '\n'; // send Pen state
            //console.log(serialString);
            bc.sendGcode(serialString);

            serialString = 'G91;\n'; // Set mode Relative
            //console.log(serialString);
            bc.sendGcode(serialString);

        } else if (dir == 0) {
            // put pen down
            console.log('Pen: down ' + servoDnPos)
            serialString = 'G90;\n'; // Set mode Absolute
            //console.log(serialString);
            bc.sendGcode(serialString);

            //serialString = 'G00 '+'Z'+servoDnPos+'F10000;\n'; // send Pen state
            serialString = 'Z' + servoDnPos + '\n'; // send Pen state
            //console.log(serialString);
            bc.sendGcode(serialString);

            serialString = 'G91;\n'; // Set mode Relative
            //console.log(serialString);
            bc.sendGcode(serialString);

        } else {
            // lift pen up
            console.log('Pen: up ' + servoUpPos)
            serialString = 'G90;\n'; // Set mode Absolute
            //console.log(serialString);
            bc.sendGcode(serialString);

            //serialString = 'G00 '+'Z'+servoUpPos+'F10000;\n'; // send Pen state
            serialString = 'Z' + servoUpPos + '\n'; // send Pen state
            //console.log(serialString);
            bc.sendGcode(serialString);

            serialString = 'G91;\n'; // Set mode Relative
            //console.log(serialString);
            bc.sendGcode(serialString);

        }
        if (bc.localio) {
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

    bc.rotateBothESP = (x, y, lsteps, rsteps, ldir, rdir, motorSpeed, motorAccel, motorDecel, callback) => {
        //bc.rotateBothESP(ssteps1, ssteps2, sdir1, sdir2, accel, decel, callback)
        // make steps positive or negative for movement
        if (ldir == 1) {
            lsteps = lsteps * -1;
        } else if (ldir == 0) {
            lsteps = lsteps;
        }

        if (rdir == 1) {
            rsteps = rsteps * -1;
        } else if (rdir == 0) {
            rsteps = rsteps;
        }

        //console.log('moveBot(', lsteps, rsteps, bc.motorSpeed, bc.accelSpeed, ')');
        let serialString = 'G01 ' + 'X' + lsteps + 'Y' + rsteps + 'F' + motorSpeed + ';\n'; // GRBL with kinematics in node
        //console.log(serialString);
        port.write(serialString);
        var waitForOk = (data) => {
            //console.log(data.toString());
            if ((data.toString().indexOf('o') != -1) && (!(data.toString().indexOf('error')) != -1)) {
                //console.log("Callback->");
                if (callback != undefined) callback()
                port.off('data', waitForOk);
            }
        };
        port.once('data', waitForOk);
    }

    bc.rotateESP = (motorIndex, dirIndex, delay, steps, callback) => {
        if (motorIndex == 1) { // right Motor
            if (dirIndex == 1) {
                steps = steps * -1;
            } else if (dirIndex == 0) {
                steps = steps;
            }
            //console.log('moveBot(', 0, steps, bc.motorSpeed, bc.accelSpeed, bc.decelSpeed,')');
            //console.log("rightMotor");
            //let serialString = 'move '+'0 '+steps+' '+bc.motorSpeed+' '+bc.accelSpeed+' '+bc.decelSpeed+'\n'; //own implementation
            let serialString = 'G00 ' + 'Y' + steps / 10 + ';\n'; // GRBL with kinematics in node
            console.log(serialString);
            port.write(serialString);
            var waitForOk = (data) => {
                console.log(data.toString());
                if (data.toString().indexOf('ok') != -1) {
                    //console.log("Callback->");
                    if (callback != undefined) callback()
                    port.off('data', waitForOk);
                }
            };
            port.once('data', waitForOk);

        } else if (motorIndex == 0) { // left Motor
            if (dirIndex == 1) {
                steps = steps * -1;
            } else if (dirIndex == 0) {
                steps = steps;
            }
            //console.log('moveBot(', steps, 0, bc.motorSpeed, bc.accelSpeed, bc.decelSpeed,')');
            //console.log("leftMotor");
            //let serialString = 'move '+steps+' '+'0 '+bc.motorSpeed+' '+bc.accelSpeed+' '+bc.decelSpeed+'\n';
            let serialString = 'G00 ' + 'X' + steps / 10 + ';\n';
            console.log(serialString);
            port.write(serialString);
            var waitForOk = (data) => {
                console.log(data.toString());
                if (data.toString().indexOf('ok') != -1) {
                    //console.log("Callback->");
                    if (callback != undefined) callback()
                    port.off('data', waitForOk);
                }
            };
            port.once('data', waitForOk);

        }
    }

    /////////////////////////////////
    // DRAWING METHODS

    bc.moveTo = (x, y, speed, accel, decel, callback, penDir = 1) => {
        var x = Math.round(x);
        var y = Math.round(y);

        //console.log('---------- bc.moveTo', x, y, ' ----------')

        // Inverse kinematics 
        // L1 = Math.sqrt(x² + y²);
        // L2 = Math.sqrt((d - x)² + y²);
        //var Xmax = 200;
        //var Ymax = 200;

        var XminPos = bc._D / 2 - (Xmax / 2);
        var YminPos = bc.startPos.y;

        var destX = x + XminPos;
        var destY = y + YminPos;

        L1 = Math.sqrt(Math.pow(destX, 2) + Math.pow(destY, 2));
        L2 = Math.sqrt(Math.pow((bc._D - destX), 2) + Math.pow(destY, 2));

        // console.log('L:',L1,L2)
        // convert string lengths to motor steps (float to int)
        var s1 = Math.round(L1 * bc.stepsPerMM[0])
        var s2 = Math.round(L2 * bc.stepsPerMM[1])
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

        function doRotation() {
            //bc.rotateBoth(ssteps1, ssteps2, sdir1, sdir2, acc, dec, callback)
            bc.rotateBothESP(x, x, ssteps1, ssteps2, sdir1, sdir2, speed, accel, decel, callback)

            // store new current steps
            bc.currentSteps[0] = s1
            bc.currentSteps[1] = s2

            // store new bc.pos
            bc.pos.x = x
            bc.pos.y = y
        }
        doRotation()
    }

    bc.lineTo = (x, y, s, a, d, callback) => {
        bc.moveTo(Number(x), Number(y), Number(s), Number(a), Number(d), callback, 0) // 0 makes bc.moveTo happen with pen down instead of up
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

    }

    bc.filelist = (filepath, order, limit) => {
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
            moveFactor = bc.moveFactor;
            bc.moveTo(Xmax / 2, 0, bc.motorSpeed * moveFactor, bc.accelSpeed, bc.decelSpeed)
        }
    }

    bc.drawPath = (pathString) => {
        bc.drawingPath = true
        console.log('generating path...')
        var drawingScale = config.drawingScale / 100;
        console.log("drawingScale: " + drawingScale);

        if (drawingScale != 1) {
            var transformed = svgpath(pathString).scale(drawingScale).round(2).toString();
        } else {
            var transformed = svgpath(pathString).round(2).toString();
        }
        console.log(transformed);

        var commands = parseSVG(transformed);
        makeAbsolute(commands);
        var cmdCount = commands.length
        console.log(commands);

        commands.forEach(obj => {
            Object.entries(obj).forEach(([key, value]) => {
                //console.log(`${key} ${value}`);
                if (key == "x") {
                    if (Xmax < value) {
                        Xmax = value;
                    }
                } if (key == "y") {
                    if (Ymax < value) {
                        Ymax = value;
                    }
                }
            })
        });
        console.log(`${Xmax} ${Ymax}`);
        console.log('drawing path...')
        var prevCmd

        // TODO check if number is not negative or out of drawing bounds for safety reasons
        function checkValue(value) {
            return value
        }

        function doCommand() {
            if (cmdIndex < cmdCount) {
                var cmd = commands[cmdIndex]
                var cmdCode = cmd.code

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

                        moveFactor = bc.moveFactor;
                        moveSpeed = bc.motorSpeed * moveFactor;
                        moveAcc = bc.accelSpeed;
                        moveDec = bc.decelSpeed;
                        //console.log('-------------MOVE');
                        bc.penThen(1, function () { // 0=down, 1=up
                            bc.moveTo(Number(tox), Number(toy), moveSpeed, moveAcc, moveDec, doCommand)
                        })
                        break
                    case 'L':
                        // absolute line
                        tox = checkValue(Number(cmd.x))
                        toy = checkValue(Number(cmd.y))
                        //console.log('-------------LINE');

                        lineFactor = bc.lineFactor;
                        lineSpeed = bc.motorSpeed * lineFactor;
                        lineAcc = bc.accelSpeed;
                        lineDec = bc.decelSpeed;

                        bc.penThen(0, function () { // 0=down, 1=up
                            bc.lineTo(Number(tox), Number(toy), lineSpeed, lineAcc, lineDec, doCommand)
                        })
                        break
                    case 'H':
                        // absolute horizontal line
                        tox = checkValue(Number(cmd.x))
                        //console.log('-------------HLINE');

                        lineFactor = bc.lineFactor;
                        lineSpeed = bc.motorSpeed * lineFactor;
                        lineAcc = bc.accelSpeed;
                        lineDec = bc.decelSpeed;

                        bc.penThen(0, function () { // 0=down, 1=up
                            bc.lineTo(Number(tox), Number(toy), lineSpeed, lineAcc, lineDec, doCommand)
                        })
                        break
                    case 'V':
                        // absolute vertical line
                        toy = checkValue(Number(cmd.y))
                        //console.log('-------------VLINE');

                        lineFactor = bc.lineFactor;
                        lineSpeed = bc.motorSpeed * lineFactor;
                        lineAcc = bc.accelSpeed;
                        lineDec = bc.decelSpeed;

                        bc.penThen(0, function () { // 0=down, 1=up
                            bc.lineTo(Number(tox), Number(toy), lineSpeed, lineAcc, lineDec, doCommand)
                        })
                        break
                    case 'C':
                        // absolute cubic bezier curve
                        bc.penThen(0, function () { // 0=down, 1=up
                            bc.drawCubicBezier(
                                // [{x:tox,y:toy}, {x:cmd.x1,y:cmd.y1}, {x:cmd.x2,y:cmd.y2}, {x:cmd.x,y:cmd.y}],
                                // 0.01,
                                [[tox, toy], [checkValue(cmd.x1), checkValue(cmd.y1)], [checkValue(cmd.x2), checkValue(cmd.y2)], [checkValue(cmd.x), checkValue(cmd.y)]],
                                bc.curveSmoothing,
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
                                bc.curveSmoothing,
                                doCommand
                            )
                        })
                        break
                    case 'Q':
                        // absolute quadratic bezier curve
                        bc.penThen(0, function () { // 0=down, 1=up
                            bc.drawQuadraticBezier(
                                [[tox, toy], [checkValue(cmd.x1), checkValue(cmd.y1)], [checkValue(cmd.x), checkValue(cmd.y)]],
                                bc.curveSmoothing,
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
                                bc.curveSmoothing,
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
                        //console.log(curves)

                        // draw the arc
                        bc.penThen(0, function () { // 0=down, 1=up
                            bc.drawArc(curves, doCommand)
                        })
                        break
                    case 'Z':
                        tox = checkValue(Number(cmd.x))
                        toy = checkValue(Number(cmd.y))

                        lineFactor = bc.lineFactor;
                        lineSpeed = bc.motorSpeed * lineFactor;
                        lineAcc = bc.accelSpeed;
                        lineDec = bc.decelSpeed;

                        bc.penThen(0, function () { // 0=down, 1=up
                            bc.lineTo(Number(tox), Number(toy), lineSpeed, lineAcc, lineDec, doCommand)
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
        }
        doCommand()
    }

    bc.drawArc = (curves, callback) => {
        var n = 0
        var cCount = curves.length
        console.log('-------------drawArc');
        function doCommand() {
            if (n < cCount) {
                var crv = curves[n]
                // draw the cubic bezier curve created from arc input
                bc.drawCubicBezier(
                    [[bc.pos.x, bc.pos.y], [crv.x1, crv.y1], [crv.x2, crv.y2], [crv.x, crv.y]],
                    bc.curveSmoothing,
                    doCommand
                )
                n++
            } else {
                if (callback != undefined) callback()
            }
        }
        doCommand()
    }

    bc.drawCubicBezier = (points, scale = bc.curveSmoothing, callback) => {
        var n = 0// curret bezier step in iteration
        var pts = cBezier(points[0], points[1], points[2], points[3], scale)
        var ptCount = pts.length
        //console.log('-------------drawCubicBezier');
        function doCommand() {
            if (n < ptCount) {
                var pt = pts[n]
                curveFactor = bc.curveFactor;
                curveSpeed = bc.motorSpeed * curveFactor;
                lineAcc = bc.accelSpeed;
                lineDec = bc.decelSpeed;
                bc.lineTo(Number(pt[0]), Number(pt[1]), curveSpeed, lineAcc, lineDec, doCommand)
                n++
            } else {
                // console.log('bezier done!')
                if (callback != undefined) callback()
            }
        }
        doCommand()
    }
    bc.drawQuadraticBezier = (points, scale = bc.curveSmoothing, callback) => {
        var n = 0// curret bezier step in iteration
        var pts = qBezier(points[0], points[1], points[2], scale)
        var ptCount = pts.length
        console.log('-------------drawQuadraticBezier');
        function doCommand() {
            if (n < ptCount) {
                var pt = pts[n]
                curveFactor = bc.curveFactor;
                curveSpeed = bc.motorSpeed * curveFactor;
                lineAcc = bc.accelSpeed;
                lineDec = bc.decelSpeed;
                bc.lineTo(Number(pt[0]), Number(pt[1]), curveSpeed, lineAcc, lineDec, doCommand)
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
