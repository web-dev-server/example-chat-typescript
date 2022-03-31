"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {};
try {
    Object.defineProperty(String.prototype, 'trim', {
        enumerable: false,
        writable: false,
        configurable: false,
        value: function (charlist) {
            var whitespace = '', l = 0, i = 0;
            var str = String(this);
            if (!charlist) {
                // default list
                whitespace = " \n\r\t\f\x0b\xa0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u2028\u2029\u3000";
            }
            else {
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
    });
}
catch (e) { }
if (!Object.typeOf) {
    Object.typeOf = function (o) {
        var r = Object.prototype.toString.apply(o); // "[object Something]"
        return r.substring(8, r.length - 1); // Something
    };
}
if (!Object.prototype.toMap) {
    (function () {
        var toMap = function (map, obj, keys) {
            for (var key = '', i = 0, l = keys.length; i < l; i += 1) {
                key = keys[i];
                map.set(key, obj[key]);
            }
            return map;
        };
        var toMapKey = function (map, obj, keys, handleKey) {
            for (var key = '', val = null, i = 0, l = keys.length; i < l; i += 1) {
                key = keys[i];
                val = obj[key];
                map.set(handleKey(key, val), val);
            }
            return map;
        };
        var toMapValue = function (map, obj, keys, handleValue) {
            for (var key = '', i = 0, l = keys.length; i < l; i += 1) {
                key = keys[i];
                map.set(key, handleValue(obj[key]));
            }
            return map;
        };
        var toMapKeyValue = function (map, obj, keys, handleKey, handleValue) {
            for (var key = '', val = null, i = 0, l = keys.length; i < l; i += 1) {
                key = keys[i];
                val = obj[key];
                map.set(handleKey(key, val), handleValue(val));
            }
            return map;
        };
        Object.defineProperty(Object.prototype, 'toMap', {
            enumerable: false,
            writable: false,
            configurable: false,
            value: function (handleKey, handleValue) {
                var result = new Map(), keys = Object.keys(this), convertKeys = handleKey != null, convertValues = handleValue != null;
                if (convertKeys && convertValues) {
                    return toMapKeyValue(result, this, keys, handleKey, handleValue);
                }
                else if (convertKeys) {
                    return toMapKey(result, this, keys, handleKey);
                }
                else if (convertValues) {
                    return toMapValue(result, this, keys, handleValue);
                }
                else {
                    return toMap(result, this, keys);
                }
            }
        });
    })();
}
if (!Map.prototype.value)
    Object.defineProperty(Map.prototype, 'value', {
        enumerable: false,
        writable: false,
        configurable: false,
        value: function (key) {
            if (!this.has(key))
                throw new Error(`Map has no record for key: '${key.toString()}'.`);
            return this.get(key);
        }
    });
if (!Map.prototype.toObject)
    Object.defineProperty(Map.prototype, 'toObject', {
        enumerable: false,
        writable: false,
        configurable: false,
        value: function () {
            var result = Object.create(null);
            this.forEach(function (val, key) {
                result[String(key)] = val;
            });
            return result;
        }
    });
if (!Number.isNaN)
    Number.isNaN = window.isNaN;
if (!Number.isInteger)
    Number.isInteger = Number.isInteger || function (value) {
        return (typeof value === 'number' &&
            isFinite(value) &&
            Math.floor(value) === value);
    };
//# sourceMappingURL=prototype-extending.js.map