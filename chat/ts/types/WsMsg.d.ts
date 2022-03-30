
declare interface WsMsg {
	eventName: string;
	data: WsMsgData;
	live?: boolean;
}