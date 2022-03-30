class Chat {
	static readonly ADDRESS: string = '%websocket.protocol%//%location.host%%location.pathname%js/build/server/app/';
    public Static: typeof Chat;

    private _development: boolean = true;
    private _id: number;
    private _user: string;
    private _socket: WebSocketWrapper;

    private _loginForm: HTMLFormElement;
    private _loginUserElm: HTMLInputElement;
    private _loginPassElm: HTMLInputElement;
    private _logoutBtn: HTMLButtonElement;
    private _chatRoom: HTMLDivElement;
    private _currentUser: HTMLSpanElement;
    private _onlineUsers: HTMLDivElement;
    private _messages: HTMLDivElement;
    private _messageForm: HTMLFormElement;
	private _recepientsElms: RadioNodeList;
    private _messageElm: HTMLTextAreaElement;
    private _recepients: HTMLDivElement;
    private _audioElm: HTMLAudioElement;
    private _typingUsersCont: HTMLDivElement;
    private _typingUsers: HTMLSpanElement;
	
    public constructor () {
        this.Static = new.target;
        this._initElements();
        this._initEvents();
        if (this._development)
            this._developmentAutoLogin();
    }
    
	private _initElements (): void {
        var $ = <T>(id: string) => { return document.getElementById(id) as any; };
        this._loginForm = $<HTMLFormElement>("login-form");
        this._loginUserElm = this._loginForm.user as HTMLInputElement;
        this._loginPassElm = this._loginForm.pass as HTMLInputElement;
        this._logoutBtn = $("logout-btn") as HTMLButtonElement;
        this._chatRoom = $<HTMLDivElement>("chat-room");
        this._currentUser = $<HTMLSpanElement>("current-user");
        this._onlineUsers = $<HTMLDivElement>("online-users");
        this._messages = $<HTMLDivElement>("messages");
        this._messageForm = $<HTMLFormElement>("message-form");
		this._recepientsElms = this._messageForm.rcp as RadioNodeList;
        this._messageElm = this._messageForm.message as HTMLTextAreaElement;
        this._recepients = $<HTMLDivElement>("recepients");
        this._audioElm = $<HTMLAudioElement>("msg-sound");
        this._typingUsersCont = $<HTMLDivElement>("typing-users-cont");
        this._typingUsers = $<HTMLSpanElement>("typing-users");
    }
    private _initEvents (): void {
        this._loginForm.addEventListener('submit', this._loginSubmitHandler.bind(this));
        this._logoutBtn.addEventListener('click', (e: MouseEvent) => {
            this._socket.Close();
            location.reload();
        });
        this._messageForm.addEventListener('submit', this._messageFormSubmitHandler.bind(this));
        this._messageElm.addEventListener('keydown', (e: KeyboardEvent) => {
            // enter + ctrl
            if (e.keyCode == 13 && e.ctrlKey)
                this._messageFormSubmitHandler(e);
        });
        this._messageElm.addEventListener('keyup', (e: KeyboardEvent) => {
            // enter + ctrl
            if (!(e.keyCode == 13 && e.ctrlKey)) {
                this._messageFormTypingHandler(
					String(this._messageElm.value).trim().length > 0, 
					e
				);
            }
        });
        window.addEventListener('unload', (e: Event) => {
            if (this._socket)
                this._socket.Close();
        });
        if (this._development)
            return;
        window.addEventListener('beforeunload', (e: BeforeUnloadEvent) => {
            return e.returnValue = "Do you realy want to leave chat?";
        });
    }
    private _developmentAutoLogin (): void {
        var chrome = navigator.userAgent.indexOf('Chrome') > -1, 
			firefox = navigator.userAgent.indexOf('Firefox') > -1;
        this._loginUserElm.value = chrome
            ? 'james.bond'
            : (firefox
                ? 'moneypenny'
                : 'mr.white');
        this._loginPassElm.value = '1234';
        if (document.createEvent) {
            var eventObject: Event = document.createEvent('Event');
            eventObject.initEvent('submit', true, true);
            this._loginForm.dispatchEvent(eventObject);
        }
        else {
            this._loginForm.dispatchEvent(new Event('submit', <EventInit>{
                bubbles: true,
                cancelable: true
            }));
        }
    }
    private _loginSubmitHandler (e: Event): void {
        var user = this._loginUserElm.value, 
			pass = this._loginPassElm.value;
        if (user != '' && pass != '') {
            var pathName = location.pathname, 
				lastSlashPos = pathName.lastIndexOf('/');
            if (lastSlashPos > -1)
                pathName = pathName.substring(0, lastSlashPos + 1);
            Ajax.load(<Ajax.LoadConfig>{
                url: location.origin + pathName + 'js/server/app/?login-submit',
                method: 'POST',
                data: <AjaxMsgClientLogin>{
                    user: user,
                    pass: pass
                },
                success: (data: AjaxMsgServerLogin, statusCode, xhr) => {
                    if (data.success) {
                        this._initChatRoom(user, data.id);
                    } else {
                        alert("Wrong login or password.");
                    }
                },
                type: 'json',
                error: (responseText, statusCode, xhr) => {
                    alert("Wrong username or password. See: ./chat/data/login-data.csv");
                }
            });
        }
        e.preventDefault();
    }
    private _initChatRoom (user: string, id: number): void {
        this._loginUserElm.value = '';
        this._loginPassElm.value = '';
        this._loginForm.style.display = 'none';
        this._chatRoom.style.display = 'block';
        this._id = id;
        this._user = user;
        this._currentUser.innerHTML = this._user;
        this._scrollToBottom();
        this._initChatWebSocketComunication();
    }
    private _initChatWebSocketComunication (): void {
        // connect to server:
        this._socket = WebSocketWrapper.GetInstance(this.Static.ADDRESS
            .replace('%websocket.protocol%', location.protocol === 'https:' ? 'wss:' : 'ws:')
            .replace('%location.host%', location.host)
            .replace('%location.pathname%', location.pathname));
        // tell the server to login this user:
        this._socket.Send('login', <WsMsgClientLogin>{
            id: this._id,
            user: this._user
        });
        // init web socket server events:
        this._socket.Bind('connection', (data: WsMsgServerConnection): void => {
			console.log(data.message);
		});
        this._socket.Bind('login', this._anyUserLogInHandler.bind(this));
        this._socket.Bind('logout', this._anyUserLogOutHandler.bind(this));
        this._socket.Bind('message', (data: WsMsgServerMessage): void => {
            this._addMessage(
				'content ' + (data.id == this._id ? 'current' : 'other'), 
				data.content, 
				data.user
			);
            this._audioElm.play();
        });
        this._socket.Bind('typing', this._typingUsersHandler.bind(this));
    }
    private _messageFormSubmitHandler (e: Event | KeyboardEvent): void {
        var messageText = String(this._messageElm.value).trim();
        if (messageText != '') {
            this._socket.Send('message', <WsMsgClientMessage>{
                id: this._id,
                user: this._user,
                recepient: this._getRecepient(),
                content: messageText
            });
            this._messageElm.value = '';
        }
        e.preventDefault();
    }
    private _messageFormTypingHandler(typing: boolean, e: KeyboardEvent): void {
        this._socket.Send('typing', <WsMsgClientTyping>{
            id: this._id,
            user: this._user,
            recepient: this._getRecepient(),
            typing: typing
        });
    }
    private _getRecepient(): string {
        var recepientRadio: HTMLInputElement, 
			recepient: string = '';
        for (var i = 0, l = this._recepientsElms.length; i < l; i += 1) {
            recepientRadio = this._recepientsElms[i] as HTMLInputElement;
            if (recepientRadio.checked) {
                recepient = recepientRadio.value;
                break;
            }
        }
        return recepient;
    }
    private _anyUserLogInHandler (data: WsMsgServerLoginLogout): void {
        this._updateOnlineUsersHandler(data);
        this._addMessage('notify', data.user + ' has joined chat');
        this._updateRecepients(data.onlineUsers);
    }
    private _anyUserLogOutHandler(data: WsMsgServerLoginLogout): void {
        this._updateOnlineUsersHandler(data);
        this._addMessage('notify', data.user + ' has leaved chat');
        this._updateRecepients(data.onlineUsers);
    }
    private _addMessage(msgClass: string, msgContent: string, msgAutor: string | null = null): void {
        var msg: HTMLDivElement = document.createElement('div');
        msg.className = 'message ' + msgClass;
        msg.innerHTML = '<div>' + msgContent + '</div>';
        if (msgAutor)
            msg.innerHTML += '<span>' + msgAutor + '</span>';
        this._messages.appendChild(msg);
        this._scrollToBottom();
    }
    private _updateOnlineUsersHandler (data: WsMsgServerLoginLogout): void {
        var onlineUsers = data.onlineUsers, 
			userIdInt: number,
			html: string = '', 
			separator: string = '';
        for (var userIdStr in onlineUsers) {
			html += separator + onlineUsers[userIdStr];
			separator = ', ';
        }
        this._onlineUsers.innerHTML = 'Currently online ('
            + data.onlineUsersCount + ')： ' + html;
    }
    private _typingUsersHandler (data: WsMsgServerTyping): void {
        var typingUsers: string[] = [];
        for (var userName in data)
            if (userName !== this._user && data[userName])
                typingUsers.push(userName);
        if (typingUsers.length === 0) {
            this._typingUsersCont.style.display = 'none';
        } else {
            this._typingUsers.innerHTML = typingUsers.join(', ');
            this._typingUsersCont.style.display = 'block';
        }
    }
    private _updateRecepients (onlineUsers: WsMsgServerOnlineUsers): void {
        var html: string = '',
			idInt: number;
        for (var idStr in onlineUsers) {
			idInt = parseInt(idStr, 10);
            if (idInt === this._id) continue;
            html += '<div>'
                + '<input id="rcp-' + idStr + '" type="radio" name="rcp" value="' + idStr + '" />'
                + '<label for="rcp-' + idStr + '">' + onlineUsers[idStr] + '</label>'
                + '</div>';
        }
        this._recepients.innerHTML = html;
    }
    private _scrollToBottom (): void {
        this._messages.scrollTop = this._messages.scrollHeight;
    }
}

///@ts-ignore
window.chat = new Chat();