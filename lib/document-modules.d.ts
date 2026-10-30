declare module "*?url" { const value: string; export default value; }
declare module "mammoth/mammoth.browser.js" {
  import mammoth = require("mammoth");
  export default mammoth;
}
