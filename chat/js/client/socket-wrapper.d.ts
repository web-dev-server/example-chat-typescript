declare interface WebSocketMsg {
    eventName: string;
    data: any;
}
declare class WebSocketWrapper {
    static readonly RECONNECT_TIMEOUT: number;
    private static _instances;
    private _url;
    private _socket;
    private _opened;
    private _sendQueue;
    private _callbacks;
    private _autoReconnectEvents;
    /**
     * Get websocket instance by unique url or create new.
     * @param {string} url
     * @param {...string} autoReconnectEvents `error` if null. Means try to reconnect on error event.
     */
    static GetInstance(url: string, ...autoReconnectEvents: string[]): WebSocketWrapper;
    private constructor();
    SetAutoReconnectEvents(...autoReconnectEvents: string[]): WebSocketWrapper;
    Send(eventName: string, data: any): WebSocketWrapper;
    Close(code?: number, reason?: string, doNotReconnect?: boolean | null): WebSocketWrapper;
    Bind(eventName: string, callback: (data: any) => void): WebSocketWrapper;
    Unbind(eventName: string, callback: (data: any) => void): WebSocketWrapper;
    private _connect;
    private _onOpenHandler;
    private _onErrorHandler;
    private _onCloseHandler;
    private _autoReconnectIfNecessary;
    private _onMessageHandler;
    private _processCallbacks;
}
//# sourceMappingURL=socket-wrapper.d.ts.map