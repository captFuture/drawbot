from time import sleep
import sys
import motorControl
from Bipolar_Stepper_Motor_Class import Bipolar_Stepper_Motor
import RPi.GPIO as GPIO

#calculate synchronous drive
lsteps = int(sys.argv[1])
rsteps = int(sys.argv[2])
speed = int(sys.argv[3])

ML=Bipolar_Stepper_Motor(13,5);
MR=Bipolar_Stepper_Motor(19,6); 

motorControl.Motor_Step(ML, lsteps, MR, rsteps, speed);

GPIO.cleanup();
print("true");
