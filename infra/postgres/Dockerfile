FROM postgis/postgis:16-3.4

# bullseye is EOL; the live deb.debian.org mirror 404s on packages the base
# image's cached index expects. Use the pinned snapshot the image already
# ships (commented out in /etc/apt/sources.list) instead of the live mirror.
RUN printf '%s\n' \
      'deb http://snapshot.debian.org/archive/debian/20240926T000000Z bullseye main' \
      'deb http://snapshot.debian.org/archive/debian-security/20240926T000000Z bullseye-security main' \
      'deb http://snapshot.debian.org/archive/debian/20240926T000000Z bullseye-updates main' \
      > /etc/apt/sources.list \
    && apt-get -o Acquire::Check-Valid-Until=false update \
    && apt-get install -y --no-install-recommends ca-certificates gnupg wget \
    && echo "deb https://packagecloud.io/timescale/timescaledb/debian/ bullseye main" > /etc/apt/sources.list.d/timescaledb.list \
    && wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | apt-key add - \
    && apt-get -o Acquire::Check-Valid-Until=false update \
    && apt-get install -y --no-install-recommends timescaledb-2-postgresql-16 \
    && apt-get purge -y --auto-remove wget gnupg \
    && rm -rf /var/lib/apt/lists/*
