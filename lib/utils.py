import micropython
import time

import gc


def connect_wifi(
    ap_name,
    password,
    max_retries=5,
    wait_connect_s=2,
    retry_delay_s=1,
    post_disconnect_wait_s=0.5,
):

    from network import WLAN, STA_IF, STAT_CONNECTING

    wlan = WLAN(STA_IF)
    wlan.active(True)
    retries = 0
    start_time = 0
    elapsed_time = 0
    new_time = 0
    while retries < max_retries and not wlan.isconnected():
        print(
            "trying wifi connection. retries = {} out of {}".format(
                retries, max_retries
            )
        )
        if retries > 0 and not wlan.isconnected():
            print("waiting {} secs to retry wifi".format(retry_delay_s))
            time.sleep(retry_delay_s)
        wlan.connect(ap_name, password)
        if wlan.status() == STAT_CONNECTING:
            print("Wifi connecting, waiting up to {}s".format(wait_connect_s))
            elapsed_time = 0
            start_time = time.time()
            while not wlan.isconnected() and elapsed_time < wait_connect_s:
                time.sleep(0.1)
                new_time = time.time() - start_time
                if new_time - elapsed_time >= 1:
                    print("Waited {}s for connect so far".format(elapsed_time))
                elapsed_time = new_time
            if wlan.status() == STAT_CONNECTING:
                print("Wifi still connecting at end of wait, disconnecting")
                wlan.disconnect()
                print("Waiting {}s after disconnect".format(post_disconnect_wait_s))
                time.sleep(post_disconnect_wait_s)
        retries += 1
    print("wifi connected? {}".format(wlan.isconnected()))
    del WLAN, STA_IF, retries, start_time, elapsed_time, new_time
    gc.collect()
    return wlan


def get_mqtt(
    client_id, host, port=8883, key_path="certs/iot.key", cert_path="certs/iot.cert"
):
    from umqtt.simple import MQTTClient

    print("Reading cert {}".format(cert_path))
    with open(cert_path, "r") as f:
        cert = f.read()
    print("Reading key {}".format(cert_path))
    with open(key_path, "r") as f:
        key = f.read()
    mqtt = MQTTClient(
        client_id,
        host,
        port=port,
        ssl=True,
        ssl_params=dict(cert=cert, key=key, server_side=False),
    )
    del cert, key, cert_path, key_path
    gc.collect()
    return mqtt


def get_thermal_cam_data(
    buffer, power_pin, i2c_data_pin, i2c_clock_pin, i2c_frequency=400000
):
    """Populate array with Celsius temps"""
    import adafruit_mlx90640
    from busio import I2C

    try:
        print("Initializing camera object")
        mlx = adafruit_mlx90640.MLX90640(
            I2C(pins=(i2c_clock_pin, i2c_data_pin), frequency=i2c_frequency)
        )
        print("Setting refresh rate")
        mlx.refresh_rate = adafruit_mlx90640.RefreshRate.REFRESH_0_5_HZ
        print("Waiting for frame data after power on")
        time.sleep_ms(int(mlx.subpage_wait_ms * 2))
        print("Loading frame data into buffer")
        mlx.getFrame(buffer)
        print("Loaded frame data into buffer")
        del adafruit_mlx90640, mlx
    finally:
        print("Turning off pin {}".format(power_pin))
        power_pin.off()
        gc.collect()


def get_temp_probe_readings(onewire_pin, power_pin, probe_ids, buffer):
    """Read thermometers, placing the readings in the buffer.

    Values will be written in the order of probe_ids, where probe_ids values
    must be integers representing the probes' OneWire IDs.
    These can be gotten like so (ds is the DS18X20 object):
    >>> [hex(int.from_bytes(i, 'big')) for i in ds.scan()]
        ['0x28abb47b0c00006d', '0x28597d8c0c000057', '0x2864568b0c0000fe']
    Note that you should omit the quotations when referring to these in code.
    In other words, use the actual values returned by int.from_bytes(i, 'big')
    Converting to a hex string above is just for readability.

    Values will be in Celsius.
    """
    import ds18x20, onewire, time
    from machine import Pin

    assert len(probe_ids) == len(buffer)

    vout_pin = Pin(power_pin, Pin.OUT)
    vout_pin.on()
    try:
        ow = onewire.OneWire(Pin(onewire_pin))
        ds = ds18x20.DS18X20(ow)
        ds.convert_temp()
        time.sleep_ms(750)
        roms = ds.scan()
        print(roms)
        buffer_index = 0
        for rom in roms:
            buffer_index = probe_ids.index(int.from_bytes(rom, "big"))
            buffer[buffer_index] = ds.read_temp(rom)
        del ds, roms, ow, buffer_index
    finally:
        vout_pin.off()
        del Pin, ds18x20, onewire, time, vout_pin
        gc.collect()


def make_json_message(timestamp, infared_list, probes_dict):
    """Timestamp should be synched with NTP."""
    infared_list_str = str(infared_list)[11:-1]
    del infared_list
    gc.collect()
    probes_object_str = "{{ {} }}".format(
        ",".join(['"{}": {}'.format(k, v) for k, v in probes_dict.items()])
    )
    # Time Epoch: Unix port uses standard for POSIX systems epoch of 1970-01-01
    # 00:00:00 UTC. However, embedded ports use epoch of 2000-01-01 00:00:00 UTC.
    # This is 946684800 seconds later than the Unix epoch.
    # https://stackoverflow.com/a/60180717
    message_str = '{{ "infared_temps": {}, "probe_temps": {}, "message_timestamp": {} }}'.format(
        infared_list_str, probes_object_str, timestamp + 946684800
    )
    del infared_list_str, probes_object_str
    gc.collect()
    return message_str

def thermal_cam_power_on(power_pin, warm_up_time_s=2):
    from machine import Pin
    vpin = Pin(power_pin, Pin.OUT)
    vpin.on()
    print("Pin {} on".format(power_pin))
    print("Giving cam time to warm up")
    time.sleep(warm_up_time_s)
    del Pin
    gc.collect()
    return vpin