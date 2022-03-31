class Chat {
	public static readonly AJAX_LOGIN_ADDRESS: string = '%location.protocol%//%location.host%%location.pathname%js/server/app/?login-submit';
	public static readonly WEB_SOCKETS_ADDRESS: string = '%websocket.protocol%//%location.host%%location.pathname%js/server/app/';
	
	protected static: typeof Chat;

	private _development: boolean = false;
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
	private _recepientsElms: HTMLInputElement[];
	private _messageElm: HTMLTextAreaElement;
	private _recepients: HTMLDivElement;
	private _audioElm: HTMLAudioElement;
	private _typingUsersCont: HTMLDivElement;
	private _typingUsers: HTMLSpanElement;
	
	public constructor () {
		this.static = new.target;
		this._initElements();
		this._initEvents();
		if (this._development) {
			this._initAutoLoginDevelopment();
		} else {
			this._initAutoLogin();
		}
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
		this._initElementRecepients();
		this._messageElm = this._messageForm.message as HTMLTextAreaElement;
		this._recepients = $<HTMLDivElement>("recepients");
		this._audioElm = $<HTMLAudioElement>("msg-sound");
		this._typingUsersCont = $<HTMLDivElement>("typing-users-cont");
		this._typingUsers = $<HTMLSpanElement>("typing-users");
	}
	private _initElementRecepients (): void {
		var rcp = this._messageForm.rcp;
		this._recepientsElms = rcp instanceof HTMLInputElement
			? [rcp]
			: rcp ;
	}
	private _initEvents (): void {
		this._loginForm.addEventListener('submit', this._handleClientLoginFormSubmit.bind(this));
		this._logoutBtn.addEventListener('click', (e: MouseEvent) => {
			this._socket.Send('logout', <WsMsgClientLoginLogout>{
				id: this._id,
				user: this._user
			});
			this._socket.Close();
			location.reload();
		});
		this._messageForm.addEventListener('submit', this._handleClientMessageFormSubmit.bind(this));
		this._messageElm.addEventListener('keydown', (e: KeyboardEvent) => {
			// enter + ctrl
			if (e.keyCode == 13 && e.ctrlKey)
				this._handleClientMessageFormSubmit(e);
		});
		this._messageElm.addEventListener('keyup', (e: KeyboardEvent) => {
			// enter + ctrl
			if (!(e.keyCode == 13 && e.ctrlKey)) {
				this._handleClientMessageFormTyping(
					String(this._messageElm.value).trim().length > 0, e
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
	private _initAutoLogin (): void {
		Ajax.load(<Ajax.LoadConfig>{
			url: this._getLoginUrl(),
			method: 'POST',
			success: (data: AjaxMsgServerLogin, statusCode, xhr) => {
				if (data.success) 
					this._initChatRoom(String(data.user), Number(data.id));
			},
			type: 'json'
		});
	}
	private _initAutoLoginDevelopment (): void {
		var chrome = navigator.userAgent.indexOf('Chrome') > -1, 
			firefox = navigator.userAgent.indexOf('Firefox') > -1;
		this._loginUserElm.value = chrome
			? 'james.bond'
			: (firefox
				? 'money.penny'
				: 'mr.smith');
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

	private _handleClientLoginFormSubmit (e: Event): void {
		var user = this._loginUserElm.value, 
			pass = this._loginPassElm.value;
		if (user != '' && pass != '') {
			Ajax.load(<Ajax.LoadConfig>{
				url: this._getLoginUrl(),
				method: 'POST',
				data: <AjaxMsgClientLogin>{
					user: user,
					pass: pass
				},
				success: (data: AjaxMsgServerLogin, statusCode, xhr) => {
					if (data.success) {
						this._initChatRoom(user, Number(data.id));
					} else {
						alert(data.message);
					}
				},
				type: 'json',
				error: (responseText, statusCode, xhr) => {
					alert(responseText);
				}
			});
		}
		e.preventDefault();
	}
	
	private _initChatRoom (user: string, id: number): void {
		this._id = id;
		this._user = user;
		this._initChatRoomElements();
		this._initChatRoomEvents();
	}
	private _initChatRoomElements (): void {
		this._loginUserElm.value = '';
		this._loginPassElm.value = '';
		this._loginForm.style.display = 'none';
		this._chatRoom.style.display = 'block';
		this._currentUser.innerHTML = this._user;
		this._scrollToBottom();
	}
	private _initChatRoomEvents (): void {
		// connect to server:
		this._socket = WebSocketWrapper.GetInstance(this.static.WEB_SOCKETS_ADDRESS
			.replace('%websocket.protocol%', location.protocol === 'https:' ? 'wss:' : 'ws:')
			.replace('%location.host%', location.host)
			.replace('%location.pathname%', location.pathname));
		// tell the server to login this user:
		this._socket.Send('login', <WsMsgClientLoginLogout>{
			id: this._id,
			user: this._user
		});
		// init web socket server events:
		this._socket.Bind('connection', (data: WsMsgServerConnection): void => {
			console.log(data.message);
		});
		this._socket.Bind('login', this._handleServerUserLogin.bind(this));
		this._socket.Bind('logout', this._handleServerUserLogout.bind(this));
		this._socket.Bind('message', (data: WsMsgServerMessage, live: boolean = true): void => {
			this._addMessage(
				'content ' + (data.id == this._id ? 'current' : 'other'), 
				data.content, 
				data.user,
				data.recepient
			);
			if (live) this._audioElm.play();
		});
		this._socket.Bind('typing', this._handleServerUserTyping.bind(this));
	}

	private _handleClientMessageFormSubmit (e: Event | KeyboardEvent): void {
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
	private _handleClientMessageFormTyping(typing: boolean, e: KeyboardEvent): void {
		this._socket.Send('typing', <WsMsgClientTyping>{
			id: this._id,
			user: this._user,
			recepient: this._getRecepient(),
			typing: typing
		});
	}
	private _handleServerUserLogin (data: WsMsgServerLoginLogout, live: boolean = true): void {
		if (live) this._updateOnlineUsers(data);
		if (!live) this._addMessage('notify', data.user + ' has joined chat');
		if (live) this._updateRecepients(data.onlineUsers);
	}
	private _handleServerUserLogout(data: WsMsgServerLoginLogout, live: boolean = true): void {
		if (live) this._updateOnlineUsers(data);
		this._addMessage('notify', data.user + ' has leaved chat');
		if (live) this._updateRecepients(data.onlineUsers);
	}
	private _handleServerUserTyping (data: WsMsgServerTyping): void {
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

	private _updateOnlineUsers (data: WsMsgServerLoginLogout): void {
		var onlineUsers = data.onlineUsers, 
			html: string = '', 
			separator: string = '';
		for (var userIdStr in onlineUsers) {
			html += separator + onlineUsers[userIdStr];
			separator = ', ';
		}
		this._onlineUsers.innerHTML = 'Currently online ('
			+ data.onlineUsersCount + ')： ' + html;
	}
	private _updateRecepients (onlineUsers: WsMsgServerOnlineUsers): void {
		var html: string = '',
			idInt: number,
			userName: string;
		for (var idStr in onlineUsers) {
			idInt = parseInt(idStr, 10);
			if (idInt === this._id) continue;
			userName = onlineUsers[idStr];
			html += '<div>'
				+ '<input id="rcp-' + idStr + '" type="radio" name="rcp" value="' + userName + '" />'
				+ '<label for="rcp-' + idStr + '">' + userName + '</label>'
				+ '</div>';
		}
		this._recepients.innerHTML = html;
		this._initElementRecepients();
	}
	private _addMessage(msgClass: string, msgContent: string, msgAutor: string | null = null, msgRecepient: string | null = null): void {
		var msg: HTMLDivElement = document.createElement('div');
		msg.className = 'message ' + msgClass;
		msg.innerHTML = '<div>' + msgContent + '</div>';
		if (msgAutor) {
			if (msgRecepient != null && msgRecepient != '') {
				msg.innerHTML += '<span>' + msgAutor + ' to ' + msgRecepient + '</span>';
			} else {
				msg.innerHTML += '<span>' + msgAutor + ' to all</span>';
			}
		}
		this._messages.appendChild(msg);
		this._scrollToBottom();
	}
	
	private _getRecepient(): string {
		var recepient: string = '';
		for (var recepientRadio of this._recepientsElms) {
			if (recepientRadio.checked) {
				recepient = recepientRadio.value;
				break;
			}
		}
		return recepient;
	}
	private _getLoginUrl (): string {
		return this.static.AJAX_LOGIN_ADDRESS
			.replace('%location.protocol%', location.protocol)
			.replace('%location.host%', location.host)
			.replace('%location.pathname%', location.pathname);
	}
	private _scrollToBottom (): void {
		this._messages.scrollTop = this._messages.scrollHeight;
	}
}

///@ts-ignore
window.chat = new Chat();