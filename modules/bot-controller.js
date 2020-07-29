const Gpio = require("detect-rpi")() ? require("pigpio").Gpio : null;
const cBezier = require("adaptive-bezier-curve");
const qBezier = require("adaptive-quadratic-curve");
const svgpath = require("svgpath");
const path = require("path");
const fs = require("fs");
const { parseSVG, makeAbsolute } = require("svg-path-parser");
const arcToBezier = require("./arcToBezier");
const svgpath = require("svgpath");

class PenServo {
  constructor(config) {
    this.delay = 200;
    this.value = null;
    this.values = {
      /* TODO check:
        this.onValue = minValue;
        this.offValue = minValue + Math.floor((maxValue - minValue) * 0.35);
      */

      // up
      "1": config.servo.swap ? config.servo.Max : config.servo.Min,
      // down
      "0": config.servo.swap ? config.servo.Min : config.servo.Max
    };
    this.gpio = Gpio && new Gpio(config.pins.penServo, { mode: Gpio.OUTPUT });
  }
  write(d) {
    if (d != this.value) {
      console.log(`pen=${d}`);
      this.value = d;
      if (this.gpio) {
        // TODO this.delay
        this.gpio.servoWrite(this.values[this.value]);
      }
    }
  }
}

class Stepper {
  constructor({ dir, step, driver, invert = false, delay = 1 }) {
    Object.assign(this, { invert, delay });
    this.dir = Gpio && new Gpio(dir, { mode: Gpio.OUTPUT });
    this.step = Gpio && new Gpio(step, { mode: Gpio.OUTPUT });
    Gpio && new Gpio(driver, { mode: Gpio.OUTPUT }).digitalWrite(1);
  }
  write(d, { delay = this.delay }) {
    return new Promise(resolve => {
      this.dir.digitalWrite((this.invert ? !d : !!d) ? 1 : 0);
      this.step.digitalWrite(1);
      setTimeout(() => {
        this.step.digitalWrite(0);
        resolve();
      }, delay);
    });
  }
}

module.exports = ({ data: config }) => {
  // bc._DIRSWAP = config.swapDirections     // || true
  // bc.limits = config.limits
  // bc.baseDelay = config.baseDelay         // || 2
  // bc.drawingScale = config.drawingScale   // || defaults to 100%
  // bc.startPos = config.startPos           // || { x: 100, y: 100 }
  // bc.stepsPerMM = config.stepsPerMM       // || [5000/500, 5000/500] // steps / mm
  // bc.servoMin = config.servo.Min;

  /*
  bc._D = config.d                        // || 1000// default distance between string starts
  bc.penPause = config.penPauseDelay      // || 200 // pause for pen up/down movement (in ms)
  */
  /*
  const gpio = {
    stepper: {
      left: {
        /* stepPins[0] * /
        step: Gpio
          ? new Gpio(config.pins.leftStep, { mode: Gpio.OUTPUT })
          : config.pins.leftStep,
        /* dirPins[0] * /
        dir: Gpio
          ? new Gpio(config.pins.leftDir, { mode: Gpio.OUTPUT })
          : config.pins.leftDir,
        /* logicPins[0] * /
        driver: Gpio
          ? new Gpio(config.pins.leftDriver, { mode: Gpio.OUTPUT })
          : config.pins.leftDriver
      },
      right: {
        /* stepPins[1] * /
        step: Gpio
          ? new Gpio(config.pins.rightStep, { mode: Gpio.OUTPUT })
          : config.pins.rightStep,
        /* dirPins[1] * /
        dir: Gpio
          ? new Gpio(config.pins.rightDir, { mode: Gpio.OUTPUT })
          : config.pins.rightDir,
        /* logicPins[1] * /
        driver: Gpio
          ? new Gpio(config.pins.rightDriver, { mode: Gpio.OUTPUT })
          : config.pins.leftDriver
      }
    }
  };
*/

  const pen = new PenServo(config);
  const lft = new Stepper({
    dir: config.pins.leftDir,
    step: config.pins.leftStep,
    driver: config.pins.leftDriver
  });
  const rgt = new Stepper({
    dir: config.pins.rightDir,
    step: config.pins.rightStep,
    driver: config.pins.rightDriver
  });

  const state = {
    x: 0,
    y: 0
  };

  /*
  bc.startStringLengths = [0, 0];
  bc.stringLengths = [0, 0];
  bc.startSteps = [0, 0];
  bc.currentSteps = [0, 0];
  bc.paths = [];
  bc.drawingPath = false;
  */

  return {
    pen(state) {
      // 0=down, 1=up
      pen.write(state);
    },
    async rotate(m, dir, delay, steps) {
      console.log(
        "rotate",
        m ? "right" : "left",
        (dirIndex ? "+" : "-") + steps,
        { delay }
      );

      const stepper = m ? rgt : lft;
      for (let i = 0, ln = Math.round(steps); i < ln; i++) {
        // TODO let stepper do more steps
        await stepper.write(dir, { delay });
      }
    },
    addPath(path) {},
    setStartPos(data) {},
    setDrawingScale(scale) {},
    setD(d) {
      d = Number(d);
    },
    moveTo(x, y) {},
    filelist(folder, order, limit) {},
    pause() {},
    reboot() {},
    clearcanvas() {}
  };
};
