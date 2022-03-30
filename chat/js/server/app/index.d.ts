/// <reference types="node" />
import WebSocket from 'ws';
import ServerSessionNamespace from "./../../types/ServerSessionNamespace";
import * as WebDevServer from "web-dev-server";
export default class App implements WebDevServer.IApplication {
    protected static readonly LAST_CHAT_MESSAGES_TO_SEND: number;
    protected static readonly SESSION_EXPIRATION_SECONDS: number;
    protected static readonly SESSION_NAMESPACE_NAME: string;
    protected static readonly USERS_DATA_RELATIVE_PATH: string;
    protected static readonly LOGS_DIR_RELATIVE_PATH: string;
    protected static readonly ALL_USERS_RECEPIENT_NAME: string;
    protected static: typeof App;
    protected logger: WebDevServer.Tools.Logger;
    protected httpServer: WebDevServer.Server;
    protected wsServer: WebSocket.Server<WebSocket.WebSocket>;
    protected onlineUsers: Map<number, ServerOnlineUser>;
    protected data: WsMsgServerRecepient[];
    protected typingUsers: Map<string, boolean>;
    protected users: Map<string, ServerUserRecord>;
    constructor();
    Start(server: WebDevServer.Server, firstRequest: WebDevServer.Request, firstResponse: WebDevServer.Response): Promise<void>;
    Stop(server: WebDevServer.Server): Promise<void>;
    HttpHandle(request: WebDevServer.Request, response: WebDevServer.Response): Promise<void>;
    protected httpHandleLoadUsersCsv(): Promise<Map<string, ServerUserRecord>>;
    protected httpHandleAuthUser(request: WebDevServer.Request, sessionNamespace: ServerSessionNamespace): AjaxMsgServerLogin;
    protected handleWebSocketConnection(socket: WebSocket.WebSocket, request: WebDevServer.Request): Promise<void>;
    protected handleWebSocketOnMessage(rawData: WebSocket.RawData, socket: WebSocket.WebSocket): void;
    protected handleWebSocketOnChatLogin(data: WsMsgData): void;
    protected handleWebSocketOnChatMessage(data: WsMsgData, socket: WebSocket.WebSocket): void;
    protected handleWebSocketOnChatTyping(data: WsMsgData): void;
    protected handleWebSocketOnClose(sessionId: string, code: number, reason: Buffer): void;
    protected handleWebSocketOnError(sessionId: string, err: Error): void;
    protected sendToAll(eventName: string, data: WsMsgData | WsMsgServerTyping): void;
    protected sendToSingle(eventName: string, data: WsMsgData | WsMsgServerTyping, targetSessionId: string): void;
    protected sendToMyself(eventName: string, data: WsMsgData, socket: WebSocket.WebSocket): void;
    protected sendToAllExceptMyself(eventName: string, data: WsMsgData, myselfSessionId: string): void;
    protected sendLastComunication(socket: WebSocket.WebSocket, sessionId: string, currentUserId: number): void;
    protected serializeOnlineUsers(): Map<number, string>;
    protected getWebSocketMessageRecepient(data: WsMsgClientMessage | WsMsgClientTyping): [string, number | null];
    protected deleteOnlineUserBySessionId(sessionId: string): ServerOnlineUser | null;
}
//# sourceMappingURL=index.d.ts.map