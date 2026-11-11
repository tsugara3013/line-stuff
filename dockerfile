
FROM node:22-bookworm

WORKDIR /app

COPY package*.json ./

RUN npm ci
RUN npx playwright install --with-deps chromium

COPY . .

CMD ["npm", "start"]
