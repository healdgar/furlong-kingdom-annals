# Crown & Commons — the static game served by nginx.
# docker build -t furlong . && docker run --rm -p 8080:80 furlong   → http://localhost:8080
FROM nginx:stable-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
# a static page needs few workers, not one per CPU core
RUN sed -i 's/^worker_processes .*/worker_processes 2;/' /etc/nginx/nginx.conf
COPY index.html LICENSE /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1/healthz || exit 1
