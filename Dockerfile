# Arduino compile service — arduino-cli + Deno (Hono server)
# Builds .hex/.bin from Arduino C++ sketches for AVR, ESP32, ESP8266, RP2040.

FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    ARDUINO_DIRECTORIES_DATA=/root/.arduino15 \
    ARDUINO_DIRECTORIES_USER=/root/Arduino \
    PATH="/root/.deno/bin:/usr/local/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates unzip git python3 python3-pip xz-utils \
    && rm -rf /var/lib/apt/lists/*

# arduino-cli
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh \
    | BINDIR=/usr/local/bin sh

# Preinstall popular cores so first compile is fast
RUN arduino-cli config init \
 && arduino-cli config set board_manager.additional_urls \
      https://arduino.esp8266.com/stable/package_esp8266com_index.json \
      https://espressif.github.io/arduino-esp32/package_esp32_index.json \
      https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json \
 && arduino-cli core update-index \
 && arduino-cli core install arduino:avr \
 && arduino-cli core install esp32:esp32 \
 && arduino-cli core install esp8266:esp8266 \
 && arduino-cli core install rp2040:rp2040 || true

# Deno runtime for the HTTP server
RUN curl -fsSL https://deno.land/install.sh | sh

WORKDIR /app
COPY server.ts /app/server.ts

ENV PORT=8080
EXPOSE 8080

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--allow-run", "/app/server.ts"]
