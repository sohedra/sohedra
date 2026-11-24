/*!
 * core-js 3.51.0 (MIT)
 *
 * Copyright (c) 2013–2025 Denis Pushkarev (zloirock.ru)
 * Copyright (c) 2025–2026 CoreJS Company (core-js.io)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

var __webpack_modules__ = {};
// The module cache
var __webpack_module_cache__ = {};
// The require function
function __webpack_require__(moduleId) {
// Check if module is in cache
var cachedModule = __webpack_module_cache__[moduleId];
if (cachedModule !== undefined) {
return cachedModule.exports;
}
// Create a new module (and put it into the cache)
var module = (__webpack_module_cache__[moduleId] = {
exports: {}
});
// Execute the module function
__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);

// Return the exports of the module
return module.exports;
}
// expose the modules object (__webpack_modules__)
__webpack_require__.m = __webpack_modules__;

// webpack/runtime/esm_register_module
(() => {
__webpack_require__.add = function registerModules(modules) { Object.assign(__webpack_require__.m, modules) }

})();
// webpack/runtime/global
(() => {
__webpack_require__.g = (() => {
	if (typeof globalThis === 'object') return globalThis;
	try {
		return this || new Function('return this')();
	} catch (e) {
		if (typeof window === 'object') return window;
	}
})();
})();

__webpack_require__.add({
4904(module, __unused_rspack_exports, __webpack_require__) {

var isCallable = __webpack_require__(5867);
var tryToString = __webpack_require__(6169);
var $TypeError = TypeError;
// `Assert: IsCallable(argument) is true`
module.exports = function(argument) {
    if (isCallable(argument)) return argument;
    throw new $TypeError(tryToString(argument) + ' is not a function');
};


},
8332(module, __unused_rspack_exports, __webpack_require__) {

var classof = __webpack_require__(8017);
var $TypeError = TypeError;
module.exports = function(argument) {
    if (classof(argument) === 'DataView') return argument;
    throw new $TypeError('Argument is not a DataView');
};


},
9349(module, __unused_rspack_exports, __webpack_require__) {

var isObject = __webpack_require__(9400);
var $String = String;
var $TypeError = TypeError;
// `Assert: Type(argument) is Object`
module.exports = function(argument) {
    if (isObject(argument)) return argument;
    throw new $TypeError($String(argument) + ' is not an object');
};


},
7867(module, __unused_rspack_exports, __webpack_require__) {

var toIndexedObject = __webpack_require__(4991);
var toAbsoluteIndex = __webpack_require__(9296);
var lengthOfArrayLike = __webpack_require__(9408);
// `Array.prototype.{ indexOf, includes }` methods implementation
var createMethod = function(IS_INCLUDES) {
    return function($this, el, fromIndex) {
        var O = toIndexedObject($this);
        var length = lengthOfArrayLike(O);
        if (length === 0) return !IS_INCLUDES && -1;
        var index = toAbsoluteIndex(fromIndex, length);
        var value;
        // Array#includes uses SameValueZero equality algorithm
        // eslint-disable-next-line no-self-compare -- NaN check
        if (IS_INCLUDES && el !== el) while(length > index){
            value = O[index++];
            // eslint-disable-next-line no-self-compare -- NaN check
            if (value !== value) return true;
        // Array#indexOf ignores holes, Array#includes - not
        }
        else for(; length > index; index++){
            if ((IS_INCLUDES || index in O) && O[index] === el) return IS_INCLUDES || index || 0;
        }
        return !IS_INCLUDES && -1;
    };
};
module.exports = {
    // `Array.prototype.includes` method
    // https://tc39.es/ecma262/#sec-array.prototype.includes
    includes: createMethod(true),
    // `Array.prototype.indexOf` method
    // https://tc39.es/ecma262/#sec-array.prototype.indexof
    indexOf: createMethod(false)
};


},
7182(module, __unused_rspack_exports, __webpack_require__) {

var uncurryThis = __webpack_require__(5274);
var toString = uncurryThis({}.toString);
var stringSlice = uncurryThis(''.slice);
module.exports = function(it) {
    return stringSlice(toString(it), 8, -1);
};


},
8017(module, __unused_rspack_exports, __webpack_require__) {

var TO_STRING_TAG_SUPPORT = __webpack_require__(5090);
var isCallable = __webpack_require__(5867);
var classofRaw = __webpack_require__(7182);
var wellKnownSymbol = __webpack_require__(9825);
var TO_STRING_TAG = wellKnownSymbol('toStringTag');
var $Object = Object;
// ES3 wrong here
var CORRECT_ARGUMENTS = classofRaw(function() {
    return arguments;
}()) === 'Arguments';
// fallback for IE11 Script Access Denied error
var tryGet = function(it, key) {
    try {
        return it[key];
    } catch (error) {}
};
// getting tag from ES6+ `Object.prototype.toString`
module.exports = TO_STRING_TAG_SUPPORT ? classofRaw : function(it) {
    var O, tag, result;
    return it === undefined ? 'Undefined' : it === null ? 'Null' : typeof (tag = tryGet(O = $Object(it), TO_STRING_TAG)) == 'string' ? tag : CORRECT_ARGUMENTS ? classofRaw(O) : (result = classofRaw(O)) === 'Object' && isCallable(O.callee) ? 'Arguments' : result;
};


},
3238(module, __unused_rspack_exports, __webpack_require__) {

var hasOwn = __webpack_require__(2203);
var ownKeys = __webpack_require__(7449);
var getOwnPropertyDescriptorModule = __webpack_require__(1617);
var definePropertyModule = __webpack_require__(2123);
module.exports = function(target, source, exceptions) {
    var keys = ownKeys(source);
    var defineProperty = definePropertyModule.f;
    var getOwnPropertyDescriptor = getOwnPropertyDescriptorModule.f;
    for(var i = 0; i < keys.length; i++){
        var key = keys[i];
        if (!hasOwn(target, key) && !(exceptions && hasOwn(exceptions, key))) {
            defineProperty(target, key, getOwnPropertyDescriptor(source, key));
        }
    }
};


},
9005(module, __unused_rspack_exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(6302);
var definePropertyModule = __webpack_require__(2123);
var createPropertyDescriptor = __webpack_require__(1274);
module.exports = DESCRIPTORS ? function(object, key, value) {
    return definePropertyModule.f(object, key, createPropertyDescriptor(1, value));
} : function(object, key, value) {
    object[key] = value;
    return object;
};


},
1274(module) {

module.exports = function(bitmap, value) {
    return {
        enumerable: !(bitmap & 1),
        configurable: !(bitmap & 2),
        writable: !(bitmap & 4),
        value: value
    };
};


},
9962(module, __unused_rspack_exports, __webpack_require__) {

var isCallable = __webpack_require__(5867);
var definePropertyModule = __webpack_require__(2123);
var makeBuiltIn = __webpack_require__(1769);
var defineGlobalProperty = __webpack_require__(2671);
module.exports = function(O, key, value, options) {
    if (!options) options = {};
    var simple = options.enumerable;
    var name = options.name !== undefined ? options.name : key;
    if (isCallable(value)) makeBuiltIn(value, name, options);
    if (options.global) {
        if (simple) O[key] = value;
        else defineGlobalProperty(key, value);
    } else {
        try {
            if (!options.unsafe) delete O[key];
            else if (O[key]) simple = true;
        } catch (error) {}
        if (simple) O[key] = value;
        else definePropertyModule.f(O, key, {
            value: value,
            enumerable: false,
            configurable: !options.nonConfigurable,
            writable: !options.nonWritable
        });
    }
    return O;
};


},
2671(module, __unused_rspack_exports, __webpack_require__) {

var globalThis = __webpack_require__(8218);
// eslint-disable-next-line es/no-object-defineproperty -- safe
var defineProperty = Object.defineProperty;
module.exports = function(key, value) {
    try {
        defineProperty(globalThis, key, {
            value: value,
            configurable: true,
            writable: true
        });
    } catch (error) {
        globalThis[key] = value;
    }
    return value;
};


},
6302(module, __unused_rspack_exports, __webpack_require__) {

var fails = __webpack_require__(3385);
// Detect IE8's incomplete defineProperty implementation
module.exports = !fails(function() {
    // eslint-disable-next-line es/no-object-defineproperty -- required for testing
    return Object.defineProperty({}, 1, {
        get: function() {
            return 7;
        }
    })[1] !== 7;
});


},
5305(module, __unused_rspack_exports, __webpack_require__) {

var globalThis = __webpack_require__(8218);
var isObject = __webpack_require__(9400);
var document = globalThis.document;
// typeof document.createElement is 'object' in old IE
var EXISTS = isObject(document) && isObject(document.createElement);
module.exports = function(it) {
    return EXISTS ? document.createElement(it) : {};
};


},
4389(module) {

// IE8- don't enum bug keys
module.exports = [
    'constructor',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    'toString',
    'valueOf'
];


},
6533(module, __unused_rspack_exports, __webpack_require__) {

var globalThis = __webpack_require__(8218);
var navigator = globalThis.navigator;
var userAgent = navigator && navigator.userAgent;
module.exports = userAgent ? String(userAgent) : '';


},
9773(module, __unused_rspack_exports, __webpack_require__) {

var globalThis = __webpack_require__(8218);
var userAgent = __webpack_require__(6533);
var process = globalThis.process;
var Deno = globalThis.Deno;
var versions = process && process.versions || Deno && Deno.version;
var v8 = versions && versions.v8;
var match, version;
if (v8) {
    match = v8.split('.');
    // in old Chrome, versions of V8 isn't V8 = Chrome / 10
    // but their correct versions are not interesting for us
    version = match[0] > 0 && match[0] < 4 ? 1 : +(match[0] + match[1]);
}
// BrowserFS NodeJS `process` polyfill incorrectly set `.v8` to `0.0`
// so check `userAgent` even if `.v8` exists, but 0
if (!version && userAgent) {
    match = userAgent.match(/Edge\/(\d+)/);
    if (!match || match[1] >= 74) {
        match = userAgent.match(/Chrome\/(\d+)/);
        if (match) version = +match[1];
    }
}
module.exports = version;


},
1924(module, __unused_rspack_exports, __webpack_require__) {

var globalThis = __webpack_require__(8218);
var getOwnPropertyDescriptor = (__webpack_require__(1617)/* .f */.f);
var createNonEnumerableProperty = __webpack_require__(9005);
var defineBuiltIn = __webpack_require__(9962);
var defineGlobalProperty = __webpack_require__(2671);
var copyConstructorProperties = __webpack_require__(3238);
var isForced = __webpack_require__(5946);
/*
  options.target         - name of the target object
  options.global         - target is the global object
  options.stat           - export as static methods of target
  options.proto          - export as prototype methods of target
  options.real           - real prototype method for the `pure` version
  options.forced         - export even if the native feature is available
  options.bind           - bind methods to the target, required for the `pure` version
  options.wrap           - wrap constructors to preventing global pollution, required for the `pure` version
  options.unsafe         - use the simple assignment of property instead of delete + defineProperty
  options.sham           - add a flag to not completely full polyfills
  options.enumerable     - export as enumerable property
  options.dontCallGetSet - prevent calling a getter on target
  options.name           - the .name of the function if it does not match the key
*/ module.exports = function(options, source) {
    var TARGET = options.target;
    var GLOBAL = options.global;
    var STATIC = options.stat;
    var FORCED, target, key, targetProperty, sourceProperty, descriptor;
    if (GLOBAL) {
        target = globalThis;
    } else if (STATIC) {
        target = globalThis[TARGET] || defineGlobalProperty(TARGET, {});
    } else {
        target = globalThis[TARGET] && globalThis[TARGET].prototype;
    }
    if (target) for(key in source){
        sourceProperty = source[key];
        if (options.dontCallGetSet) {
            descriptor = getOwnPropertyDescriptor(target, key);
            targetProperty = descriptor && descriptor.value;
        } else targetProperty = target[key];
        FORCED = isForced(GLOBAL ? key : TARGET + (STATIC ? '.' : '#') + key, options.forced);
        // contained in target
        if (!FORCED && targetProperty !== undefined) {
            if (typeof sourceProperty == typeof targetProperty) continue;
            copyConstructorProperties(sourceProperty, targetProperty);
        }
        // add a flag to not completely full polyfills
        if (options.sham || targetProperty && targetProperty.sham) {
            createNonEnumerableProperty(sourceProperty, 'sham', true);
        }
        defineBuiltIn(target, key, sourceProperty, options);
    }
};


},
3385(module) {

module.exports = function(exec) {
    try {
        return !!exec();
    } catch (error) {
        return true;
    }
};


},
6050(module, __unused_rspack_exports, __webpack_require__) {

var fails = __webpack_require__(3385);
module.exports = !fails(function() {
    // eslint-disable-next-line es/no-function-prototype-bind -- safe
    var test = (function() {}).bind();
    // eslint-disable-next-line no-prototype-builtins -- safe
    return typeof test != 'function' || test.hasOwnProperty('prototype');
});


},
8351(module, __unused_rspack_exports, __webpack_require__) {

var NATIVE_BIND = __webpack_require__(6050);
var call = Function.prototype.call;
// eslint-disable-next-line es/no-function-prototype-bind -- safe
module.exports = NATIVE_BIND ? call.bind(call) : function() {
    return call.apply(call, arguments);
};


},
4192(module, __unused_rspack_exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(6302);
var hasOwn = __webpack_require__(2203);
var FunctionPrototype = Function.prototype;
// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var getDescriptor = DESCRIPTORS && Object.getOwnPropertyDescriptor;
var EXISTS = hasOwn(FunctionPrototype, 'name');
// additional protection from minified / mangled / dropped function names
var PROPER = EXISTS && (function something() {}).name === 'something';
var CONFIGURABLE = EXISTS && (!DESCRIPTORS || DESCRIPTORS && getDescriptor(FunctionPrototype, 'name').configurable);
module.exports = {
    EXISTS: EXISTS,
    PROPER: PROPER,
    CONFIGURABLE: CONFIGURABLE
};


},
5274(module, __unused_rspack_exports, __webpack_require__) {

var NATIVE_BIND = __webpack_require__(6050);
var FunctionPrototype = Function.prototype;
var call = FunctionPrototype.call;
// eslint-disable-next-line es/no-function-prototype-bind -- safe
var uncurryThisWithBind = NATIVE_BIND && FunctionPrototype.bind.bind(call, call);
module.exports = NATIVE_BIND ? uncurryThisWithBind : function(fn) {
    return function() {
        return call.apply(fn, arguments);
    };
};


},
4289(module, __unused_rspack_exports, __webpack_require__) {

var globalThis = __webpack_require__(8218);
var isCallable = __webpack_require__(5867);
var aFunction = function(argument) {
    return isCallable(argument) ? argument : undefined;
};
module.exports = function(namespace, method) {
    return arguments.length < 2 ? aFunction(globalThis[namespace]) : globalThis[namespace] && globalThis[namespace][method];
};


},
9620(module, __unused_rspack_exports, __webpack_require__) {

var aCallable = __webpack_require__(4904);
var isNullOrUndefined = __webpack_require__(4751);
// `GetMethod` abstract operation
// https://tc39.es/ecma262/#sec-getmethod
module.exports = function(V, P) {
    var func = V[P];
    return isNullOrUndefined(func) ? undefined : aCallable(func);
};


},
8218(module, __unused_rspack_exports, __webpack_require__) {

var check = function(it) {
    return it && it.Math === Math && it;
};
// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
module.exports = // eslint-disable-next-line es/no-global-this -- safe
check(typeof globalThis == 'object' && globalThis) || check(typeof window == 'object' && window) || // eslint-disable-next-line no-restricted-globals -- safe
check(typeof self == 'object' && self) || check(typeof __webpack_require__.g == 'object' && __webpack_require__.g) || check(typeof this == 'object' && this) || // eslint-disable-next-line no-new-func -- fallback
function() {
    return this;
}() || Function('return this')();


},
2203(module, __unused_rspack_exports, __webpack_require__) {

var uncurryThis = __webpack_require__(5274);
var toObject = __webpack_require__(683);
var hasOwnProperty = uncurryThis({}.hasOwnProperty);
// `HasOwnProperty` abstract operation
// https://tc39.es/ecma262/#sec-hasownproperty
// eslint-disable-next-line es/no-object-hasown -- safe
module.exports = Object.hasOwn || function hasOwn(it, key) {
    return hasOwnProperty(toObject(it), key);
};


},
4579(module) {

module.exports = {};


},
7367(module, __unused_rspack_exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(6302);
var fails = __webpack_require__(3385);
var createElement = __webpack_require__(5305);
// Thanks to IE8 for its funny defineProperty
module.exports = !DESCRIPTORS && !fails(function() {
    // eslint-disable-next-line es/no-object-defineproperty -- required for testing
    return Object.defineProperty(createElement('div'), 'a', {
        get: function() {
            return 7;
        }
    }).a !== 7;
});


},
6569(module, __unused_rspack_exports, __webpack_require__) {

var uncurryThis = __webpack_require__(5274);
var fails = __webpack_require__(3385);
var classof = __webpack_require__(7182);
var $Object = Object;
var split = uncurryThis(''.split);
// fallback for non-array-like ES3 and non-enumerable old V8 strings
module.exports = fails(function() {
    // throws an error in rhino, see https://github.com/mozilla/rhino/issues/346
    // eslint-disable-next-line no-prototype-builtins -- safe
    return !$Object('z').propertyIsEnumerable(0);
}) ? function(it) {
    return classof(it) === 'String' ? split(it, '') : $Object(it);
} : $Object;


},
5028(module, __unused_rspack_exports, __webpack_require__) {

var uncurryThis = __webpack_require__(5274);
var isCallable = __webpack_require__(5867);
var store = __webpack_require__(6359);
var functionToString = uncurryThis(Function.toString);
// this helper broken in `core-js@3.4.1-3.4.4`, so we can't use `shared` helper
if (!isCallable(store.inspectSource)) {
    store.inspectSource = function(it) {
        return functionToString(it);
    };
}
module.exports = store.inspectSource;


},
4883(module, __unused_rspack_exports, __webpack_require__) {

var NATIVE_WEAK_MAP = __webpack_require__(6740);
var globalThis = __webpack_require__(8218);
var isObject = __webpack_require__(9400);
var createNonEnumerableProperty = __webpack_require__(9005);
var hasOwn = __webpack_require__(2203);
var shared = __webpack_require__(6359);
var sharedKey = __webpack_require__(3393);
var hiddenKeys = __webpack_require__(4579);
var OBJECT_ALREADY_INITIALIZED = 'Object already initialized';
var TypeError = globalThis.TypeError;
var WeakMap = globalThis.WeakMap;
var set, get, has;
var enforce = function(it) {
    return has(it) ? get(it) : set(it, {});
};
var getterFor = function(TYPE) {
    return function(it) {
        var state;
        if (!isObject(it) || (state = get(it)).type !== TYPE) {
            throw new TypeError('Incompatible receiver, ' + TYPE + ' required');
        }
        return state;
    };
};
if (NATIVE_WEAK_MAP || shared.state) {
    var store = shared.state || (shared.state = new WeakMap());
    /* eslint-disable no-self-assign -- prototype methods protection */ store.get = store.get;
    store.has = store.has;
    store.set = store.set;
    /* eslint-enable no-self-assign -- prototype methods protection */ set = function(it, metadata) {
        if (store.has(it)) throw new TypeError(OBJECT_ALREADY_INITIALIZED);
        metadata.facade = it;
        store.set(it, metadata);
        return metadata;
    };
    get = function(it) {
        return store.get(it) || {};
    };
    has = function(it) {
        return store.has(it);
    };
} else {
    var STATE = sharedKey('state');
    hiddenKeys[STATE] = true;
    set = function(it, metadata) {
        if (hasOwn(it, STATE)) throw new TypeError(OBJECT_ALREADY_INITIALIZED);
        metadata.facade = it;
        createNonEnumerableProperty(it, STATE, metadata);
        return metadata;
    };
    get = function(it) {
        return hasOwn(it, STATE) ? it[STATE] : {};
    };
    has = function(it) {
        return hasOwn(it, STATE);
    };
}
module.exports = {
    set: set,
    get: get,
    has: has,
    enforce: enforce,
    getterFor: getterFor
};


},
5867(module) {

// https://tc39.es/ecma262/#sec-IsHTMLDDA-internal-slot
var documentAll = typeof document == 'object' && document.all;
// `IsCallable` abstract operation
// https://tc39.es/ecma262/#sec-iscallable
// eslint-disable-next-line unicorn/no-typeof-undefined -- required for testing
module.exports = typeof documentAll == 'undefined' && documentAll !== undefined ? function(argument) {
    return typeof argument == 'function' || argument === documentAll;
} : function(argument) {
    return typeof argument == 'function';
};


},
5946(module, __unused_rspack_exports, __webpack_require__) {

var fails = __webpack_require__(3385);
var isCallable = __webpack_require__(5867);
var replacement = /#|\.prototype\./;
var isForced = function(feature, detection) {
    var value = data[normalize(feature)];
    return value === POLYFILL ? true : value === NATIVE ? false : isCallable(detection) ? fails(detection) : !!detection;
};
var normalize = isForced.normalize = function(string) {
    return String(string).replace(replacement, '.').toLowerCase();
};
var data = isForced.data = {};
var NATIVE = isForced.NATIVE = 'N';
var POLYFILL = isForced.POLYFILL = 'P';
module.exports = isForced;


},
4751(module) {

// we can't use just `it == null` since of `document.all` special case
// https://tc39.es/ecma262/#sec-IsHTMLDDA-internal-slot-aec
module.exports = function(it) {
    return it === null || it === undefined;
};


},
9400(module, __unused_rspack_exports, __webpack_require__) {

var isCallable = __webpack_require__(5867);
module.exports = function(it) {
    return typeof it == 'object' ? it !== null : isCallable(it);
};


},
3717(module) {

module.exports = false;


},
975(module, __unused_rspack_exports, __webpack_require__) {

var getBuiltIn = __webpack_require__(4289);
var isCallable = __webpack_require__(5867);
var isPrototypeOf = __webpack_require__(4447);
var USE_SYMBOL_AS_UID = __webpack_require__(2014);
var $Object = Object;
module.exports = USE_SYMBOL_AS_UID ? function(it) {
    return typeof it == 'symbol';
} : function(it) {
    var $Symbol = getBuiltIn('Symbol');
    return isCallable($Symbol) && isPrototypeOf($Symbol.prototype, $Object(it));
};


},
9408(module, __unused_rspack_exports, __webpack_require__) {

var toLength = __webpack_require__(4020);
// `LengthOfArrayLike` abstract operation
// https://tc39.es/ecma262/#sec-lengthofarraylike
module.exports = function(obj) {
    return toLength(obj.length);
};


},
1769(module, __unused_rspack_exports, __webpack_require__) {

var uncurryThis = __webpack_require__(5274);
var fails = __webpack_require__(3385);
var isCallable = __webpack_require__(5867);
var hasOwn = __webpack_require__(2203);
var DESCRIPTORS = __webpack_require__(6302);
var CONFIGURABLE_FUNCTION_NAME = (__webpack_require__(4192)/* .CONFIGURABLE */.CONFIGURABLE);
var inspectSource = __webpack_require__(5028);
var InternalStateModule = __webpack_require__(4883);
var enforceInternalState = InternalStateModule.enforce;
var getInternalState = InternalStateModule.get;
var $String = String;
// eslint-disable-next-line es/no-object-defineproperty -- safe
var defineProperty = Object.defineProperty;
var stringSlice = uncurryThis(''.slice);
var replace = uncurryThis(''.replace);
var join = uncurryThis([].join);
var CONFIGURABLE_LENGTH = DESCRIPTORS && !fails(function() {
    return defineProperty(function() {}, 'length', {
        value: 8
    }).length !== 8;
});
var TEMPLATE = String(String).split('String');
var makeBuiltIn = module.exports = function(value, name, options) {
    if (stringSlice($String(name), 0, 7) === 'Symbol(') {
        name = '[' + replace($String(name), /^Symbol\(([^)]*)\).*$/, '$1') + ']';
    }
    if (options && options.getter) name = 'get ' + name;
    if (options && options.setter) name = 'set ' + name;
    if (!hasOwn(value, 'name') || CONFIGURABLE_FUNCTION_NAME && value.name !== name) {
        if (DESCRIPTORS) defineProperty(value, 'name', {
            value: name,
            configurable: true
        });
        else value.name = name;
    }
    if (CONFIGURABLE_LENGTH && options && hasOwn(options, 'arity') && value.length !== options.arity) {
        defineProperty(value, 'length', {
            value: options.arity
        });
    }
    try {
        if (options && hasOwn(options, 'constructor') && options.constructor) {
            if (DESCRIPTORS) defineProperty(value, 'prototype', {
                writable: false
            });
        // in V8 ~ Chrome 53, prototypes of some methods, like `Array.prototype.values`, are non-writable
        } else if (value.prototype) value.prototype = undefined;
    } catch (error) {}
    var state = enforceInternalState(value);
    if (!hasOwn(state, 'source')) {
        state.source = join(TEMPLATE, typeof name == 'string' ? name : '');
    }
    return value;
};
// add fake Function#toString for correct work wrapped methods / constructors with methods like LoDash isNative
// eslint-disable-next-line no-extend-native -- required
Function.prototype.toString = makeBuiltIn(function toString() {
    return isCallable(this) && getInternalState(this).source || inspectSource(this);
}, 'toString');


},
4382(module, __unused_rspack_exports, __webpack_require__) {

var sign = __webpack_require__(2196);
var roundTiesToEven = __webpack_require__(256);
var abs = Math.abs;
var EPSILON = 2.220446049250313e-16; // Number.EPSILON
module.exports = function(x, FLOAT_EPSILON, FLOAT_MAX_VALUE, FLOAT_MIN_VALUE) {
    var n = +x;
    var absolute = abs(n);
    var s = sign(n);
    if (absolute < FLOAT_MIN_VALUE) return s * roundTiesToEven(absolute / FLOAT_MIN_VALUE / FLOAT_EPSILON) * FLOAT_MIN_VALUE * FLOAT_EPSILON;
    var a = (1 + FLOAT_EPSILON / EPSILON) * absolute;
    var result = a - (a - absolute);
    // eslint-disable-next-line no-self-compare -- NaN check
    if (result > FLOAT_MAX_VALUE || result !== result) return s * Infinity;
    return s * result;
};


},
329(module) {

var log = Math.log;
var LN2 = Math.LN2;
// `Math.log2` method
// https://tc39.es/ecma262/#sec-math.log2
// eslint-disable-next-line es/no-math-log2 -- safe
module.exports = Math.log2 || function log2(x) {
    return log(x) / LN2;
};


},
256(module) {

var EPSILON = 2.220446049250313e-16; // Number.EPSILON
var INVERSE_EPSILON = 1 / EPSILON;
module.exports = function(n) {
    return n + INVERSE_EPSILON - INVERSE_EPSILON;
};


},
2196(module) {

// `Math.sign` method implementation
// https://tc39.es/ecma262/#sec-math.sign
// eslint-disable-next-line es/no-math-sign -- safe
module.exports = Math.sign || function sign(x) {
    var n = +x;
    // eslint-disable-next-line no-self-compare -- NaN check
    return n === 0 || n !== n ? n : n < 0 ? -1 : 1;
};


},
2695(module) {

var ceil = Math.ceil;
var floor = Math.floor;
// `Math.trunc` method
// https://tc39.es/ecma262/#sec-math.trunc
// eslint-disable-next-line es/no-math-trunc -- safe
module.exports = Math.trunc || function trunc(x) {
    var n = +x;
    return (n > 0 ? floor : ceil)(n);
};


},
2123(__unused_rspack_module, exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(6302);
var IE8_DOM_DEFINE = __webpack_require__(7367);
var V8_PROTOTYPE_DEFINE_BUG = __webpack_require__(280);
var anObject = __webpack_require__(9349);
var toPropertyKey = __webpack_require__(183);
var $TypeError = TypeError;
// eslint-disable-next-line es/no-object-defineproperty -- safe
var $defineProperty = Object.defineProperty;
// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var $getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var ENUMERABLE = 'enumerable';
var CONFIGURABLE = 'configurable';
var WRITABLE = 'writable';
// `Object.defineProperty` method
// https://tc39.es/ecma262/#sec-object.defineproperty
exports.f = DESCRIPTORS ? V8_PROTOTYPE_DEFINE_BUG ? function defineProperty(O, P, Attributes) {
    anObject(O);
    P = toPropertyKey(P);
    anObject(Attributes);
    if (typeof O === 'function' && P === 'prototype' && 'value' in Attributes && WRITABLE in Attributes && !Attributes[WRITABLE]) {
        var current = $getOwnPropertyDescriptor(O, P);
        if (current && current[WRITABLE]) {
            O[P] = Attributes.value;
            Attributes = {
                configurable: CONFIGURABLE in Attributes ? Attributes[CONFIGURABLE] : current[CONFIGURABLE],
                enumerable: ENUMERABLE in Attributes ? Attributes[ENUMERABLE] : current[ENUMERABLE],
                writable: false
            };
        }
    }
    return $defineProperty(O, P, Attributes);
} : $defineProperty : function defineProperty(O, P, Attributes) {
    anObject(O);
    P = toPropertyKey(P);
    anObject(Attributes);
    if (IE8_DOM_DEFINE) try {
        return $defineProperty(O, P, Attributes);
    } catch (error) {}
    if ('get' in Attributes || 'set' in Attributes) throw new $TypeError('Accessors not supported');
    if ('value' in Attributes) O[P] = Attributes.value;
    return O;
};


},
1617(__unused_rspack_module, exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(6302);
var call = __webpack_require__(8351);
var propertyIsEnumerableModule = __webpack_require__(3291);
var createPropertyDescriptor = __webpack_require__(1274);
var toIndexedObject = __webpack_require__(4991);
var toPropertyKey = __webpack_require__(183);
var hasOwn = __webpack_require__(2203);
var IE8_DOM_DEFINE = __webpack_require__(7367);
// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var $getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
// `Object.getOwnPropertyDescriptor` method
// https://tc39.es/ecma262/#sec-object.getownpropertydescriptor
exports.f = DESCRIPTORS ? $getOwnPropertyDescriptor : function getOwnPropertyDescriptor(O, P) {
    O = toIndexedObject(O);
    P = toPropertyKey(P);
    if (IE8_DOM_DEFINE) try {
        return $getOwnPropertyDescriptor(O, P);
    } catch (error) {}
    if (hasOwn(O, P)) return createPropertyDescriptor(!call(propertyIsEnumerableModule.f, O, P), O[P]);
};


},
8518(__unused_rspack_module, exports, __webpack_require__) {

var internalObjectKeys = __webpack_require__(2582);
var enumBugKeys = __webpack_require__(4389);
var hiddenKeys = enumBugKeys.concat('length', 'prototype');
// `Object.getOwnPropertyNames` method
// https://tc39.es/ecma262/#sec-object.getownpropertynames
// eslint-disable-next-line es/no-object-getownpropertynames -- safe
exports.f = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
    return internalObjectKeys(O, hiddenKeys);
};


},
9019(__unused_rspack_module, exports) {

// eslint-disable-next-line es/no-object-getownpropertysymbols -- safe
exports.f = Object.getOwnPropertySymbols;


},
4447(module, __unused_rspack_exports, __webpack_require__) {

var uncurryThis = __webpack_require__(5274);
module.exports = uncurryThis({}.isPrototypeOf);


},
2582(module, __unused_rspack_exports, __webpack_require__) {

var uncurryThis = __webpack_require__(5274);
var hasOwn = __webpack_require__(2203);
var toIndexedObject = __webpack_require__(4991);
var indexOf = (__webpack_require__(7867)/* .indexOf */.indexOf);
var hiddenKeys = __webpack_require__(4579);
var push = uncurryThis([].push);
module.exports = function(object, names) {
    var O = toIndexedObject(object);
    var i = 0;
    var result = [];
    var key;
    for(key in O)!hasOwn(hiddenKeys, key) && hasOwn(O, key) && push(result, key);
    // Don't enum bug & hidden keys
    while(names.length > i)if (hasOwn(O, key = names[i++])) {
        ~indexOf(result, key) || push(result, key);
    }
    return result;
};


},
3291(__unused_rspack_module, exports) {

var $propertyIsEnumerable = {}.propertyIsEnumerable;
// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
// Nashorn ~ JDK8 bug
var NASHORN_BUG = getOwnPropertyDescriptor && !$propertyIsEnumerable.call({
    1: 2
}, 1);
// `Object.prototype.propertyIsEnumerable` method implementation
// https://tc39.es/ecma262/#sec-object.prototype.propertyisenumerable
exports.f = NASHORN_BUG ? function propertyIsEnumerable(V) {
    var descriptor = getOwnPropertyDescriptor(this, V);
    return !!descriptor && descriptor.enumerable;
} : $propertyIsEnumerable;


},
2076(module, __unused_rspack_exports, __webpack_require__) {

var call = __webpack_require__(8351);
var isCallable = __webpack_require__(5867);
var isObject = __webpack_require__(9400);
var $TypeError = TypeError;
// `OrdinaryToPrimitive` abstract operation
// https://tc39.es/ecma262/#sec-ordinarytoprimitive
module.exports = function(input, pref) {
    var fn, val;
    if (pref === 'string' && isCallable(fn = input.toString) && !isObject(val = call(fn, input))) return val;
    if (isCallable(fn = input.valueOf) && !isObject(val = call(fn, input))) return val;
    if (pref !== 'string' && isCallable(fn = input.toString) && !isObject(val = call(fn, input))) return val;
    throw new $TypeError("Can't convert object to primitive value");
};


},
7449(module, __unused_rspack_exports, __webpack_require__) {

var getBuiltIn = __webpack_require__(4289);
var uncurryThis = __webpack_require__(5274);
var getOwnPropertyNamesModule = __webpack_require__(8518);
var getOwnPropertySymbolsModule = __webpack_require__(9019);
var anObject = __webpack_require__(9349);
var concat = uncurryThis([].concat);
// all object keys, includes non-enumerable and symbols
module.exports = getBuiltIn('Reflect', 'ownKeys') || function ownKeys(it) {
    var keys = getOwnPropertyNamesModule.f(anObject(it));
    var getOwnPropertySymbols = getOwnPropertySymbolsModule.f;
    return getOwnPropertySymbols ? concat(keys, getOwnPropertySymbols(it)) : keys;
};


},
1760(module, __unused_rspack_exports, __webpack_require__) {

var isNullOrUndefined = __webpack_require__(4751);
var $TypeError = TypeError;
// `RequireObjectCoercible` abstract operation
// https://tc39.es/ecma262/#sec-requireobjectcoercible
module.exports = function(it) {
    if (isNullOrUndefined(it)) throw new $TypeError("Can't call method on " + it);
    return it;
};


},
3393(module, __unused_rspack_exports, __webpack_require__) {

var shared = __webpack_require__(6023);
var uid = __webpack_require__(9642);
var keys = shared('keys');
module.exports = function(key) {
    return keys[key] || (keys[key] = uid(key));
};


},
6359(module, __unused_rspack_exports, __webpack_require__) {

var IS_PURE = __webpack_require__(3717);
var globalThis = __webpack_require__(8218);
var defineGlobalProperty = __webpack_require__(2671);
var SHARED = '__core-js_shared__';
var store = module.exports = globalThis[SHARED] || defineGlobalProperty(SHARED, {});
(store.versions || (store.versions = [])).push({
    version: '3.51.0',
    mode: IS_PURE ? 'pure' : 'global',
    copyright: '© 2013–2025 Denis Pushkarev (zloirock.ru), 2025–2026 CoreJS Company (core-js.io). All rights reserved.',
    license: 'https://github.com/zloirock/core-js/blob/v3.51.0/LICENSE',
    source: 'https://github.com/zloirock/core-js'
});


},
6023(module, __unused_rspack_exports, __webpack_require__) {

var store = __webpack_require__(6359);
// eslint-disable-next-line es/no-object-create -- safe
var create = Object.create || Object;
module.exports = function(key, value) {
    return store[key] || (store[key] = value || create(null));
};


},
3277(module, __unused_rspack_exports, __webpack_require__) {

/* eslint-disable es/no-symbol -- required for testing */ var V8_VERSION = __webpack_require__(9773);
var fails = __webpack_require__(3385);
var globalThis = __webpack_require__(8218);
var $String = globalThis.String;
// eslint-disable-next-line es/no-object-getownpropertysymbols -- required for testing
module.exports = !!Object.getOwnPropertySymbols && !fails(function() {
    var symbol = Symbol('symbol detection');
    // Chrome 38 Symbol has incorrect toString conversion
    // `get-own-property-symbols` polyfill symbols converted to object are not Symbol instances
    // nb: Do not call `String` directly to avoid this being optimized out to `symbol+''` which will,
    // of course, fail.
    return !$String(symbol) || !(Object(symbol) instanceof Symbol) || // Chrome 38-40 symbols are not inherited from DOM collections prototypes to instances
    !Symbol.sham && V8_VERSION && V8_VERSION < 41;
});


},
9296(module, __unused_rspack_exports, __webpack_require__) {

var toIntegerOrInfinity = __webpack_require__(3165);
var max = Math.max;
var min = Math.min;
// Helper for a popular repeating case of the spec:
// Let integer be ? ToInteger(index).
// If integer < 0, let result be max((length + integer), 0); else let result be min(integer, length).
module.exports = function(index, length) {
    var integer = toIntegerOrInfinity(index);
    return integer < 0 ? max(integer + length, 0) : min(integer, length);
};


},
5942(module, __unused_rspack_exports, __webpack_require__) {

var toIntegerOrInfinity = __webpack_require__(3165);
var toLength = __webpack_require__(4020);
var $RangeError = RangeError;
// `ToIndex` abstract operation
// https://tc39.es/ecma262/#sec-toindex
module.exports = function(it) {
    if (it === undefined) return 0;
    var number = toIntegerOrInfinity(it);
    var length = toLength(number);
    if (number !== length) throw new $RangeError('Wrong length or index');
    return length;
};


},
4991(module, __unused_rspack_exports, __webpack_require__) {

// toObject with fallback for non-array-like ES3 strings
var IndexedObject = __webpack_require__(6569);
var requireObjectCoercible = __webpack_require__(1760);
module.exports = function(it) {
    return IndexedObject(requireObjectCoercible(it));
};


},
3165(module, __unused_rspack_exports, __webpack_require__) {

var trunc = __webpack_require__(2695);
// `ToIntegerOrInfinity` abstract operation
// https://tc39.es/ecma262/#sec-tointegerorinfinity
module.exports = function(argument) {
    var number = +argument;
    // eslint-disable-next-line no-self-compare -- NaN check
    return number !== number || number === 0 ? 0 : trunc(number);
};


},
4020(module, __unused_rspack_exports, __webpack_require__) {

var toIntegerOrInfinity = __webpack_require__(3165);
var min = Math.min;
// `ToLength` abstract operation
// https://tc39.es/ecma262/#sec-tolength
module.exports = function(argument) {
    var len = toIntegerOrInfinity(argument);
    return len > 0 ? min(len, 0x1FFFFFFFFFFFFF) : 0; // 2 ** 53 - 1 == 9007199254740991
};


},
683(module, __unused_rspack_exports, __webpack_require__) {

var requireObjectCoercible = __webpack_require__(1760);
var $Object = Object;
// `ToObject` abstract operation
// https://tc39.es/ecma262/#sec-toobject
module.exports = function(argument) {
    return $Object(requireObjectCoercible(argument));
};


},
9347(module, __unused_rspack_exports, __webpack_require__) {

var call = __webpack_require__(8351);
var isObject = __webpack_require__(9400);
var isSymbol = __webpack_require__(975);
var getMethod = __webpack_require__(9620);
var ordinaryToPrimitive = __webpack_require__(2076);
var wellKnownSymbol = __webpack_require__(9825);
var $TypeError = TypeError;
var TO_PRIMITIVE = wellKnownSymbol('toPrimitive');
// `ToPrimitive` abstract operation
// https://tc39.es/ecma262/#sec-toprimitive
module.exports = function(input, pref) {
    if (!isObject(input) || isSymbol(input)) return input;
    var exoticToPrim = getMethod(input, TO_PRIMITIVE);
    var result;
    if (exoticToPrim) {
        if (pref === undefined) pref = 'default';
        result = call(exoticToPrim, input, pref);
        if (!isObject(result) || isSymbol(result)) return result;
        throw new $TypeError("Can't convert object to primitive value");
    }
    if (pref === undefined) pref = 'number';
    return ordinaryToPrimitive(input, pref);
};


},
183(module, __unused_rspack_exports, __webpack_require__) {

var toPrimitive = __webpack_require__(9347);
var isSymbol = __webpack_require__(975);
// `ToPropertyKey` abstract operation
// https://tc39.es/ecma262/#sec-topropertykey
module.exports = function(argument) {
    var key = toPrimitive(argument, 'string');
    return isSymbol(key) ? key : key + '';
};


},
5090(module, __unused_rspack_exports, __webpack_require__) {

var wellKnownSymbol = __webpack_require__(9825);
var TO_STRING_TAG = wellKnownSymbol('toStringTag');
var test = {};
// eslint-disable-next-line unicorn/no-immediate-mutation -- ES3 syntax limitation
test[TO_STRING_TAG] = 'z';
module.exports = String(test) === '[object z]';


},
6169(module) {

var $String = String;
module.exports = function(argument) {
    try {
        return $String(argument);
    } catch (error) {
        return 'Object';
    }
};


},
9642(module, __unused_rspack_exports, __webpack_require__) {

var uncurryThis = __webpack_require__(5274);
var id = 0;
var postfix = Math.random();
var toString = uncurryThis(1.1.toString);
module.exports = function(key) {
    return 'Symbol(' + (key === undefined ? '' : key) + ')_' + toString(++id + postfix, 36);
};


},
2014(module, __unused_rspack_exports, __webpack_require__) {

/* eslint-disable es/no-symbol -- required for testing */ var NATIVE_SYMBOL = __webpack_require__(3277);
module.exports = NATIVE_SYMBOL && !Symbol.sham && typeof Symbol.iterator == 'symbol';


},
280(module, __unused_rspack_exports, __webpack_require__) {

var DESCRIPTORS = __webpack_require__(6302);
var fails = __webpack_require__(3385);
// V8 ~ Chrome 36-
// https://bugs.chromium.org/p/v8/issues/detail?id=3334
module.exports = DESCRIPTORS && fails(function() {
    // eslint-disable-next-line es/no-object-defineproperty -- required for testing
    return Object.defineProperty(function() {}, 'prototype', {
        value: 42,
        writable: false
    }).prototype !== 42;
});


},
6740(module, __unused_rspack_exports, __webpack_require__) {

var globalThis = __webpack_require__(8218);
var isCallable = __webpack_require__(5867);
var WeakMap = globalThis.WeakMap;
module.exports = isCallable(WeakMap) && /native code/.test(String(WeakMap));


},
9825(module, __unused_rspack_exports, __webpack_require__) {

var globalThis = __webpack_require__(8218);
var shared = __webpack_require__(6023);
var hasOwn = __webpack_require__(2203);
var uid = __webpack_require__(9642);
var NATIVE_SYMBOL = __webpack_require__(3277);
var USE_SYMBOL_AS_UID = __webpack_require__(2014);
var Symbol = globalThis.Symbol;
var WellKnownSymbolsStore = shared('wks');
var createWellKnownSymbol = USE_SYMBOL_AS_UID ? Symbol['for'] || Symbol : Symbol && Symbol.withoutSetter || uid;
module.exports = function(name) {
    if (!hasOwn(WellKnownSymbolsStore, name)) {
        WellKnownSymbolsStore[name] = NATIVE_SYMBOL && hasOwn(Symbol, name) ? Symbol[name] : createWellKnownSymbol('Symbol.' + name);
    }
    return WellKnownSymbolsStore[name];
};


},
2929(__unused_rspack_module, __unused_rspack_exports, __webpack_require__) {

var $ = __webpack_require__(1924);
var uncurryThis = __webpack_require__(5274);
var pow = Math.pow;
var EXP_MASK16 = 31; // 2 ** 5 - 1
var SIGNIFICAND_MASK16 = 1023; // 2 ** 10 - 1
var MIN_SUBNORMAL16 = pow(2, -24); // 2 ** -10 * 2 ** -14
var SIGNIFICAND_DENOM16 = 0.0009765625; // 2 ** -10
var unpackFloat16 = function(bytes) {
    var sign = bytes >>> 15;
    var exponent = bytes >>> 10 & EXP_MASK16;
    var significand = bytes & SIGNIFICAND_MASK16;
    if (exponent === EXP_MASK16) return significand === 0 ? sign === 0 ? Infinity : -Infinity : NaN;
    if (exponent === 0) return significand * (sign === 0 ? MIN_SUBNORMAL16 : -MIN_SUBNORMAL16);
    return pow(2, exponent - 15) * (sign === 0 ? 1 + significand * SIGNIFICAND_DENOM16 : -1 - significand * SIGNIFICAND_DENOM16);
};
// eslint-disable-next-line es/no-typed-arrays -- safe
var getUint16 = uncurryThis(DataView.prototype.getUint16);
// `DataView.prototype.getFloat16` method
// https://tc39.es/ecma262/#sec-dataview.prototype.getfloat16
$({
    target: 'DataView',
    proto: true
}, {
    getFloat16: function getFloat16(byteOffset /* , littleEndian */ ) {
        return unpackFloat16(getUint16(this, byteOffset, arguments.length > 1 ? arguments[1] : false));
    }
});


},
1037(__unused_rspack_module, __unused_rspack_exports, __webpack_require__) {

var $ = __webpack_require__(1924);
var uncurryThis = __webpack_require__(5274);
var aDataView = __webpack_require__(8332);
var toIndex = __webpack_require__(5942);
// TODO: Replace with module dependency in `core-js@4`
var log2 = __webpack_require__(329);
var roundTiesToEven = __webpack_require__(256);
var floor = Math.floor;
var pow = Math.pow;
var MIN_INFINITY16 = 65520; // (2 - 2 ** -11) * 2 ** 15
var MIN_NORMAL16 = 0.000061005353927612305; // (1 - 2 ** -11) * 2 ** -14
var REC_MIN_SUBNORMAL16 = 16777216; // 2 ** 10 * 2 ** 14
var REC_SIGNIFICAND_DENOM16 = 1024; // 2 ** 10;
var packFloat16 = function(value) {
    // eslint-disable-next-line no-self-compare -- NaN check
    if (value !== value) return 0x7E00; // NaN
    if (value === 0) return (1 / value === -Infinity) << 15; // +0 or -0
    var neg = value < 0;
    if (neg) value = -value;
    if (value >= MIN_INFINITY16) return neg << 15 | 0x7C00; // Infinity
    if (value < MIN_NORMAL16) return neg << 15 | roundTiesToEven(value * REC_MIN_SUBNORMAL16); // subnormal
    // normal
    var exponent = floor(log2(value));
    if (exponent === -15) {
        // we round from a value between 2 ** -15 * (1 + 1022/1024) (the largest subnormal) and 2 ** -14 * (1 + 0/1024) (the smallest normal)
        // to the latter (former impossible because of the subnormal check above)
        return neg << 15 | REC_SIGNIFICAND_DENOM16;
    }
    var significand = roundTiesToEven((value * pow(2, -exponent) - 1) * REC_SIGNIFICAND_DENOM16);
    if (significand === REC_SIGNIFICAND_DENOM16) {
        // we round from a value between 2 ** n * (1 + 1023/1024) and 2 ** (n + 1) * (1 + 0/1024) to the latter
        return neg << 15 | exponent + 16 << 10;
    }
    return neg << 15 | exponent + 15 << 10 | significand;
};
// eslint-disable-next-line es/no-typed-arrays -- safe
var setUint16 = uncurryThis(DataView.prototype.setUint16);
// `DataView.prototype.setFloat16` method
// https://tc39.es/ecma262/#sec-dataview.prototype.setfloat16
$({
    target: 'DataView',
    proto: true
}, {
    setFloat16: function setFloat16(byteOffset, value /* , littleEndian */ ) {
        setUint16(aDataView(this), toIndex(byteOffset), packFloat16(+value), arguments.length > 2 ? arguments[2] : false);
    }
});


},
3270(__unused_rspack_module, __unused_rspack_exports, __webpack_require__) {

var $ = __webpack_require__(1924);
var floatRound = __webpack_require__(4382);
var FLOAT16_EPSILON = 0.0009765625;
var FLOAT16_MAX_VALUE = 65504;
var FLOAT16_MIN_VALUE = 6.103515625e-05;
// `Math.f16round` method
// https://tc39.es/ecma262/#sec-math.f16round
$({
    target: 'Math',
    stat: true
}, {
    f16round: function f16round(x) {
        return floatRound(x, FLOAT16_EPSILON, FLOAT16_MAX_VALUE, FLOAT16_MIN_VALUE);
    }
});


},
});
// core-js's modules for ES2025's half-precision numbers: `Math.f16round` and `DataView`'s
// `getFloat16` and `setFloat16` (core-js has no `Float16Array`). Each installs what its own check
// finds missing or wrong as it loads, so they load only when the fill calls in.
function loadFloat16() {
    __webpack_require__(3270);
    __webpack_require__(2929);
    __webpack_require__(1037);
}

export { loadFloat16 };
