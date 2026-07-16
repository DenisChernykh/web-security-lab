FROM node:24-alpine

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/sql-lab/package.json apps/sql-lab/package.json
COPY apps/lab-console/package.json apps/lab-console/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/lab-core/package.json packages/lab-core/package.json
RUN npm ci

COPY . .

ENV NODE_ENV=production
