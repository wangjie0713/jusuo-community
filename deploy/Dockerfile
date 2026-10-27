# SPDX-License-Identifier: MPL-2.0
FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json LICENSE NOTICE.md THIRD_PARTY_NOTICES.md ./
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
USER node
EXPOSE 4177
CMD ["node", "server/app.mjs"]
