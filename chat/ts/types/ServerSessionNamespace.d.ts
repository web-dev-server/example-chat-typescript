import WebDevServer from "web-dev-server";

export default interface ServerSessionNamespace extends WebDevServer.Session.INamespace {
	authenticated: boolean;
	id: number;
	user: string;
}