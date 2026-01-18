FROM node:18-bookworm

WORKDIR /app

COPY backend/package*.json ./

RUN npm install

COPY backend/ .
COPY frontend/ /frontend/

EXPOSE 3000

CMD ["npm", "start"]
