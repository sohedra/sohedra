/*!
 * @ungap/structured-clone 1.4.0 (ISC)
 *
 * ISC License
 *
 * Copyright (c) 2021, Andrea Giammarchi, @WebReflection
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
 * OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */



const { defineProperty } = Object;
const env = typeof self === 'object' ? self : globalThis;
const guard = (name, init)=>{
    switch(name){
        case 'Function':
        case 'SharedWorker':
        case 'Worker':
        case 'eval':
        case 'setInterval':
        case 'setTimeout':
            throw new TypeError('unable to deserialize ' + name);
    }
    return new env[name](init);
};
const deserializer = ($, _)=>{
    const as = (out, index)=>{
        $.set(index, out);
        return out;
    };
    const unpair = (index)=>{
        if ($.has(index)) return $.get(index);
        const [type, value] = _[index];
        switch(type){
            case (/* inlined export .PRIMITIVE */0):
            case (/* inlined export .VOID */-1):
                return as(value, index);
            case (/* inlined export .ARRAY */1):
                {
                    const arr = as([], index);
                    for (const index of value)arr.push(unpair(index));
                    return arr;
                }
            case (/* inlined export .OBJECT */2):
                {
                    const object = as({}, index);
                    for (const [key, index] of value){
                        const k = unpair(key), value = unpair(index);
                        if (k === '__proto__') defineProperty(object, k, {
                            value,
                            configurable: true,
                            enumerable: true,
                            writable: true
                        });
                        else object[k] = value;
                    }
                    return object;
                }
            case (/* inlined export .DATE */3):
                return as(new Date(value), index);
            case (/* inlined export .REGEXP */4):
                {
                    const { source, flags } = value;
                    return as(new RegExp(source, flags), index);
                }
            case (/* inlined export .MAP */5):
                {
                    const map = as(new Map, index);
                    for (const [key, index] of value)map.set(unpair(key), unpair(index));
                    return map;
                }
            case (/* inlined export .SET */6):
                {
                    const set = as(new Set, index);
                    for (const index of value)set.add(unpair(index));
                    return set;
                }
            case (/* inlined export .ERROR */7):
                {
                    const { name, message } = value;
                    return as(typeof env[name] === 'function' ? guard(name, message) : new Error(message), index);
                }
            case (/* inlined export .BIGINT */8):
                return as(BigInt(value), index);
            case 'BigInt':
                return as(Object(BigInt(value)), index);
            case 'ArrayBuffer':
                return as(new Uint8Array(value).buffer, value);
            case 'DataView':
                {
                    const { buffer } = new Uint8Array(value);
                    return as(new DataView(buffer), value);
                }
            case '-0':
                return -0;
        }
        return as(guard(type, value), index);
    };
    return unpair;
};
/**
 * @typedef {Array<string,any>} Record a type representation
 */ /**
 * Returns a deserialized value from a serialized array of Records.
 * @param {Record[]} serialized a previously serialized value.
 * @returns {any}
 */ const deserialize = (serialized)=>deserializer(new Map, serialized)(0);


const EMPTY = '';
const { toString: serialize_toString } = {};
const { keys, is } = Object;
const typeOf = (value)=>{
    const type = typeof value;
    if (type !== 'object' || !value) return [
        (/* inlined export .PRIMITIVE */0),
        type
    ];
    const asString = serialize_toString.call(value).slice(8, -1);
    switch(asString){
        case 'Array':
            return [
                (/* inlined export .ARRAY */1),
                EMPTY
            ];
        case 'Object':
            return [
                (/* inlined export .OBJECT */2),
                EMPTY
            ];
        case 'Date':
            return [
                (/* inlined export .DATE */3),
                EMPTY
            ];
        case 'RegExp':
            return [
                (/* inlined export .REGEXP */4),
                EMPTY
            ];
        case 'Map':
            return [
                (/* inlined export .MAP */5),
                EMPTY
            ];
        case 'Set':
            return [
                (/* inlined export .SET */6),
                EMPTY
            ];
        case 'DataView':
            return [
                (/* inlined export .ARRAY */1),
                asString
            ];
    }
    if (asString.includes('Array')) return [
        (/* inlined export .ARRAY */1),
        asString
    ];
    if (value instanceof Error) return [
        (/* inlined export .ERROR */7),
        value.name || 'Error'
    ];
    return [
        (/* inlined export .OBJECT */2),
        asString
    ];
};
const shouldSkip = ([TYPE, type])=>TYPE === (/* inlined export .PRIMITIVE */0) && (type === 'function' || type === 'symbol');
const serializer = (strict, json, $, _)=>{
    const as = (out, value)=>{
        const index = _.push(out) - 1;
        $.set(value, index);
        return index;
    };
    const pair = (value)=>{
        if ($.has(value)) return $.get(value);
        let [TYPE, type] = typeOf(value);
        switch(TYPE){
            case (/* inlined export .PRIMITIVE */0):
                {
                    let entry = value;
                    switch(type){
                        case 'bigint':
                            TYPE = (/* inlined export .BIGINT */8);
                            entry = value.toString();
                            break;
                        case 'number':
                            if (!value && is(value, -0)) return _.push([
                                '-0'
                            ]) - 1;
                            break;
                        case 'function':
                        case 'symbol':
                            if (strict) throw new TypeError('unable to serialize ' + type);
                            entry = null;
                            break;
                        case 'undefined':
                            return as([
                                (/* inlined export .VOID */-1)
                            ], value);
                    }
                    return as([
                        TYPE,
                        entry
                    ], value);
                }
            case (/* inlined export .ARRAY */1):
                {
                    if (type) {
                        let spread = value;
                        if (type === 'DataView') {
                            spread = new Uint8Array(value.buffer);
                        } else if (type === 'ArrayBuffer') {
                            spread = new Uint8Array(value);
                        }
                        return as([
                            type,
                            [
                                ...spread
                            ]
                        ], value);
                    }
                    const arr = [];
                    const index = as([
                        TYPE,
                        arr
                    ], value);
                    for (const entry of value)arr.push(pair(entry));
                    return index;
                }
            case (/* inlined export .OBJECT */2):
                {
                    if (type) {
                        switch(type){
                            case 'BigInt':
                                return as([
                                    type,
                                    value.toString()
                                ], value);
                            case 'Boolean':
                            case 'Number':
                            case 'String':
                                return as([
                                    type,
                                    value.valueOf()
                                ], value);
                        }
                    }
                    if (json && 'toJSON' in value) return pair(value.toJSON());
                    const entries = [];
                    const index = as([
                        TYPE,
                        entries
                    ], value);
                    for (const key of keys(value)){
                        if (strict || !shouldSkip(typeOf(value[key]))) entries.push([
                            pair(key),
                            pair(value[key])
                        ]);
                    }
                    return index;
                }
            case (/* inlined export .DATE */3):
                return as([
                    TYPE,
                    isNaN(value.getTime()) ? EMPTY : value.toISOString()
                ], value);
            case (/* inlined export .REGEXP */4):
                {
                    const { source, flags } = value;
                    return as([
                        TYPE,
                        {
                            source,
                            flags
                        }
                    ], value);
                }
            case (/* inlined export .MAP */5):
                {
                    const entries = [];
                    const index = as([
                        TYPE,
                        entries
                    ], value);
                    for (const [key, entry] of value){
                        if (strict || !(shouldSkip(typeOf(key)) || shouldSkip(typeOf(entry)))) entries.push([
                            pair(key),
                            pair(entry)
                        ]);
                    }
                    return index;
                }
            case (/* inlined export .SET */6):
                {
                    const entries = [];
                    const index = as([
                        TYPE,
                        entries
                    ], value);
                    for (const entry of value){
                        if (strict || !shouldSkip(typeOf(entry))) entries.push(pair(entry));
                    }
                    return index;
                }
        }
        const { message } = value;
        return as([
            TYPE,
            {
                name: type,
                message
            }
        ], value);
    };
    return pair;
};
/**
 * @typedef {Array<string,any>} Record a type representation
 */ /**
 * Returns an array of serialized Records.
 * @param {any} value a serializable value.
 * @param {{json?: boolean, lossy?: boolean}?} options an object with a `lossy` or `json` property that,
 *  if `true`, will not throw errors on incompatible types, and behave more
 *  like JSON stringify would behave. Symbol and Function will be discarded.
 * @returns {Record[]}
 */ const serialize = (value, { json, lossy } = {})=>{
    const _ = [];
    return serializer(!(json || lossy), !!json, new Map, _)(value), _;
};

// The copy the structuredClone fill makes with: @ungap/structured-clone's own, by name.


export { deserialize, serialize };
