declare interface ServerOnlineUser {
	id: number;
	sessionId: string;
	user: string;
	socket: WebSocket.WebSocket;
}