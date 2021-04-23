from time import sleep, time

import gc
from array import array
from machine import deepsleep
import ntptime
from ucollections import namedtuple

from lib.utils import (
    connect_wifi,
    get_mqtt,
    get_thermal_cam_data,
    get_temp_probe_readings,
    make_json_message,
    thermal_cam_power_on
)

gc.collect()

AWS_IOT_CLIENT_ID = "test-esp32-infared"
AWS_IOT_HOST = "ak4oxupdxkr2w-ats.iot.us-east-1.amazonaws.com"
AWS_IOT_PORT = 8883
AWS_IOT_TOPIC = "test-esp32-infared"
AWS_IOT_CERT_PATH = "certs/iot.crt"
AWS_IOT_KEY_PATH = "certs/iot.key"
DEEP_SLEEP_SECS = 2
I2C_CLOCK_PIN = 22
I2C_DATA_PIN = 21
I2C_POWER_PIN = 16
MQTT_QOS = 1
PROBES_ONEWIRE_PIN = 26
PROBES_POWER_PIN = 25
RUN_MAIN = True
START_WAIT_SECS = 10
WIFI_CREDS = ("the internet", "cloudyriver243")
thermometer_names = ["top", "middle", "bottom"]
ThermometerIds = namedtuple("ThermometerIds", thermometer_names)
THERMOMETER_IDS = ThermometerIds(
    0x28ABB47B0C00006D, 0x2864568B0C0000FE, 0x28597D8C0C000057
)


def main():
    """Get sensor data, send it to AWS IoT"""
    vpin = thermal_cam_power_on(I2C_POWER_PIN, warm_up_time_s=START_WAIT_SECS)
    arr = array('float', (float() for _ in range(768)))
    gc.collect()
    probe_buffer = [0] * 3
    print("Getting cam data")
    get_thermal_cam_data(arr, vpin, I2C_DATA_PIN, I2C_CLOCK_PIN)
    del vpin
    print("Getting temperature probe readings")
    get_temp_probe_readings(
        PROBES_ONEWIRE_PIN, PROBES_POWER_PIN, list(THERMOMETER_IDS), probe_buffer
    )
    print("Connecting to wifi")
    connect_wifi(*WIFI_CREDS, wait_connect_s=20)
    print("Wifi connected")
    print("Synching time via NTP")
    ntptime.settime()
    print("Creating mqtt object")
    mqtt = get_mqtt(
        AWS_IOT_CLIENT_ID,
        AWS_IOT_HOST,
        AWS_IOT_PORT,
        key_path="certs/iot.key",
        cert_path="certs/iot.crt",
    )
    print("MQTT object created")
    print("Connecting to MQTT host")
    mqtt.connect()
    print("MQTT host connected")
    print("Publishing to MQTT topic {}".format(AWS_IOT_TOPIC))
    probes_dict = {k: v for k, v in zip(thermometer_names, probe_buffer)}
    message = make_json_message(time(), arr, probes_dict)
    print("JSON data = {}".format(message))
    mqtt.publish(AWS_IOT_TOPIC, message, qos=MQTT_QOS)
    print("Published")


if __name__ == "__main__" and RUN_MAIN:
    print("Start wait: {} secs".format(START_WAIT_SECS))
    try:
        main()
    except Exception as exc:
        print("Caught exception {} in main()".format(exc))
        raise exc
    finally:
        deepsleep(DEEP_SLEEP_SECS)