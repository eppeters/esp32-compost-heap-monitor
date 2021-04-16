import gc
import micropython as mp
from lib import adafruit_mlx90640
mp.mem_info()
gc.collect()
mp.mem_info()
from lib.busio import I2C
mp.mem_info()
gc.collect()
mp.mem_info()

def get_mlx():
    mlx = adafruit_mlx90640.MLX90640(I2C())
    mlx.refresh_rate = adafruit_mlx90640.RefreshRate.REFRESH_0_5_HZ
    return mlx

def main():
    pass
    #mlx = get_mlx()

if __name__ == '__main__':
    main()