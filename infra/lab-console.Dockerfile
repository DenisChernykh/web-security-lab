FROM node:24-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/sql-lab/package.json apps/sql-lab/package.json
COPY apps/lab-console/package.json apps/lab-console/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/lab-core/package.json packages/lab-core/package.json
RUN npm ci

COPY . .
RUN npm run build --workspace apps/lab-console

FROM nginx:1.29-alpine

COPY infra/lab-console/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/lab-console/dist /usr/share/nginx/html

EXPOSE 8080
