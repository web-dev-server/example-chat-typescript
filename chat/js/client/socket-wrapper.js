class WebSocketWrapper {
    constructor(url, ...autoReconnectEvents) {
        this._opened = false;
        this._sendQueue = [];
        this._callbacks = new Map();
        this._autoReconnectEvents = '';
        this._url = url;
        if (autoReconnectEvents.length == 0)
            autoReconnectEvents.push('error');
        this.SetAutoReconnectEvents(...autoReconnectEvents);
        this._connect();
    }
    /**
     * Get websocket instance by unique url or create new.
     * @param {string} url
     * @param {...string} autoReconnectEvents `error` if null. Means try to reconnect on error event.
     */
    static GetInstance(url, ...autoReconnectEvents) {
        if (!this._instances.has(url))
            this._instances.set(url, new WebSocketWrapper(url, ...autoReconnectEvents));
        return this._instances.get(url);
    }
    SetAutoReconnectEvents(...autoReconnectEvents) {
        this._autoReconnectEvents = ',' + autoReconnectEvents.join(',') + ',';
        return this;
    }
    Send(eventName, data) {
        var str = JSON.stringify({
            eventName: eventName,
            data: data
        });
        //console.log(this._opened, str);
        if (this._opened) {
            this._socket.send(str);
        }
        else {
            this._sendQueue.push(str);
        }
        ;
        return this;
    }
    Close(code = 1000, reason = 'transaction complete', doNotReconnect = null) {
        if (doNotReconnect == null || doNotReconnect)
            this._autoReconnectEvents = '';
        this._socket.close(code, reason);
        return this;
    }
    Bind(eventName, callback) {
        if (!this._callbacks.has(eventName))
            this._callbacks.set(eventName, []);
        var callbacks = this._callbacks.get(eventName), cbMatched = false;
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
    Unbind(eventName, callback) {
        if (!this._callbacks.has(eventName))
            this._callbacks.set(eventName, []);
        var callbacks = this._callbacks.get(eventName), newCallbacks = [], cb;
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
    _connect() {
        var r = true;
        try {
            this._socket = new WebSocket(this._url);
            this._socket.addEventListener('error', this._onErrorHandler.bind(this));
            this._socket.addEventListener('close', this._onCloseHandler.bind(this));
            this._socket.addEventListener('open', this._onOpenHandler.bind(this));
            this._socket.addEventListener('message', this._onMessageHandler.bind(this));
        }
        catch (e) {
            r = false;
        }
        return r;
    }
    _onOpenHandler(event) {
        var eventName = 'open';
        try {
            this._opened = true;
            if (this._callbacks.has(eventName))
                this._processCallbacks(this._callbacks.get(eventName), [event]);
            if (this._sendQueue.length) {
                for (var i = 0, l = this._sendQueue.length; i < l; i++)
                    this._socket.send(this._sendQueue[i]);
                this._sendQueue = [];
            }
        }
        catch (e) {
            console.error(e);
        }
    }
    _onErrorHandler(event) {
        var eventName = 'error';
        this._opened = false;
        if (this._callbacks.has(eventName))
            this._processCallbacks(this._callbacks.get(eventName), [event]);
        this._autoReconnectIfNecessary(eventName);
    }
    _onCloseHandler(event) {
        var eventName = 'close';
        this._opened = false;
        if (this._callbacks.has(eventName))
            this._processCallbacks(this._callbacks.get(eventName), [event]);
        this._autoReconnectIfNecessary(eventName);
    }
    _autoReconnectIfNecessary(eventName) {
        if (this._autoReconnectEvents.indexOf(',' + eventName + ',') > 0)
            setTimeout(this._connect.bind(this), WebSocketWrapper.RECONNECT_TIMEOUT);
    }
    _onMessageHandler(event) {
        var result = null, eventName = '', data = null;
        try {
            result = JSON.parse(event.data);
            eventName = result.eventName;
            data = result.data;
        }
        catch (e) {
            console.error(e);
        }
        if (eventName.length == 0) {
            console.error('Server data has to be JS object formated like: ' +
                '`{"eventName":"myEvent","data":{"any":"data","as":"object"}}`');
        }
        else if (this._callbacks.has(eventName)) {
            this._processCallbacks(this._callbacks.get(eventName), [data]);
        }
        else {
            console.error("No callback found for socket event: `"
                + eventName + "`, url: `"
                + this._url + "`, data: `"
                + String(event.data) + "`.");
        }
    }
    _processCallbacks(callbacks, args) {
        var cb;
        for (var i = 0, l = callbacks.length; i < l; i++) {
            cb = callbacks[i];
            cb.apply(null, args);
        }
    }
}
WebSocketWrapper.RECONNECT_TIMEOUT = 1000; // 1s
WebSocketWrapper._instances = new Map();
