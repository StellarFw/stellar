exports.render = _ => `
FROM node
WORKDIR server
RUN npm set registry https://registry.npmjs.org/
RUN npm install -g stellar-fw
RUN npm install -g babel-polyfill
RUN npm install -g mocha
COPY ./ .
EXPOSE 8080
ENTRYPOINT ["stellar","run"]
`
