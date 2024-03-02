export const render = (_) => `
FROM node
WORKDIR server
RUN npm set registry https://registry.npmjs.org/
RUN npm install -g stellar-fw
COPY ./ .
EXPOSE 8080
ENTRYPOINT ["stellar","run"]
`;
