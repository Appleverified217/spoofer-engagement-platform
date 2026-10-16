FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production --legacy-peer-deps

COPY . .

EXPOSE 4000

CMD ["node", "src/server.js"]
