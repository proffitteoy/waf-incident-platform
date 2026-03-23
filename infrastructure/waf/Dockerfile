# 使用官方 OpenResty Alpine 镜像，锁定版本确保与下方源码编译时完全一致
FROM openresty/openresty:1.25.3.1-alpine

# 定义 ModSecurity 版本
ENV MODSECURITY_VERSION=v3.0.12
ENV MODSECURITY_NGINX_VERSION=v1.0.3

# 安装编译依赖
RUN apk add --no-cache --virtual .build-deps \
    gcc \
    libc-dev \
    make \
    openssl-dev \
    pcre-dev \
    zlib-dev \
    linux-headers \
    curl \
    git \
    libtool \
    automake \
    autoconf \
    g++ \
    yajl-dev \
    geoip-dev \
    libxml2-dev

# 1. 编译安装 ModSecurity (libmodsecurity)
WORKDIR /tmp
RUN git clone --depth 1 -b ${MODSECURITY_VERSION} --recurse-submodules https://github.com/SpiderLabs/ModSecurity \
    && cd ModSecurity \
    && ./build.sh \
    && ./configure \
    && make -j$(nproc) \
    && make install

# 2. 编译 ModSecurity-nginx Connector

RUN wget https://openresty.org/download/openresty-1.25.3.1.tar.gz \
    && tar xzf openresty-1.25.3.1.tar.gz \
    && git clone --depth 1 -b ${MODSECURITY_NGINX_VERSION} https://github.com/SpiderLabs/ModSecurity-nginx \
    && cd openresty-1.25.3.1 \
    && ./configure --with-compat --add-dynamic-module=../ModSecurity-nginx \
    && gmake \
    && mkdir -p /usr/local/openresty/nginx/modules \
    && cp build/nginx-*/objs/ngx_http_modsecurity_module.so /usr/local/openresty/nginx/modules/

# 清理
RUN apk del .build-deps && rm -rf /tmp/*

# 运行时依赖 (libmodsecurity 需要 + curl 供 HEALTHCHECK 使用)
RUN apk add --no-cache \
    yajl \
    libstdc++ \
    libxml2 \
    geoip \
    curl

# 创建必要的目录
RUN mkdir -p /etc/modsecurity.d/rules \
    && mkdir -p /var/log/modsec \
    && mkdir -p /usr/local/openresty/nginx/lua

# 设置工作目录
WORKDIR /usr/local/openresty/nginx/conf

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost/health || exit 1
