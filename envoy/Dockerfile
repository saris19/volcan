FROM envoyproxy/envoy:v1.31-latest

COPY render-config.sh docker-entrypoint.sh /etc/envoy/
RUN chmod +x /etc/envoy/render-config.sh /etc/envoy/docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/etc/envoy/docker-entrypoint.sh"]
