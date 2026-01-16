# Use Nginx Alpine for lightweight container
FROM nginx:1.25-alpine

# Remove default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx/nginx.conf /etc/nginx/conf.d/

# Install OpenSSL
RUN apk add --no-cache openssl

# Copy custom entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/custom-entrypoint.sh
RUN chmod +x /usr/local/bin/custom-entrypoint.sh

# Copy static files and fix permissions for macOS Docker
COPY public /usr/share/nginx/html
RUN chmod -R 755 /usr/share/nginx/html && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} \;

# Expose ports
EXPOSE 80 443

# Use custom entrypoint that generates SSL certificates at runtime
ENTRYPOINT ["/usr/local/bin/custom-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
