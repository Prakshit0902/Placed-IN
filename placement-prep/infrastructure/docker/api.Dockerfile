FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages packages
COPY apps/api apps/api

RUN npm install

EXPOSE 3001

CMD ["npm", "run", "dev", "--workspace=api"]
