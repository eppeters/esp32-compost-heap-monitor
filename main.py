import gc
import micropython as mp
from machine import UART

from lib import adafruit_mlx90640
from lib.busio import I2C
from time import sleep

gc.collect()

SLEEP_SECS = 2
arr = [0] * 768
mlx = adafruit_mlx90640.MLX90640(I2C())
mlx.refresh_rate = adafruit_mlx90640.RefreshRate.REFRESH_0_5_HZ
serial = UART(1)
serial.init(baudrate=115200, rx=14, tx=12)
print('Initialized serial port')
print('Sleeping 1 sec')
sleep(1)
while True:
    print('Tick')
    print('Getting frame')
    mlx.getFrame(arr)
    print('Got frame, writing num bytes=', serial.write(bytearray((int(p) for p in arr))))
    gc.collect()
    sleep(SLEEP_SECS)