FROM node:4.6

ADD ["./package.json", "/code/package.json"]
WORKDIR /code
RUN npm install
ADD [".", "/code"]
WORKDIR /code

CMD npm run test
