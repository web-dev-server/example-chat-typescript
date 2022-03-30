export {};

declare global {
	interface String {
		toHexStr (): string;
		trim (charlist?: string): string;
	}
	interface ObjectConstructor {
		typeOf(o: any): string;
	}
	interface Object {
		toMap<K, V>(handleKey?: (rawKey?: string, rawValue?: any) => K, handleValue?: (rawValue?: any) => V): Map<K, V>;
	}
	interface Array<T> {
		intersect(...arrays: Array<T>[]): Array<T>;
	}
	interface Map<K, V> {
		/** @throws Error if key doesn't exists. */
		value (key: K): V;
		toObject (): object;
	}
	/*interface HTMLElement {
		addClass (cssClass: string): HTMLElement;
	}
	interface HTMLElement {
		removeClass (cssClassOrRegExpPatternValue: string): HTMLElement;
	}
	interface HTMLElement {
		hasClass (cssClass: string): boolean;
	}
	interface HTMLElement {
		setAttributes (attrs: object): HTMLElement;
	}
	interface HTMLElement {
		setStyles (styles: CSSStyleDeclaration | object): HTMLElement;
	}*/
}