class MakeCommand {
  constructor() {
    this.flags = "make";
    this.desc = "Generate some project components";
    this.setup = (sywac) => {
      sywac
        .usage({
          commandPlaceholder: "<component>",
        })
        .commandDirectory("make-commands")
        .string("--module <module>", {
          desc: "Module where the file(s) will be created",
          defaultValue: "private",
        })
        .boolean("--force", {
          desc: "Overwrite existent files",
        })
        .outputSettings({ maxWidth: 90 });
    };
  }
}

export default new MakeCommand();
