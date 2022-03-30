export default {
};

declare global {
	interface String {
		trim (charlist?: string): string;
	}
	interface ObjectConstructor {
		typeOf(o: any): string;
	}
	interface Object {
		toMap<K, V>(handleKey?: (rawKey?: string, rawValue?: any) => K, handleValue?: (rawValue?: any) => V): Map<K, V>;
	}
	interface Map<K, V> {
		/** @throws Error if key doesn't exists. */
		value (key: K): V;
		toObject (): object;
	}
	interface Number {
		isNaN (): boolean;
		isInteger (): boolean;
	}
}

try {
	Object.defineProperty(
		String.prototype, 'trim', {
			enumerable: false,
			writable: false,
			configurable: false,
			value: function (charlist: string) {
				var whitespace = '',
					l = 0,
					i = 0;
				var str = String(this);
				if (!charlist) {
					// default list
					whitespace = " \n\r\t\f\x0b\xa0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u2028\u2029\u3000";
				} else {
					// preg_quote custom list
					charlist += '';
					whitespace = charlist.replace(/([\[\]\(\)\.\?\/\*\{\}\+\$\^\:])/g, '$1');
				}
				l = str.length;
				for (i = 0; i < l; i++) {
					if (whitespace.indexOf(str.charAt(i)) === -1) {
						str = str.substring(i);
						break;
					}
				}
				l = str.length;
				for (i = l - 1; i >= 0; i--) {
					if (whitespace.indexOf(str.charAt(i)) === -1) {
						str = str.substring(0, i + 1);
						break;
					}
				}
				return whitespace.indexOf(str.charAt(0)) === -1 ? str : '';
			}
		}
	);
} catch (e) { }
if (!Object.typeOf) {
	Object.typeOf = function (o: any) {
		var r = Object.prototype.toString.apply(o); // "[object Something]"
		return r.substring(8, r.length - 1); // Something
	}
}
if (!Object.prototype.toMap) {
	(function () {
		var toMap = function <K, V>(map: Map<K, V>, obj: any, keys: string[]): Map<K, V> {
			for (var key = '', i = 0, l = keys.length; i < l; i += 1) {
				key = keys[i];
				map.set(key as any, obj[key]);
			}
			return map;
		};
		var toMapKey = function <K, V>(map: Map<K, V>, obj: any, keys: string[], handleKey: (key: string, value: V) => K): Map<K, V> {
			for (var key = '', val = null, i = 0, l = keys.length; i < l; i += 1) {
				key = keys[i];
				val = obj[key];
				map.set(handleKey(key, val), val);
			}
			return map;
		};
		var toMapValue = function <K, V>(map: Map<K, V>, obj: any, keys: string[], handleValue: (val: V) => V): Map<K, V> {
			for (var key = '', i = 0, l = keys.length; i < l; i += 1) {
				key = keys[i];
				map.set(key as any, handleValue(obj[key]));
			}
			return map;
		};
		var toMapKeyValue = function <K, V>(map: Map<K, V>, obj: any, keys: string[], handleKey: (key: string, value: V) => K, handleValue: (val: V) => V): Map<K, V> {
			for (var key = '', val = null, i = 0, l = keys.length; i < l; i += 1) {
				key = keys[i];
				val = obj[key];
				map.set(handleKey(key, val), handleValue(val));
			}
			return map;
		};
		Object.defineProperty(
			Object.prototype, 'toMap', {
				enumerable: false,
				writable: false,
				configurable: false,
				value: function<K, V>(handleKey: (key: string, value: V) => K, handleValue: (val: V) => V): Map<K, V> {
					var result = new Map(),
						keys = Object.keys(this),
						convertKeys = handleKey != null,
						convertValues = handleValue != null;
					if (convertKeys && convertValues) {
						return toMapKeyValue<K, V>(result, this, keys, handleKey, handleValue);
					} else if (convertKeys) {
						return toMapKey<K, V>(result, this, keys, handleKey);
					} else if (convertValues) {
						return toMapValue<K, V>(result, this, keys, handleValue);
					} else {
						return toMap<K, V>(result, this, keys);
					}
				}
			}
		);
	})();
}
if (!Map.prototype.value) 
	Object.defineProperty(
		Map.prototype, 'value', {
			enumerable: false,
			writable: false,
			configurable: false,
			value: function (key: any) {
				if (!this.has(key)) 
					throw new Error(`Map has no record for key: '${key.toString()}'.`)
				return this.get(key);
			}
		}
	);
if (!Map.prototype.toObject) 
	Object.defineProperty(
		Map.prototype, 'toObject', {
			enumerable: false,
			writable: false,
			configurable: false,
			value: function () {
				var result = Object.create(null);
				this.forEach(function (val: any, key: any) {
					result[String(key)] = val;
				});
				return result;
			}
		}
	);
if (!Number.isNaN)
	Number.isNaN = window.isNaN;
if (!Number.isInteger)
	Number.isInteger = Number.isInteger || function (value) {
		return (
			typeof value === 'number' && 
			isFinite(value) && 
			Math.floor(value) === value
		);
	};