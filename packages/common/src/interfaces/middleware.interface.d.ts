export declare type MiddlewareHandler = () => void;
export interface MiddlewareInterface {
    name: string;
    priority?: number;
    global?: boolean;
    create?: MiddlewareHandler;
    preProcessor?: MiddlewareHandler;
    postProcessor?: MiddlewareHandler;
    join?: MiddlewareHandler;
    say?: MiddlewareHandler;
    onSayReceive?: MiddlewareHandler;
    leave?: MiddlewareHandler;
    destroy?: MiddlewareHandler;
}
//# sourceMappingURL=middleware.interface.d.ts.map