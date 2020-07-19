import RPi.GPIO as GPIO
import time
# based on https://github.com/zxzhaixiang/Laser_engraver_system_RaspberryPI


class Bipolar_Stepper_Motor:
    
    phase=0;
    dir=0;
    position=0;
    
    def __init__(self,steppin, dirpin):

        GPIO.setmode(GPIO.BCM);
        
        self.steppin = steppin;
        self.dirpin = dirpin;
        
        self.step = 0;
        self.dir = 0;
        self.position=0;
        
        GPIO.setup(self.steppin,GPIO.OUT);
        GPIO.setup(self.dirpin,GPIO.OUT);
        GPIO.output(self.dirpin, GPIO.LOW);
        
    def move(self, dir, steps, delay=0.2):
        if(dir == 0):
            GPIO.output(self.dirpin, GPIO.LOW)
        elif(dir == 1):
            GPIO.output(self.dirpin, GPIO.HIGH)
                        
        for _ in range(steps):
            GPIO.output(self.steppin, GPIO.HIGH)
            time.sleep(delay)
            GPIO.output(self.steppin, GPIO.LOW)
            time.sleep(delay)
            
    def unhold(self):
        GPIO.output(self.steppin,0);
        GPIO.output(self.dirpin,0);

        
