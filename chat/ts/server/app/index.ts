import WebSocket from 'ws';
import { promises as fs } from 'fs';
import __prototypeExtending from "./prototype-extending";
///@ts-ignore
global['__prototypeExtending'] = __prototypeExtending;
import ServerSessionNamespace from "./../../types/ServerSessionNamespace";
import * as WebDevServer from "web-dev-server";
//import * as WebDevServer from "../../../../../web-dev-server/build/lib/Server";


export default class App implements WebDevServer.IApplication {
	protected static readonly LAST_CHAT_MESSAGES_TO_SEND: number = 100;
	protected static readonly SESSION_EXPIRATION_SECONDS: number = 60 * 30; // 30 minutes
	protected static readonly SESSION_NAMESPACE_NAME: string = 'chat';
	protected static readonly USERS_DATA_RELATIVE_PATH: string = '/../../../data/login-data.csv';
	protected static readonly LOGS_DIR_RELATIVE_PATH: string = '/../../../logs';
	protected static readonly ALL_USERS_RECEPIENT_NAME: string = 'all';
	protected static: typeof App;
	protected logger: WebDevServer.Tools.Logger;
	protected httpServer: WebDevServer.Server;
	protected wsServer: WebSocket.Server<WebSocket.WebSocket>;
	protected requestPath: string;
	protected onlineUsers: Map<number, ServerOnlineUser> = new Map<number, ServerOnlineUser>();
	protected data: WsMsgServerRecepient[] = [];
	protected typingUsers: Map<string, boolean> = new Map<string, boolean>();
	protected users: Map<string, ServerUserRecord> = new Map<string, ServerUserRecord>();

	public constructor () {
		this.static = new.target;
	}

	public async Start (server: WebDevServer.Server, firstRequest: WebDevServer.Request, firstResponse: WebDevServer.Response): Promise<void> {
		this.logger = new WebDevServer.Tools.Logger(
			__dirname + this.static.LOGS_DIR_RELATIVE_PATH,
			server.GetDocumentRoot()
		);
		this.wsServer = new WebSocket.Server<WebSocket.WebSocket>(<WebSocket.ServerOptions>{
			server: server.GetHttpServer()
		});
		console.log("WebSocket server initialized.");
		this.wsServer.on('connection', await this.handleWebSocketConnection.bind(this));
	}
	public async Stop (server: WebDevServer.Server): Promise<void> {
		this.wsServer.close(function () {
			server.Stop();
		}.bind(this));
		console.log("WebSocket server closed.");
	}
	
	public async HttpHandle (request: WebDevServer.Request, response: WebDevServer.Response): Promise<void> {
		if (!request.IsCompleted()) await request.GetBody();

		if (this.requestPath == null)
			this.requestPath = request.GetBasePath() + request.GetPath();
		
		var session = await WebDevServer.Session.Start(request, response),
			sessionNamespace = await this.getSessionNamespace(session.GetId());

		if (this.users.size === 0) 
			this.users = await this.httpHandleLoadUsersCsv();

		var responseBody = this.httpHandleAuthUser(request, sessionNamespace);

		response.SetBody(JSON.stringify(responseBody)).Send();
	}
	protected async httpHandleLoadUsersCsv (): Promise<Map<string, ServerUserRecord>> {
		var content: Buffer = await fs.readFile(__dirname + this.static.USERS_DATA_RELATIVE_PATH),
			rows: string[] = content.toString().replace(/\r/g, '').split('\n'),
			result = new Map<string, ServerUserRecord>();
        rows.shift(); // remove csv heading line
		rows.forEach((row, i) => {
			var data: string[] = row.split(';'),
				username: string = data[2];
			result.set(username, <ServerUserRecord>{
				id: parseInt(data[0], 10),
				name: data[1],
				user: username,
				pass: data[3]
			});
		});
		return result;
	}
	protected httpHandleAuthUser (request: WebDevServer.Request, sessionNamespace: ServerSessionNamespace): AjaxMsgServerLogin {
		var ajaxResponse = <AjaxMsgServerLogin>{
			success: false,
			id: null,
			message: null
		}
		if (request.GetMethod() !== 'POST') {
			ajaxResponse.message = 'Wrong request method.';
		} else if (!request.HasParam('login-submit')) {
			ajaxResponse.message = 'No authentication credentials sent.';
		} else if (sessionNamespace.authenticated) {
			ajaxResponse.success = true;
			ajaxResponse.id = sessionNamespace.id;
			ajaxResponse.user = sessionNamespace.user;
			ajaxResponse.message = 'User is already authenticated.';
		} else {
			/***************************************************************************/
			/**                          CSV users comparation                        **/
			/***************************************************************************/
			var user = request.GetParam("user", "\-\._@a-zA-Z0-9", ""),
				pass = request.GetParam("pass", "\-\._@a-zA-Z0-9", "");
			if (!this.users.has(user)) {
				ajaxResponse.message = 'User doesn\'t exist';
			} else if (this.users.has(user) && String(this.users.value(user).pass) !== String(pass)) {
				ajaxResponse.message = 'Wrong user password.';
			} else {
				
				var id = this.users.value(user).id;
				sessionNamespace.id = id;
				sessionNamespace.user = user;
				sessionNamespace.authenticated = true;
				
				ajaxResponse.success = true;
				ajaxResponse.id = id;
				ajaxResponse.user = user;
				ajaxResponse.message = "User has been authenticated.";

			}
			/***************************************************************************/
		}
		return ajaxResponse;
	}

	protected async handleWebSocketConnection (socket: WebSocket.WebSocket, request: WebDevServer.Request): Promise<void> {
		var reqPath = request.GetBasePath() + request.GetPath();
		if (reqPath !== this.requestPath) 
			return console.log(`Websocket connection to different path: '${reqPath}'.`);
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
		var sessionNamespace = await this.getSessionNamespace(sessionId);
		if (!sessionNamespace.authenticated) {
			console.log(`Connected not authorized user (session id: '${sessionId}').`);
			return socket.close(4000, 'Not authorized session.');
		}
		var id = sessionNamespace.id,
			user = sessionNamespace.user;
		console.log(`Connected authenticated user (user: '${user}', session id: '${sessionId}').`);
		this.sendToMyself('connection', <WsMsgServerConnection>{
			id: id,
			user: user,
			message: 'Welcome, you are connected.'
		}, socket);
		if (!this.onlineUsers.has(id)) {
			this.onlineUsers.set(id, <ServerOnlineUser>{
				id: id,
				sessionId: sessionId,
				user: user,
				ws: socket
			});
		}
		this.sendLastComunication(socket, sessionId, id);
		socket.on('message', async (rawData: WebSocket.RawData, isBinary: boolean): Promise<void> => {
			try {
				await this.handleWebSocketOnMessage(rawData, socket, String(sessionId));
			} catch (e) {
				if (e instanceof Error) {
					this.logger.Error(e as Error);
				} else {
					console.error(e);
				}
			}
		});
		socket.on('close', this.handleWebSocketOnClose.bind(this, sessionId));
		socket.on('error', this.handleWebSocketOnError.bind(this, sessionId));
	}
	protected async handleWebSocketOnMessage (rawData: WebSocket.RawData, socket: WebSocket.WebSocket, sessionId: string): Promise<void> {
		var sendedData = JSON.parse(rawData.toString()) as WsMsg,
			eventName = sendedData.eventName;
		
		if (eventName == 'login') {
			this.handleWebSocketOnChatLogin(sendedData.data, sessionId);

		} else if (eventName == 'logout') {
			await this.handleWebSocketOnChatLogout(sendedData.data);

		} else if (eventName == 'message') {
			this.handleWebSocketOnChatMessage(sendedData.data, socket);

		} else if (eventName == 'typing') {
			this.handleWebSocketOnChatTyping(sendedData.data);

		}
	}

	protected handleWebSocketOnChatLogin (data: WsMsgData, sessionId: string): void {
		this.sendToAllExceptMyself('login', <WsMsgServerLoginLogout>{
			onlineUsers: this.serializeOnlineUsers().toObject(), 
			onlineUsersCount: this.onlineUsers.size, 
			id: data.id,
			user: data.user
		}, sessionId);
		console.log(`User '${data.user}' joined the chat room.`);
	}
	protected async handleWebSocketOnChatLogout (data: WsMsgData): Promise<void> {
		if (this.onlineUsers.has(data.id)) {
			var userToDelete = await this.logOutUser(this.onlineUsers.value(data.id).sessionId, true);
			if (userToDelete != null)
				console.log(`User '${userToDelete.user}' exited the chat room (logout button).`);
		} else {
			try {
				throw new Error(`No user for id '${data.id}' to log out.`);
			} catch (e) {
				this.logger.Error(e as Error);
			}
		}
	}
	protected handleWebSocketOnChatMessage (data: WsMsgData, socket: WebSocket.WebSocket): void {
		var msgData = data as WsMsgClientMessage,
			[recepientName, recepientId] = this.getWebSocketMessageRecepient(msgData),
			clientMsgData = <WsMsgServerMessage>{
				id: data.id,
				user: data.user,
				content: msgData.content,
				recepient: recepientName
			};
		
		if (recepientName == this.static.ALL_USERS_RECEPIENT_NAME) {
			this.sendToAll('message', clientMsgData);
			console.log(`User '${data.user}' send message '${msgData.content}' to all users.`);
		} else {
			if (this.onlineUsers.has(Number(recepientId))) {
				console.log(`User '${data.user}' send message '${msgData.content}' to user '${recepientName}'.`);
				this.sendToSingle(
					'message', clientMsgData, 
					this.onlineUsers.value(Number(recepientId)).sessionId
				);
			} else {
				console.log(`User '${data.user}' send message '${msgData.content}' to unknown user.`);
			}
			this.sendToMyself('message', clientMsgData, socket);
		}
	}
	protected handleWebSocketOnChatTyping (data: WsMsgData): void {
		var typingData = data as WsMsgClientTyping,
			typing = typingData.typing != null && typingData.typing;
		this.typingUsers.set(data.user, typing);
		var clientTypingData = this.typingUsers.toObject() as WsMsgServerTyping,
			[recepientName, recepientId] = this.getWebSocketMessageRecepient(data as WsMsgClientTyping);

		if (recepientName == this.static.ALL_USERS_RECEPIENT_NAME) {
			this.sendToAll('typing', clientTypingData);
			console.log(`User '${data.user}' send notification about typing to all users.`);
		} else {
			if (this.onlineUsers.has(Number(recepientId))) {
				console.log(`User '${data.user}' send notification about typing to user '${recepientName}'.`);
				this.sendToSingle(
					'typing', clientTypingData, 
					this.onlineUsers.value(Number(recepientId)).sessionId
				);
			} else {
				console.log(`User '${data.user}' send notification about typing to to unknown user.`);
			}
		}
	}

	protected async handleWebSocketOnClose (sessionId: string, code: number, reason: Buffer): Promise<void> {
		var userToDelete = await this.logOutUser(sessionId, false);
		if (userToDelete != null)
			console.log(`User '${userToDelete.user}' exited the chat room (code: ${code}, reason: ${reason}).`);
	}
	protected async handleWebSocketOnError (sessionId: string, err: Error): Promise<void> {
		this.logger.Error(err);
		var userToDelete = await this.logOutUser(sessionId, false);
		if (userToDelete != null)
			console.log(`User '${userToDelete.user}' exited the chat room because of an error.`);
	}
	protected async logOutUser (sessionId: string, deauthenticateHttpSession: boolean): Promise<ServerOnlineUser | null> {
		var userToDelete: ServerOnlineUser | null = null;
		for (var [userId, onlineUser] of this.onlineUsers) {
			if (sessionId === onlineUser.sessionId) {
				userToDelete = onlineUser;
				break;
			}
		}
		if (userToDelete != null) 
			this.onlineUsers.delete(userToDelete.id);
		if (deauthenticateHttpSession) {
			var sessionNamespace = await this.getSessionNamespace(sessionId);
			sessionNamespace.authenticated = false;
		}
		if (userToDelete == null) 
			return null;
		this.typingUsers.set(userToDelete.user, false);
		this.sendToAllExceptMyself('typing', this.typingUsers.toObject() as WsMsgServerTyping, sessionId);
		this.sendToAllExceptMyself('logout', <WsMsgServerLoginLogout>{
			onlineUsers: this.serializeOnlineUsers().toObject(), 
			onlineUsersCount: this.onlineUsers.size, 
			id: userToDelete.id,
			user: userToDelete.user
		}, sessionId);
		return userToDelete;
	}

	protected sendToAll (eventName: string, data: WsMsgData | WsMsgServerTyping): void {
		var response = <WsMsgServerRecepient>{
			eventName: eventName,
			data: data,
			live: true
		};
		var responseStr = JSON.stringify(response);
		delete response.live;
		if (eventName !== 'typing')
			this.data.push(response);
		if (this.data.length > this.static.LAST_CHAT_MESSAGES_TO_SEND)
			this.data.shift();
		for (var [userId, onlineUser] of this.onlineUsers) {
			if (onlineUser.ws != null && onlineUser.ws.readyState === WebSocket.OPEN) {
				try {
					onlineUser.ws.send(responseStr);
				} catch (e) {
					this.logger.Error(e as Error);
				}
			}
		}
	}
	protected sendToSingle (eventName: string, data: WsMsgData | WsMsgServerTyping, targetSessionId: string): void {
		var response = <WsMsgServerRecepient>{
			eventName: eventName,
			data: data,
			live: true
		};
		var responseStr = JSON.stringify(response);
		delete response.live;
		response.targetSessionId = targetSessionId;
		if (eventName !== 'typing')
			this.data.push(response);
		if (this.data.length > this.static.LAST_CHAT_MESSAGES_TO_SEND)
			this.data.shift();
		for (var [userId, onlineUser] of this.onlineUsers) {
			if (onlineUser.sessionId === targetSessionId) {
				if (onlineUser.ws != null && onlineUser.ws.readyState === WebSocket.OPEN) {
					try {
						onlineUser.ws.send(responseStr);
					} catch (e) {
						this.logger.Error(e as Error);
					}
				}
				break;
			}
		}
	}
	protected sendToMyself (eventName: string, data: WsMsgData, socket: WebSocket.WebSocket): void {
		var responseStr = JSON.stringify(<WsMsg>{
			eventName: eventName,
			data: data,
			live: true
		});
		if (socket.readyState !== WebSocket.OPEN) 
			return;
		try {
			socket.send(responseStr);
		} catch (e) {
			console.log(e);
		}
	}
	protected sendToAllExceptMyself (eventName: string, data: WsMsgData | WsMsgServerTyping, myselfSessionId: string): void {
		var response = <WsMsgServerRecepient>{
			eventName: eventName,
			data: data,
			live: true
		};
		var responseStr = JSON.stringify(response);
		delete response.live;
		if (eventName !== 'typing')
			this.data.push(response);
		if (this.data.length > this.static.LAST_CHAT_MESSAGES_TO_SEND)
			this.data.shift();
			for (var [userId, onlineUser] of this.onlineUsers) {
			if (onlineUser.sessionId !== myselfSessionId) {
				if (onlineUser.ws && onlineUser.ws.readyState === WebSocket.OPEN) {
					try {
						onlineUser.ws.send(responseStr);
					} catch (e) {
						this.logger.Error(e as Error);
					}
				}
				break;
			}
		}
	}

	protected sendLastComunication (socket: WebSocket.WebSocket, sessionId: string, currentUserId: number): void {
		// send last n messages:
		if (this.data.length === 0) return;
		var lastMessagesCount = this.static.LAST_CHAT_MESSAGES_TO_SEND, 
			response: WsMsgServerRecepient;
		for (
			var i = 0;
			i < Math.min(this.data.length - 1, this.static.LAST_CHAT_MESSAGES_TO_SEND); 
			i += 1
		) {
			response = this.data[i];
			if (
				response.eventName !== 'message' && 
				response.eventName !== 'login' && 
				response.eventName !== 'logout'
			) 
				continue;
			if (
				response.targetSessionId == null ||
				response.targetSessionId === sessionId || 
				response.data.id === currentUserId
			) {
				socket.send(JSON.stringify(<WsMsg>{
					eventName: response.eventName,
					data: response.data,
					live: false
				}));
			}
		}
	}

	protected serializeOnlineUsers (): Map<number, string> {
		var onlineUsers = new Map<number, string>();
		for (var [uid, onlineUser] of this.onlineUsers) 
			onlineUsers.set(uid, onlineUser.user);
		return onlineUsers;
	}
	protected getWebSocketMessageRecepient (data: WsMsgClientMessage | WsMsgClientTyping): [string, number | null] {
		var recepientName: string = this.static.ALL_USERS_RECEPIENT_NAME,
			recepientId: number | null = null;
		if (data.recepient != null && String(data.recepient) != '') {
			recepientName =  data.recepient;
			if (this.users.has(recepientName)) 
				recepientId = this.users.value(recepientName).id;
		}
		return [recepientName, recepientId];
	} 
	protected async getSessionNamespace (sessionId: string): Promise<ServerSessionNamespace> {
		var session = await WebDevServer.Session.Get(sessionId),
			sessionNamespace = session.GetNamespace(this.static.SESSION_NAMESPACE_NAME) as ServerSessionNamespace;
		sessionNamespace.SetExpirationSeconds(this.static.SESSION_EXPIRATION_SECONDS);
		return sessionNamespace;
	}
};