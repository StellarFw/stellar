import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
  name: "status",
  description: "This action returns some basic information about the API",

  outputExample: {
    id: "example",
    stellarVersion: "1.0.0",
    uptime: 10030,
  },
})
export default class StatusAction extends Action {
  public async run() {
    return {
      id: this.api.id,
      stellarVersion: this.api.stellarVersion,
      uptime: new Date().getTime() - this.api.bootTime,
    };
    // data.response.id = api.id
    // data.response.stellarVersion = api.stellarVersion
    // data.response.uptime = new Date().getTime() - api.bootTime
  }
}
