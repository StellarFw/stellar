export declare type EventHandler = (args: any) => void;
export default interface EventInterface {
    event: string;
    priority?: number;
    run: EventHandler;
}
//# sourceMappingURL=event.interface.d.ts.map