"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const ws_1 = tslib_1.__importDefault(require("ws"));
const fs_1 = require("fs");
const prototype_extending_1 = tslib_1.__importDefault(require("./prototype-extending"));
///@ts-ignore
global['__unused'] = prototype_extending_1.default;
const WebDevServer = tslib_1.__importStar(require("web-dev-server"));
class App {
    constructor() {
        this.onlineUsers = new Map();
        this.data = [];
        this.typingUsers = new Map();
        this.users = new Map();
        this.static = new.target;
    }
    Start(server, firstRequest, firstResponse) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.logger = new WebDevServer.Tools.Logger(__dirname + this.static.LOGS_DIR_RELATIVE_PATH, server.GetDocumentRoot());
            this.wsServer = new ws_1.default.Server({
                server: server.GetHttpServer()
            });
            console.log("WebSocket server initialized.");
            this.wsServer.on('connection', (socket, request) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                yield this.handleWebSocketConnection(socket, request);
            }));
        });
    }
    Stop(server) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.wsServer.close(function () {
                server.Stop();
            }.bind(this));
            console.log("WebSocket server closed.");
        });
    }
    HttpHandle(request, response) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!request.IsCompleted())
                yield request.GetBody();
            var session = yield WebDevServer.Session.Start(request, response), sessionNamespace = session.GetNamespace(this.static.SESSION_NAMESPACE_NAME);
            sessionNamespace.SetExpirationSeconds(this.static.SESSION_EXPIRATION_SECONDS);
            if (this.users.size === 0)
                this.users = yield this.httpHandleLoadUsersCsv();
            var responseBody = this.httpHandleAuthUser(request, sessionNamespace);
            response.SetBody(JSON.stringify(responseBody)).Send();
        });
    }
    httpHandleLoadUsersCsv() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            var content = yield fs_1.promises.readFile(__dirname + this.static.USERS_DATA_RELATIVE_PATH), rows = content.toString().replace(/\r/g, '').split('\n'), result = new Map();
            rows.shift(); // remove csv heading line
            rows.forEach((row, i) => {
                var data = row.split(';'), username = data[2];
                result.set(username, {
                    id: parseInt(data[0], 10),
                    name: data[1],
                    user: username,
                    pass: data[3]
                });
            });
            return result;
        });
    }
    httpHandleAuthUser(request, sessionNamespace) {
        var ajaxResponse = {
            success: false,
            id: null,
            message: null
        };
        if (request.GetMethod() !== 'POST') {
            ajaxResponse.message = 'Wrong request method.';
        }
        else if (!request.HasParam('login-submit')) {
            ajaxResponse.message = 'No authentication credentials sent.';
        }
        else if (sessionNamespace.authenticated) {
            ajaxResponse.success = true;
            ajaxResponse.id = sessionNamespace.id;
            ajaxResponse.message = 'User is already authenticated.';
        }
        else {
            /***************************************************************************/
            /**                          CSV users comparation                        **/
            /***************************************************************************/
            var user = request.GetParam("user", "\-\._@a-zA-Z0-9", ""), pass = request.GetParam("pass", "\-\._@a-zA-Z0-9", "");
            if (!this.users.has(user)) {
                ajaxResponse.message = 'User doesn\'t exist';
            }
            else if (this.users.has(user) && String(this.users.value(user).pass) !== String(pass)) {
                ajaxResponse.message = 'Wrong user password.';
            }
            else {
                var id = this.users.value(user).id;
                sessionNamespace.id = id;
                sessionNamespace.user = user;
                sessionNamespace.authenticated = true;
                ajaxResponse.success = true;
                ajaxResponse.id = id;
                ajaxResponse.message = "User has been authenticated.";
            }
            /***************************************************************************/
        }
        return ajaxResponse;
    }
    handleWebSocketConnection(socket, request) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            var sessionId = request.GetCookie(WebDevServer.Session.GetCookieName(), "a-zA-Z0-9");
            if (sessionId == null) {
                console.log("Connected user with no session id.");
                return socket.close(4000, 'No session id.');
            }
            var sessionExists = WebDevServer.Session.Exists(request);
            if (!sessionExists) {
                console.log(`Connected user with no started session (session id: '${sessionId}').`);
                return socket.close(4000, 'No started session.');
            }
            var session = yield WebDevServer.Session.Get(sessionId), sessionNamespace = session.GetNamespace(this.static.SESSION_NAMESPACE_NAME);
            sessionNamespace.SetExpirationSeconds(this.static.SESSION_EXPIRATION_SECONDS);
            if (!sessionNamespace.authenticated) {
                console.log(`Connected not authorized user (session id: '${sessionId}').`);
                return socket.close(4000, 'Not authorized session.');
            }
            var id = sessionNamespace.id, user = sessionNamespace.user;
            console.log(`Connected authenticated user (user: '${user}', session id: '${sessionId}').`);
            this.sendToMyself('connection', {
                id: id,
                user: user,
                message: 'Welcome, you are connected.'
            }, socket);
            if (!this.onlineUsers.has(id)) {
                this.onlineUsers.set(id, {
                    id: id,
                    sessionId: sessionId,
                    user: user,
                    ws: socket
                });
            }
            this.sendLastComunication(socket, sessionId, id);
            socket.on('message', (rawData, isBinary) => {
                try {
                    this.handleWebSocketOnMessage(rawData, socket);
                }
                catch (e) {
                    if (e instanceof Error) {
                        this.logger.Error(e);
                    }
                    else {
                        console.error(e);
                    }
                }
            });
            socket.on('close', this.handleWebSocketOnClose.bind(this, sessionId));
            socket.on('error', this.handleWebSocketOnError.bind(this, sessionId));
        });
    }
    handleWebSocketOnMessage(rawData, socket) {
        var sendedData = JSON.parse(rawData.toString()), eventName = sendedData.eventName;
        if (eventName == 'login') {
            this.handleWebSocketOnChatLogin(sendedData.data);
        }
        else if (eventName == 'message') {
            this.handleWebSocketOnChatMessage(sendedData.data, socket);
        }
        else if (eventName == 'typing') {
            this.handleWebSocketOnChatTyping(sendedData.data);
        }
    }
    handleWebSocketOnChatLogin(data) {
        this.sendToAll('login', {
            onlineUsers: this.serializeOnlineUsers().toObject(),
            onlineUsersCount: this.onlineUsers.size,
            id: data.id,
            user: data.user
        });
        console.log(`User '${data.user}' joined the chat room.`);
    }
    handleWebSocketOnChatMessage(data, socket) {
        var msgData = data, [recepientName, recepientId] = this.getWebSocketMessageRecepient(msgData), clientMsgData = {
            id: data.id,
            user: data.user,
            content: msgData.content,
            recepient: recepientName
        };
        if (recepientName == this.static.ALL_USERS_RECEPIENT_NAME) {
            this.sendToAll('message', clientMsgData);
            console.log(`User '${data.user}' send message '${msgData.content}' to all users.`);
        }
        else {
            if (this.onlineUsers.has(Number(recepientId))) {
                console.log(`User '${data.user}' send message '${msgData.content}' to user '${recepientName}'.`);
                this.sendToSingle('message', clientMsgData, this.onlineUsers.value(Number(recepientId)).sessionId);
            }
            else {
                console.log(`User '${data.user}' send message '${msgData.content}' to unknown user.`);
            }
            this.sendToMyself('message', clientMsgData, socket);
        }
    }
    handleWebSocketOnChatTyping(data) {
        var typingData = data, typing = typingData.typing != null && typingData.typing;
        this.typingUsers.set(data.user, typing);
        var clientTypingData = this.typingUsers.toObject(), [recepientName, recepientId] = this.getWebSocketMessageRecepient(data);
        if (recepientName == this.static.ALL_USERS_RECEPIENT_NAME) {
            this.sendToAll('typing', clientTypingData);
            console.log(`User '${data.user}' send notification about typing to all users.`);
        }
        else {
            if (this.onlineUsers.has(Number(recepientId))) {
                console.log(`User '${data.user}' send notification about typing to user '${recepientName}'.`);
                this.sendToSingle('typing', clientTypingData, this.onlineUsers.value(Number(recepientId)).sessionId);
            }
            else {
                console.log(`User '${data.user}' send notification about typing to to unknown user.`);
            }
        }
    }
    handleWebSocketOnClose(sessionId, code, reason) {
        var userToDelete = this.deleteOnlineUserBySessionId(sessionId);
        if (userToDelete == null)
            return;
        this.sendToAllExceptMyself('logout', {
            onlineUsers: this.serializeOnlineUsers().toObject(),
            onlineUsersCount: this.onlineUsers.size,
            id: userToDelete.id,
            user: userToDelete.user
        }, sessionId);
        console.log(`User '${userToDelete.user}' exited the chat room (code: ${code}, reason: ${reason}).`);
    }
    handleWebSocketOnError(sessionId, err) {
        this.logger.Error(err);
        var userToDelete = this.deleteOnlineUserBySessionId(sessionId);
        if (userToDelete == null)
            return;
        this.sendToAllExceptMyself('logout', {
            onlineUsers: this.serializeOnlineUsers().toObject(),
            onlineUsersCount: this.onlineUsers.size,
            id: userToDelete.id,
            user: userToDelete.user
        }, sessionId);
        console.log(`User '${userToDelete.user}' exited the chat room because of an error.`);
    }
    sendToAll(eventName, data) {
        var response = {
            eventName: eventName,
            data: data,
            live: true
        };
        var responseStr = JSON.stringify(response);
        delete response.live;
        this.data.push(response);
        if (this.data.length > this.static.LAST_CHAT_MESSAGES_TO_SEND)
            this.data.shift();
        for (var [userId, onlineUser] of this.onlineUsers) {
            if (onlineUser.ws != null && onlineUser.ws.readyState === ws_1.default.OPEN) {
                try {
                    onlineUser.ws.send(responseStr);
                }
                catch (e) {
                    this.logger.Error(e);
                }
            }
        }
    }
    sendToSingle(eventName, data, targetSessionId) {
        var response = {
            eventName: eventName,
            data: data,
            live: true
        };
        var responseStr = JSON.stringify(response);
        delete response.live;
        response.targetSessionId = targetSessionId;
        this.data.push(response);
        if (this.data.length > this.static.LAST_CHAT_MESSAGES_TO_SEND)
            this.data.shift();
        for (var [userId, onlineUser] of this.onlineUsers) {
            if (onlineUser.sessionId === targetSessionId) {
                if (onlineUser.ws != null && onlineUser.ws.readyState === ws_1.default.OPEN) {
                    try {
                        onlineUser.ws.send(responseStr);
                    }
                    catch (e) {
                        this.logger.Error(e);
                    }
                }
                break;
            }
        }
    }
    sendToMyself(eventName, data, socket) {
        var responseStr = JSON.stringify({
            eventName: eventName,
            data: data,
            live: true
        });
        if (socket.readyState !== ws_1.default.OPEN)
            return;
        try {
            socket.send(responseStr);
        }
        catch (e) {
            console.log(e);
        }
    }
    sendToAllExceptMyself(eventName, data, myselfSessionId) {
        var response = {
            eventName: eventName,
            data: data,
            live: true
        };
        var responseStr = JSON.stringify(response);
        delete response.live;
        this.data.push(response);
        if (this.data.length > this.static.LAST_CHAT_MESSAGES_TO_SEND)
            this.data.shift();
        for (var [userId, onlineUser] of this.onlineUsers) {
            if (onlineUser.sessionId !== myselfSessionId) {
                if (onlineUser.ws && onlineUser.ws.readyState === ws_1.default.OPEN) {
                    try {
                        onlineUser.ws.send(responseStr);
                    }
                    catch (e) {
                        this.logger.Error(e);
                    }
                }
                break;
            }
        }
    }
    sendLastComunication(socket, sessionId, currentUserId) {
        // send last n messages:
        if (this.data.length === 0)
            return;
        var lastMessagesCount = this.static.LAST_CHAT_MESSAGES_TO_SEND, response;
        for (var i = Math.min(this.data.length - 1, this.static.LAST_CHAT_MESSAGES_TO_SEND); i >= 0; i -= 1) {
            response = this.data[i];
            if (response.eventName !== 'message' &&
                response.eventName !== 'login' &&
                response.eventName !== 'logout')
                continue;
            if (response.targetSessionId == null ||
                response.targetSessionId === sessionId ||
                response.data.id === currentUserId) {
                socket.send(JSON.stringify({
                    eventName: response.eventName,
                    data: response.data,
                    live: false
                }));
            }
        }
    }
    serializeOnlineUsers() {
        var onlineUsers = new Map();
        for (var [uid, onlineUser] of this.onlineUsers)
            onlineUsers.set(uid, onlineUser.user);
        return onlineUsers;
    }
    getWebSocketMessageRecepient(data) {
        var recepientName = this.static.ALL_USERS_RECEPIENT_NAME, recepientId = null;
        if (data.recepient != null && String(data.recepient) != '') {
            recepientName = data.recepient;
            if (this.users.has(recepientName))
                recepientId = this.users.value(recepientName).id;
        }
        return [recepientName, recepientId];
    }
    deleteOnlineUserBySessionId(sessionId) {
        var userToDelete = null;
        for (var [userId, onlineUser] of this.onlineUsers) {
            if (sessionId === onlineUser.sessionId) {
                userToDelete = onlineUser;
                break;
            }
        }
        if (userToDelete != null) {
            this.onlineUsers.delete(userToDelete.id);
        }
        else {
            try {
                throw new Error(`No user for session id '${sessionId}' to close socket connection.`);
            }
            catch (e) {
                this.logger.Error(e);
            }
            return null;
        }
        return userToDelete;
    }
}
exports.default = App;
App.LAST_CHAT_MESSAGES_TO_SEND = 100;
App.SESSION_EXPIRATION_SECONDS = 60 * 30; // 30 minutes
App.SESSION_NAMESPACE_NAME = 'chat';
App.USERS_DATA_RELATIVE_PATH = '/../../../data/login-data.csv';
App.LOGS_DIR_RELATIVE_PATH = '/../../../logs';
App.ALL_USERS_RECEPIENT_NAME = 'all';
;
