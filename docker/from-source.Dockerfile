ARG NODEJS_VERSION=12
FROM node:$NODEJS_VERSION-alpine AS builder

ARG LISK_CORE_GIT_COMMIT=c52f9e9dbd0bb6c2dd8afb5845599d434e63a2e6

ENV PATH="/home/lisk/lisk-core/node_modules/.bin:${PATH}"
ENV LISK_NETWORK=betanet

RUN apk --no-cache upgrade && \
    apk --no-cache add --virtual build-dependencies alpine-sdk autoconf automake libtool linux-headers python git

RUN  apk --no-cache add bash

RUN addgroup -g 1100 lisk && \
    adduser -h /home/lisk -s /bin/bash -u 1100 -G lisk -D lisk

USER lisk
WORKDIR /home/lisk

RUN git clone -n https://github.com/JesusTheHun/lisk-core.git && cd lisk-core && git checkout ${LISK_CORE_GIT_COMMIT}

WORKDIR /home/lisk/lisk-core

RUN npm ci && npm run build
RUN oclif-dev manifest
RUN npm ci --production

FROM node:12-alpine

ENV NODE_ENV=production

RUN apk --no-cache upgrade && \
    apk --no-cache add bash curl jq logrotate

RUN addgroup -g 1100 lisk && \
    adduser -h /home/lisk -s /bin/bash -u 1100 -G lisk -D lisk

RUN cat << EOF > /etc/logrotate.d/lisk
/home/lisk/.lisk/lisk-core/logs/lisk.log {
	daily
	rotate 10
	maxage 180
	compress
	delaycompress
	missingok
	notifempty
}
EOF

COPY --from=builder --chown=lisk:lisk /home/lisk/lisk-core/ /home/lisk/lisk-core/

USER lisk
RUN mkdir /home/lisk/.lisk
VOLUME ["/home/lisk/.lisk"]

WORKDIR /home/lisk

ENTRYPOINT ["/home/lisk/lisk-core/bin/run"]
CMD ["start", "--network", "${LISK_NETWORK}"]
