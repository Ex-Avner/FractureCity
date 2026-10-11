FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 MAX_ROOMS=4 DB_PATH=/data/districts.sqlite BACKUP_DIR=/data/backups
WORKDIR /app
COPY server/server.cjs server/store.cjs server/social.cjs server/social-admin.cjs server/start.cjs server/database.cjs server/
COPY apps/ apps/
COPY shared/ shared/
COPY media/music/ media/music/
# The build allowlist excludes saves, databases, credentials and source backups.
# start.cjs fixes ownership of a fresh volume, then drops to uid/gid 1000.
EXPOSE 8080
CMD ["node", "server/start.cjs"]
