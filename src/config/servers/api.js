export default {
  general(api) {
    return {
      apiVersion: '0.0.1',
      serverName: 'Stellar API',
      paths: {
        'public': api.scope.rootPath + '/public'
      }
    };
  }
}
