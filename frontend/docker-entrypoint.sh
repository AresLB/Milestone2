#!/bin/sh
set -e

# Use a writable directory for SSL certificates
SSL_DIR=/var/run/nginx-ssl

# Generate SSL certificates if they don't exist
if [ ! -f $SSL_DIR/nginx-selfsigned.crt ]; then
    echo "Generating self-signed SSL certificates..."
    mkdir -p $SSL_DIR
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout $SSL_DIR/nginx-selfsigned.key \
        -out $SSL_DIR/nginx-selfsigned.crt \
        -subj "/C=AT/ST=Vienna/L=Vienna/O=University/OU=IMSE/CN=localhost"

    chmod 644 $SSL_DIR/nginx-selfsigned.crt
    chmod 600 $SSL_DIR/nginx-selfsigned.key
    echo "SSL certificates generated successfully in $SSL_DIR"
    ls -la $SSL_DIR
fi

# Execute the default nginx entrypoint
exec /docker-entrypoint.sh "$@"
