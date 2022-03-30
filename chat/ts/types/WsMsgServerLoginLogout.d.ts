declare interface WsMsgServerOnlineUsers {
    [userId: number]: string;
}
declare interface WsMsgServerLoginLogout {
    onlineUsers: WsMsgServerOnlineUsers;
    onlineUsersCount: number;
    id: number;
    user: string;
}