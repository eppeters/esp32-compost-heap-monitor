EXEC = main
SHELL := bash
PORT = /dev/ttyS4

all: $(EXEC)

install_build_tools:
	pip3 install wheel
	pip3 install mpy-cross
	pip3 install adafruit-ampy
	
build: clean
	mkdir -p build
	find . -name '*.py' -print -o -path './build*' -prune | xargs dirname | sort -u | xargs -I {} mkdir -p build/{}
	eval "$$(find . -name '*.py' -print -o -path './build*' -prune | sed "s|\(\./\)\?\(.\+\)\.py|mpy-cross -o build/\2.mpy &|g")"

sync: build
	ampy -p $(PORT) rmdir . 2>.build.log || true
	ampy -p $(PORT) put build .

clean:
	rm -rf build/*