FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

ARG PUBLIC_API_BASE
ARG PUBLIC_ROBOTS
ENV PUBLIC_API_BASE=${PUBLIC_API_BASE}
ENV PUBLIC_ROBOTS=${PUBLIC_ROBOTS}

RUN npm run build

ENV HOST=0.0.0.0
EXPOSE 4321

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4321"]
