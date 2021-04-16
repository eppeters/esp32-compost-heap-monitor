
"""
---------------------------------------------------------------------------------------------------------------------------------------
Please note: The following code has been modified from its original form at certain places so that it can work with ESP32-DevKitC-v4 micropython
---------------------------------------------------------------------------------------------------------------------------------------
================================================================================
* Author(s): Avishek Guha (avsg8, @avs_g8), Eddie Peters (eppeters, eddie@dinogalactic.com)

`busio` - Bus protocol support like I2C and SPI
=================================================

See `CircuitPython:busio` in CircuitPython for more details.

* Author(s): cefn
"""

class ContextManaged:
    """An object that automatically deinitializes hardware with a context manager."""
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.deinit()

    # pylint: disable=no-self-use
    def deinit(self):
        """Free any hardware used by the object."""
        return
    # pylint: enable=no-self-use


class Lockable(ContextManaged):
    """An object that must be locked to prevent collisions on a microcontroller resource."""
    _locked = False

    def try_lock(self):
        """Attempt to grab the lock. Return True on success, False if the lock is already taken."""
        if self._locked:
            return False
        self._locked = True
        return True

    def unlock(self):
        """Release the lock so others may use the resource."""
        if self._locked:
            self._locked = False
        else:
            raise ValueError("Not locked")

class I2C(Lockable):
    def __init__(self, pins=(22, 21), frequency=100000):
        """In pins, index 0 is scl, index 1 is sda"""
        self.init(pins, frequency)

    def init(self, pins, frequency):
        from machine import Pin, I2C as _I2C
        self.deinit()
        self._i2c = _I2C(0, scl=Pin(pins[0]), sda=Pin(pins[1]), freq=frequency)

    def deinit(self):
        try:
            del self._i2c
        except AttributeError:
            pass

    def scan(self):
        return self._i2c.scan()

    def readfrom_into(self, address, buffer, *, start=0, end=None):
        if start is not 0 or end is not None:
            if end is None:
                end = len(buffer)
            buffer = memoryview(buffer)[start:end]
        return self._i2c.readfrom_into(address, buffer)

    def writeto(self, address, buffer, *, start=0, end=None, stop=True):
        if isinstance(buffer, str):
            buffer = bytes([ord(x) for x in buffer])
        if start is not 0 or end is not None:
            if end is None:
                return self._i2c.writeto(address, memoryview(buffer)[start:], stop)
            else:
                return self._i2c.writeto(address, memoryview(buffer)[start:end], stop)
        return self._i2c.writeto(address, buffer, stop)