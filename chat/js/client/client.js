class Chat {
    constructor() {
        this._development = true;
        this.Static = new.target;
        this._initElements();
        this._initEvents();
        if (this._development)
            this._developmentAutoLogin();
    }
    _initElements() {
        var $ = (id) => { return document.getElementById(id); };
        this._loginForm = $("login-form");
        this._loginUserElm = this._loginForm.user;
        this._loginPassElm = this._loginForm.pass;
        this._logoutBtn = $("logout-btn");
        this._chatRoom = $("chat-room");
        this._currentUser = $("current-user");
        this._onlineUsers = $("online-users");
        this._messages = $("messages");
        this._messageForm = $("message-form");
        this._recepientsElms = this._messageForm.rcp;
        this._messageElm = this._messageForm.message;
        this._recepients = $("recepients");
        this._audioElm = $("msg-sound");
        this._typingUsersCont = $("typing-users-cont");
        this._typingUsers = $("typing-users");
    }
    _initEvents() {
        this._loginForm.addEventListener('submit', this._loginSubmitHandler.bind(this));
        this._logoutBtn.addEventListener('click', (e) => {
            this._socket.Close();
            location.reload();
        });
        this._messageForm.addEventListener('submit', this._messageFormSubmitHandler.bind(this));
        this._messageElm.addEventListener('keydown', (e) => {
            // enter + ctrl
            if (e.keyCode == 13 && e.ctrlKey)
                this._messageFormSubmitHandler(e);
        });
        this._messageElm.addEventListener('keyup', (e) => {
            // enter + ctrl
            if (!(e.keyCode == 13 && e.ctrlKey)) {
                this._messageFormTypingHandler(String(this._messageElm.value).trim().length > 0, e);
            }
        });
        window.addEventListener('unload', (e) => {
            if (this._socket)
                this._socket.Close();
        });
        if (this._development)
            return;
        window.addEventListener('beforeunload', (e) => {
            return e.returnValue = "Do you realy want to leave chat?";
        });
    }
    _developmentAutoLogin() {
        var chrome = navigator.userAgent.indexOf('Chrome') > -1, firefox = navigator.userAgent.indexOf('Firefox') > -1;
        this._loginUserElm.value = chrome
            ? 'james.bond'
            : (firefox
                ? 'money.penny'
                : 'mr.smith');
        this._loginPassElm.value = '1234';
        if (document.createEvent) {
            var eventObject = document.createEvent('Event');
            eventObject.initEvent('submit', true, true);
            this._loginForm.dispatchEvent(eventObject);
        }
        else {
            this._loginForm.dispatchEvent(new Event('submit', {
                bubbles: true,
                cancelable: true
            }));
        }
    }
    _loginSubmitHandler(e) {
        var user = this._loginUserElm.value, pass = this._loginPassElm.value;
        if (user != '' && pass != '') {
            var pathName = location.pathname, lastSlashPos = pathName.lastIndexOf('/');
            if (lastSlashPos > -1)
                pathName = pathName.substring(0, lastSlashPos + 1);
            Ajax.load({
                url: location.origin + pathName + 'js/server/app/?login-submit',
                method: 'POST',
                data: {
                    user: user,
                    pass: pass
                },
                success: (data, statusCode, xhr) => {
                    if (data.success) {
                        this._initChatRoom(user, Number(data.id));
                    }
                    else {
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
    _initChatRoom(user, id) {
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
    _initChatWebSocketComunication() {
        // connect to server:
        this._socket = WebSocketWrapper.GetInstance(this.Static.ADDRESS
            .replace('%websocket.protocol%', location.protocol === 'https:' ? 'wss:' : 'ws:')
            .replace('%location.host%', location.host)
            .replace('%location.pathname%', location.pathname));
        // tell the server to login this user:
        this._socket.Send('login', {
            id: this._id,
            user: this._user
        });
        // init web socket server events:
        this._socket.Bind('connection', (data) => {
            console.log(data.message);
        });
        this._socket.Bind('login', this._anyUserLogInHandler.bind(this));
        this._socket.Bind('logout', this._anyUserLogOutHandler.bind(this));
        this._socket.Bind('message', (data, live = true) => {
            this._addMessage('content ' + (data.id == this._id ? 'current' : 'other'), data.content, data.user, data.recepient);
            if (live)
                this._audioElm.play();
        });
        this._socket.Bind('typing', this._typingUsersHandler.bind(this));
    }
    _messageFormSubmitHandler(e) {
        var messageText = String(this._messageElm.value).trim();
        if (messageText != '') {
            this._socket.Send('message', {
                id: this._id,
                user: this._user,
                recepient: this._getRecepient(),
                content: messageText
            });
            this._messageElm.value = '';
        }
        e.preventDefault();
    }
    _messageFormTypingHandler(typing, e) {
        this._socket.Send('typing', {
            id: this._id,
            user: this._user,
            recepient: this._getRecepient(),
            typing: typing
        });
    }
    _getRecepient() {
        var recepientRadio, recepient = '';
        for (var i = 0, l = this._recepientsElms.length; i < l; i += 1) {
            recepientRadio = this._recepientsElms[i];
            if (recepientRadio.checked) {
                recepient = recepientRadio.value;
                break;
            }
        }
        return recepient;
    }
    _anyUserLogInHandler(data, live = true) {
        if (live)
            this._updateOnlineUsersHandler(data);
        this._addMessage('notify', data.user + ' has joined chat');
        if (live)
            this._updateRecepients(data.onlineUsers);
    }
    _anyUserLogOutHandler(data, live = true) {
        if (live)
            this._updateOnlineUsersHandler(data);
        this._addMessage('notify', data.user + ' has leaved chat');
        if (live)
            this._updateRecepients(data.onlineUsers);
    }
    _addMessage(msgClass, msgContent, msgAutor = null, msgRecepient = null) {
        var msg = document.createElement('div');
        msg.className = 'message ' + msgClass;
        msg.innerHTML = '<div>' + msgContent + '</div>';
        if (msgAutor) {
            if (msgRecepient != null && msgRecepient != '') {
                msg.innerHTML += '<span>' + msgAutor + ' to ' + msgRecepient + '</span>';
            }
            else {
                msg.innerHTML += '<span>' + msgAutor + ' to all</span>';
            }
        }
        this._messages.appendChild(msg);
        this._scrollToBottom();
    }
    _updateOnlineUsersHandler(data) {
        var onlineUsers = data.onlineUsers, userIdInt, html = '', separator = '';
        for (var userIdStr in onlineUsers) {
            html += separator + onlineUsers[userIdStr];
            separator = ', ';
        }
        this._onlineUsers.innerHTML = 'Currently online ('
            + data.onlineUsersCount + ')： ' + html;
    }
    _typingUsersHandler(data) {
        var typingUsers = [];
        for (var userName in data)
            if (userName !== this._user && data[userName])
                typingUsers.push(userName);
        if (typingUsers.length === 0) {
            this._typingUsersCont.style.display = 'none';
        }
        else {
            this._typingUsers.innerHTML = typingUsers.join(', ');
            this._typingUsersCont.style.display = 'block';
        }
    }
    _updateRecepients(onlineUsers) {
        var html = '', idInt, userName;
        for (var idStr in onlineUsers) {
            idInt = parseInt(idStr, 10);
            if (idInt === this._id)
                continue;
            userName = onlineUsers[idStr];
            html += '<div>'
                + '<input id="rcp-' + idStr + '" type="radio" name="rcp" value="' + userName + '" />'
                + '<label for="rcp-' + idStr + '">' + userName + '</label>'
                + '</div>';
        }
        this._recepients.innerHTML = html;
    }
    _scrollToBottom() {
        this._messages.scrollTop = this._messages.scrollHeight;
    }
}
Chat.ADDRESS = '%websocket.protocol%//%location.host%%location.pathname%js/build/server/app/';
///@ts-ignore
window.chat = new Chat();
