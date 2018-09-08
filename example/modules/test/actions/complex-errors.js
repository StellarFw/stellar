exports.default = {
  name: "complexErrors",
  async run () {
    console.log('AQUI')
    throw {
      reason: {
        code: "100",
        message: "Just a test!"
      }
    }
  }
}
