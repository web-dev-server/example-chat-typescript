# Example - Chat - TypeScript

[![Latest Stable Version](https://img.shields.io/badge/Stable-v3.0.26-brightgreen.svg?style=plastic)](https://github.com/web-dev-server/example-chat-typescript/releases)
[![License](https://img.shields.io/badge/Licence-BSD-brightgreen.svg?style=plastic)](https://github.com/web-dev-server/example-chat-typescript/blob/master/LICENSE.md)

Chat example with session authentication. Client scripts written in TypeScript, no framework needed.

## Instalation
```shell
git clone https://github.com/web-dev-server/example-chat-typescript.git example-chat-typescript
cd ./example-chat-typescript
npm update
```

## Usage
```shell
node chat/js/server/run.js
```
- open your first web browser on:
  - http://localhost:8000/
  - login with any user and password located in `./chat/data/login-data.csv`
- open your second web browser on:
  - http://localhost:8000/
  - login with any user and password located in `./chat/data/login-data.csv`
- chat between browsers