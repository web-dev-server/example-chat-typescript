declare const _default: {};
export default _default;
declare global {
    interface String {
        trim(charlist?: string): string;
    }
    interface ObjectConstructor {
        typeOf(o: any): string;
    }
    interface Object {
        toMap<K, V>(handleKey?: (rawKey?: string, rawValue?: any) => K, handleValue?: (rawValue?: any) => V): Map<K, V>;
    }
    interface Map<K, V> {
        /** @throws Error if key doesn't exists. */
        value(key: K): V;
        toObject(): object;
    }
    interface Number {
        isNaN(): boolean;
        isInteger(): boolean;
    }
}
//# sourceMappingURL=prototype-extending.d.ts.map