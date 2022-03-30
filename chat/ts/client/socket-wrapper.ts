
declare interface WebSocketMsg {
	eventName: string;
	data: any;
}
class WebSocketWrapper {
	public static readonly RECONNECT_TIMEOUT: number = 1000; // 1s
	private static _instances: Map<string, WebSocketWrapper> = new Map<string, WebSocketWrapper>();
	
	private _url:string;
	private _socket: WebSocket;
	private _opened: boolean = false;
	private _sendQueue: string[] = [];
	private _callbacks: Map<string, Function[]> = new Map<string, Function[]>();
	private _autoReconnectEvents: string = '';
	/**
	 * Get websocket instance by unique url or create new.
	 * @param {string} url 
	 * @param {...string} autoReconnectEvents `error` if null. Means try to reconnect on error event.
	 */
	public static GetInstance (url:string, ...autoReconnectEvents:string[]): WebSocketWrapper {
		if (!this._instances.has(url))
			this._instances.set(url, new WebSocketWrapper(
				url, ...autoReconnectEvents
			));
		return this._instances.get(url) as WebSocketWrapper;
	}
	private constructor (url:string, ...autoReconnectEvents:string[]) {
		this._url = url;
		if (autoReconnectEvents.length == 0) 
			autoReconnectEvents.push('error');
		this.SetAutoReconnectEvents(...autoReconnectEvents);
		this._connect();
	}
	public SetAutoReconnectEvents (...autoReconnectEvents: string[]): WebSocketWrapper {
		this._autoReconnectEvents = ',' + autoReconnectEvents.join(',') + ',';
		return this;
	}
	public Send (eventName: string, data: any): WebSocketWrapper {
		var str:string = JSON.stringify(<WebSocketMsg>{
			eventName: eventName, 
			data: data 
		});
		//console.log(this._opened, str);
		if (this._opened) {
			this._socket.send(str);
		} else {
			this._sendQueue.push(str);
		};
		return this;
	}
	public Close (code: number = 1000, reason: string = 'transaction complete', doNotReconnect: boolean | null = null): WebSocketWrapper {
		if (doNotReconnect == null || doNotReconnect)
			this._autoReconnectEvents = '';
		this._socket.close(code, reason);
		return this;
	}
	public Bind (eventName: string, callback: (data: any) => void): WebSocketWrapper {
		if (!this._callbacks.has(eventName)) 
			this._callbacks.set(eventName, []);
		var callbacks: Function[] = this._callbacks.get(eventName) as Function[], 
			cbMatched: boolean = false;
		for (var i = 0, l = callbacks.length; i < l; i++) {
			if (callbacks[i] === callback) {
				cbMatched = true;
				break;
			}
		}
		if (!cbMatched) {
			callbacks.push(callback);
			this._callbacks.set(eventName, callbacks);
		}
		return this;
	}
	public Unbind (eventName: string, callback: (data: any) => void): WebSocketWrapper {
		if (!this._callbacks.has(eventName)) 
			this._callbacks.set(eventName, []);
		var callbacks: Function[] = this._callbacks.get(eventName) as Function[], 
			newCallbacks: Function[] = [], 
			cb: Function;
		for (var i = 0, l = callbacks.length; i < l; i++) {
			cb = callbacks[i];
			if (cb != callback)
				newCallbacks.push(cb);
		}
		this._callbacks.set(eventName, newCallbacks);
		if (newCallbacks.length == 0)
			this._callbacks.delete(eventName);
		return this;
	}
	private _connect (): boolean {
		var r:boolean = true;
		try {
			this._socket = new WebSocket(this._url);
			this._socket.addEventListener('error', this._onErrorHandler.bind(this));
			this._socket.addEventListener('close', this._onCloseHandler.bind(this));
			this._socket.addEventListener('open', this._onOpenHandler.bind(this));
			this._socket.addEventListener('message', this._onMessageHandler.bind(this));
		} catch (e) {
			r = false;
		}
		return r;
	}
	private _onOpenHandler (event: Event): void {
		var eventName:string = 'open';
		try {
			this._opened = true;
			if (this._callbacks.has(eventName))
				this._processCallbacks(this._callbacks.get(eventName) as Function[], [event]);
			if (this._sendQueue.length) {
				for (var i:number = 0, l:number = this._sendQueue.length; i < l; i++)
					this._socket.send(this._sendQueue[i]);
				this._sendQueue = [];
			}
		} catch (e) {
			console.error(e);
		}
	}
	private _onErrorHandler (event: Event): void {
		var eventName: string = 'error';
		this._opened = false;
		if (this._callbacks.has(eventName))
			this._processCallbacks(this._callbacks.get(eventName) as Function[], [event]);
		this._autoReconnectIfNecessary(eventName);
	}
	private _onCloseHandler (event: CloseEvent): void {
		var eventName: string = 'close';
		this._opened = false;
		if (this._callbacks.has(eventName))
			this._processCallbacks(this._callbacks.get(eventName) as Function[], [event]);
		this._autoReconnectIfNecessary(eventName);
	}
	private _autoReconnectIfNecessary (eventName: string): void {
		if (this._autoReconnectEvents.indexOf(',' + eventName + ',') > 0) 
			setTimeout(
				this._connect.bind(this),
				WebSocketWrapper.RECONNECT_TIMEOUT
			);
	}
	private _onMessageHandler (event: MessageEvent): void {
		var result: WebSocketMsg | null = null,
			eventName: string = '',
			data: any = null;
		try {
			result = JSON.parse(event.data) as WebSocketMsg;
			eventName = result.eventName;
			data = result.data;
		} catch (e) {
			console.error(e);
		}
		if (eventName.length == 0) {
			console.error(
				'Server data has to be JS object formated like: '+
				'`{"eventName":"myEvent","data":{"any":"data","as":"object"}}`'
			);
		} else if (this._callbacks.has(eventName)) {
			this._processCallbacks(this._callbacks.get(eventName) as Function[], [data]);
		} else {
			console.error(
				"No callback found for socket event: `" 
				+ eventName + "`, url: `" 
				+ this._url + "`, data: `" 
				+ String(event.data) + "`."
			);
		}
	}
	private _processCallbacks (callbacks: Function[], args: any[]): void {
		var cb: Function;
		for (var i: number = 0, l: number = callbacks.length; i < l; i++) {
			cb = callbacks[i];
			cb.apply(null, args);
		}
	}
}