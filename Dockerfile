# we want to create multiple image versions based on LTS versions and current
ARG node_version

# For: development

FROM node:$node_version AS dev
ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /opt/core && cp -a /tmp/node_modules /opt/core/
ADD . /opt/core

WORKDIR /opt/core

CMD [ "npm", "run", "dev" ]

# For: test

FROM node:${node_version} AS test
RUN npm run build
CMD [ "npm", "run", "test" ]

# For: production

FROM node:${node_version} AS production
RUN npm link && mkdir -p /opt/app
WORKDIR /opt/app
CMD [ "stellar", "run" ]
