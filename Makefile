EXEC = main
SHELL := bash
PORT = /dev/ttyS4
PRUNE = -o -path './build*' -prune -o -path './analysis*' -prune

all: $(EXEC)

install_build_tools:
	pip3 install wheel
	pip3 install mpy-cross
	pip3 install adafruit-ampy
	
build: clean
	mkdir -p build
	find . -name '*.py' -print $(PRUNE) | xargs dirname | sort -u | xargs -I {} mkdir -p build/{}
	eval "set -e; $$(find . -name '*.py' -a \! -name 'main.py' -a \! -name 'boot.py' -print $(PRUNE) | sed "s|\(\./\)\?\(.\+\)\.py|mpy-cross -o build/\2.mpy &|g")"
	cp main.py boot.py build
sync: build
	ampy -p $(PORT) rmdir . 2>.build.log || true
	ampy -p $(PORT) put build .

clean:
	rm -rf build/*