FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 MAX_ROOMS=4 DB_PATH=/data/districts.sqlite BACKUP_DIR=/data/backups
WORKDIR /app
COPY server/server.cjs server/store.cjs server/start.cjs server/database.cjs server/
COPY apps/fracture-city-game/multiplayer.html apps/fracture-city-game/multiplayer.js apps/fracture-city-game/accounts.js apps/fracture-city-game/dispatch-content.js apps/fracture-city-game/dispatch-world.js apps/fracture-city-game/resident-head.js apps/fracture-city-game/
COPY shared/vendor/three.min.js shared/vendor/three.min.js
# start.cjs fixes ownership of a fresh volume, then drops to uid/gid 1000.
EXPOSE 8080
CMD ["node", "server/start.cjs"]
