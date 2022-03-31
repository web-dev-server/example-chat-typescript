"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const web_dev_server_1 = require("web-dev-server");
//import { Server, Request, Response, Event } from "../../../../web-dev-server/build/lib/Server";
// Create web server instance.
web_dev_server_1.Server.CreateNew()
    // Required.
    .SetDocumentRoot(__dirname + '/../../')
    // Optional, 8000 by default.
    .SetPort(8000)
    // Optional, '127.0.0.1' by default.
    .SetHostname('127.0.0.1')
    // Optional, `true` by default to display Errors and directories.
    .SetDevelopment(true)
    // Optional, `null` by default, useful for apache proxy modes.
    //.SetBaseUrl('/chat')
    // Optional, to prepend any execution before `web-dev-server` module execution.
    .AddPreHandler((req, res, event) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    if (req.GetPath() == '/health') {
        res.SetCode(200).SetBody('1').Send();
        // Do not anything else in `web-dev-server` module for this request:
        event === null || event === void 0 ? void 0 : event.PreventDefault();
    }
    /*setTimeout(function () {
       throw new Error("Test error:-)");
    }, 1000);*/
}))
    // Callback param is optional. called after server has been started or after error ocured.
    .Start((success, err) => {
    if (!success)
        return console.error(err);
    console.log("Server is running.");
});
//# sourceMappingURL=run.js.map