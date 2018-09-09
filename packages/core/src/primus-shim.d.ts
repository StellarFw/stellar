declare module Primus {
  const connect: (url: string, options: any) => any;

  class EventEmitter {
    welcomeMessage: String;
    removeListener(name: String, handler: any);
    on(name: String, handler: any);
    emit(name: String, ...arguments: Array<any>);
    _emit(name: String, ...arguments: Array<any>);
  }
}
