declare interface ServerOnlineUser {
	id: number;
	sessionId: string;
	user: string;
	ws: WebSocket.WebSocket;
}