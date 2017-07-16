ARG node_version
FROM node:$node_version
ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /opt/app && cp -a /tmp/node_modules /opt/app/
ADD . /opt/app
WORKDIR /opt/app
RUN npm run build
CMD [ "npm", "run", "test" ]
