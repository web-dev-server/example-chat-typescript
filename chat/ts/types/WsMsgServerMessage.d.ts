declare interface WsMsgServerMessage extends WsMsgData {
	content: string;
	recepient: string | null;
}