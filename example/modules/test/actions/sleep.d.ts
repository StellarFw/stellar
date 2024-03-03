export namespace sleep {
    let name: string;
    let description: string;
    namespace inputs {
        namespace sleepDuration {
            export let required: boolean;
            let _default: number;
            export { _default as default };
        }
    }
    namespace outputExample {
        export let sleepStarted: number;
        export let sleepEnded: number;
        export let sleepDelta: number;
        let sleepDuration_1: number;
        export { sleepDuration_1 as sleepDuration };
    }
    function run(api: any, data: any): Promise<any>;
}
