declare interface WsMsgClientMessage extends WsMsgData {
    recepient: string;
    content: string;
}