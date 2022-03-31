declare interface WsMsgServerOnlineUsers {
	[userId: number]: string;
}
declare interface WsMsgServerLoginLogout extends WsMsgData {
	onlineUsers: WsMsgServerOnlineUsers;
	onlineUsersCount: number;
}