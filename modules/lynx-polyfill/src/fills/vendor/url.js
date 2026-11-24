/*!
 * whatwg-url-minimum 0.2.0 (MIT)
 *
 * MIT License
 *
 * Copyright (c) Phil Pluckthun,
 * Copyright (c) 650 Industries, Inc. (aka Expo),
 * Copyright (c) Sebastian Mayr
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
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
__webpack_modules__[moduleId](module, module.exports, __webpack_require__);

// Return the exports of the module
return module.exports;
}
// expose the modules object (__webpack_modules__)
__webpack_require__.m = __webpack_modules__;

// webpack/runtime/define_property_getters
(() => {
__webpack_require__.d = (exports, getters, values) => {
	var define = (defs, kind) => {
		for(var key in defs) {
			if(__webpack_require__.o(defs, key) && !__webpack_require__.o(exports, key)) {
				Object.defineProperty(exports, key, { enumerable: true, [kind]: defs[key] });
			}
		}
	};
	define(getters, "get");
	define(values, "value");
};
})();
// webpack/runtime/esm_register_module
(() => {
__webpack_require__.add = function registerModules(modules) { Object.assign(__webpack_require__.m, modules) }

})();
// webpack/runtime/has_own_property
(() => {
__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
})();

__webpack_require__.add({
895(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
// The `atob` a vendored module reads by name as it loads (whatwg-url-minimum decodes its IDNA tables
// with it): a module's own, which bundle.ts provides in place of the global, since a thread has no
// `atob` until the package's fills run, after every module has loaded. It decodes the
// package's own tables, which are well-formed base64: no checks.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** The bytes `encoded` stands for, as a string of Latin-1 characters. */ function atob(encoded) {
    let bytes = "";
    let buffer = 0;
    let bits = 0;
    for(let index = 0; index < encoded.length; index++){
        const value = ALPHABET.indexOf(encoded[index]);
        if (value === -1) continue;
        buffer = buffer << 6 | value;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            bytes += String.fromCharCode(buffer >> bits & 0xff);
        }
    }
    return bytes;
}

__webpack_require__.d(__webpack_exports__, {
}, {
  l: atob
});


},
});
/* provided dependency */ var atob = __webpack_require__(895).l;
function toUSVString(A) {
    return "string" == typeof A ? A : String(A);
}
const whatwg_url_minimum_A = /[\ud800-\udbff](?![\udc00-\udfff])|(^|[^\ud800-\udbff])[\udc00-\udfff]/g;
function toWellFormed(e) {
    return e.replace(whatwg_url_minimum_A, "$1�");
}
function toObject(A, e) {
    if ("object" != typeof A || null == A) {
        let A = "";
        A += "The provided value is not an object";
        throw new TypeError(A);
    }
    return A;
}
function toIterator(A) {
    if (null != A && ("object" == typeof A || "function" == typeof A)) {
        const e = A[Symbol.iterator];
        if (null == e) {
            return;
        }
        if ("function" != typeof e) {
            throw new TypeError("The provided value is not iterable");
        }
        const t = e.call(A);
        if (!t || "object" != typeof t) {
            throw new TypeError("Result of the Symbol.iterator method is not an object");
        }
        return t;
    }
    return;
}
function toQueryPair(A) {
    let e;
    if (Array.isArray(A)) {
        const e = A.map(toUSVString);
        if (2 === e.length) {
            return e;
        }
    } else if (null != (e = toIterator(A))) {
        const A = toObject(e.next());
        const t = toObject(e.next());
        if (!A.done && !t.done) {
            return [
                toUSVString(A.value),
                toUSVString(t.value)
            ];
        }
    }
    throw new TypeError("Each query pair must be an iterable [name, value] tuple");
}
const whatwg_url_minimum_e = "0123456789ABCDEF";
const whatwg_url_minimum_t = /(?:%[0-9A-Fa-f]{2})+/g;
function percentEncode(A) {
    return `%${whatwg_url_minimum_e[A >> 4 & 15]}${whatwg_url_minimum_e[15 & A]}`;
}
function utf8PercentEncodeScalar(A, e, t = !1) {
    if (A >= 55296 && A <= 57343) {
        A = 65533;
    }
    if (A <= 127) {
        if (t && 32 === A) {
            return "+";
        }
        return e(A) ? percentEncode(A) : String.fromCharCode(A);
    } else if (A <= 2047) {
        return percentEncode(192 | A >> 6) + percentEncode(128 | 63 & A);
    } else if (A <= 65535) {
        return percentEncode(224 | A >> 12) + percentEncode(128 | A >> 6 & 63) + percentEncode(128 | 63 & A);
    } else {
        return percentEncode(240 | A >> 18) + percentEncode(128 | A >> 12 & 63) + percentEncode(128 | A >> 6 & 63) + percentEncode(128 | 63 & A);
    }
}
function decodeHexDigit(A) {
    if (A >= 48 && A <= 57) {
        return A - 48;
    } else if (A >= 65 && A <= 70) {
        return A - 65 + 10;
    } else if (A >= 97 && A <= 102) {
        return A - 97 + 10;
    } else {
        return -1;
    }
}
function percentDecodeString(A, e = !1) {
    let n = 0;
    for(; n < A.length; n++){
        const t = A.charCodeAt(n);
        if (37 === t || e && 43 === t) {
            break;
        }
    }
    if (n === A.length) {
        return A;
    }
    return (e ? A.replace(/\+/g, " ") : A).replace(whatwg_url_minimum_t, (A)=>{
        try {
            return decodeURIComponent(A);
        } catch  {
            return "�".repeat(A.length / 3);
        }
    });
}
function isC0ControlPercentEncode(A) {
    return A <= 31 || A > 126;
}
function isFragmentPercentEncode(A) {
    switch(A){
        case 32:
        case 34:
        case 60:
        case 62:
        case 96:
            return !0;
        default:
            return isC0ControlPercentEncode(A);
    }
}
function isQueryPercentEncode(A) {
    switch(A){
        case 32:
        case 34:
        case 35:
        case 60:
        case 62:
            return !0;
        default:
            return isC0ControlPercentEncode(A);
    }
}
function isSpecialQueryPercentEncode(A) {
    return isQueryPercentEncode(A) || 39 === A;
}
function isPathPercentEncode(A) {
    switch(A){
        case 63:
        case 94:
        case 96:
        case 123:
        case 125:
            return !0;
        default:
            return isQueryPercentEncode(A);
    }
}
function isUserinfoPercentEncode(A) {
    switch(A){
        case 47:
        case 58:
        case 59:
        case 61:
        case 64:
        case 91:
        case 92:
        case 93:
        case 124:
            return !0;
        default:
            return isPathPercentEncode(A);
    }
}
function isURLEncodedPercentEncode(A) {
    switch(A){
        case 33:
        case 39:
        case 40:
        case 41:
        case 126:
            return !0;
        default:
            return function isComponentPercentEncode(A) {
                switch(A){
                    case 36:
                    case 37:
                    case 38:
                    case 43:
                    case 44:
                        return !0;
                    default:
                        return isUserinfoPercentEncode(A);
                }
            }(A);
    }
}
function utf8PercentEncodeCodePoint(A, e) {
    return utf8PercentEncodeScalar(A = A || 0, e);
}
function utf8PercentEncodeString(A, e, t = !1) {
    let n = 0;
    for(; n < A.length; n++){
        const r = A.charCodeAt(n);
        if (r >= 128) {
            break;
        }
        if (t && 32 === r || e(r)) {
            break;
        }
    }
    if (n === A.length) {
        return A;
    }
    let r = A.slice(0, n);
    for(; n < A.length; n++){
        const o = A.charCodeAt(n);
        let i = o;
        if (o >= 55296 && o <= 56319 && n + 1 < A.length) {
            const e = A.charCodeAt(n + 1);
            if (e >= 56320 && e <= 57343) {
                i = (o - 55296 << 10) + e - 56320 + 65536;
                n++;
            }
        }
        r += utf8PercentEncodeScalar(i, e, t);
    }
    return r;
}
function parseUrlencoded(A) {
    const e = [];
    let t = 0;
    let n = 0;
    while(n <= A.length){
        n = A.indexOf("&", t);
        if (n < 0) {
            n = A.length;
        }
        if (n !== t) {
            const r = A.slice(t, n);
            let o = r.indexOf("=");
            if (o < 0) {
                o = r.length;
            }
            e.push([
                percentDecodeString(r.slice(0, o), !0),
                percentDecodeString(r.slice(o + 1), !0)
            ]);
        }
        t = n + 1;
        if (n === A.length) {
            break;
        }
    }
    return e;
}
function serializeUrlencoded(A) {
    let e = "";
    for(let t = 0; t < A.length; t++){
        const n = utf8PercentEncodeString(A[t][0], isURLEncodedPercentEncode, !0);
        const r = utf8PercentEncodeString(A[t][1], isURLEncodedPercentEncode, !0);
        e += 0 !== t ? `&${n}=${r}` : `${n}=${r}`;
    }
    return e;
}
const whatwg_url_minimum_n = [
    2191,
    2191,
    3164,
    3164,
    3292,
    3292,
    6863,
    6877,
    6880,
    6891,
    8385,
    8385,
    11158,
    11158,
    42958,
    42959,
    42962,
    42962,
    42964,
    42964,
    42993,
    42993,
    64451,
    64466,
    64912,
    64913,
    64968,
    64974,
    67904,
    67929,
    69317,
    69319,
    69328,
    69336,
    69370,
    69371,
    72544,
    72551,
    73136,
    73179,
    73184,
    73193,
    93856,
    93880,
    93883,
    93907,
    94194,
    94198,
    100344,
    100351,
    101641,
    101662,
    101760,
    101874,
    118010,
    118012,
    118458,
    118480,
    118496,
    118512,
    124608,
    124638,
    124640,
    124661,
    124670,
    124671,
    128728,
    128728,
    128887,
    128890,
    129232,
    129240,
    129620,
    129623,
    129674,
    129674,
    129678,
    129678,
    129736,
    129736,
    129741,
    129741,
    129770,
    129770,
    129775,
    129775,
    130042,
    130042,
    177978,
    177983,
    183970,
    183981,
    205744,
    210041
];
const whatwg_url_minimum_r = [
    7296,
    7297,
    7298,
    7299,
    7300,
    7301,
    7302,
    7303,
    7304,
    42958,
    42962,
    42964,
    42993
];
const whatwg_url_minimum_o = [
    "в",
    "д",
    "о",
    "с",
    "т",
    "т",
    "ъ",
    "ѣ",
    "ꙋ",
    "꟏",
    "ꟓ",
    "ꟕ",
    "s"
];
const whatwg_url_minimum_i = [
    2381,
    2381,
    2509,
    2509,
    2637,
    2637,
    2765,
    2765,
    2893,
    2893,
    3021,
    3021,
    3149,
    3149,
    3277,
    3277,
    3387,
    3388,
    3405,
    3405,
    3530,
    3530,
    3642,
    3642,
    3770,
    3770,
    3972,
    3972,
    4153,
    4154,
    5908,
    5909,
    5940,
    5940,
    6098,
    6098,
    6752,
    6752,
    6980,
    6980,
    7082,
    7083,
    7154,
    7155,
    11647,
    11647,
    43014,
    43014,
    43052,
    43052,
    43204,
    43204,
    43347,
    43347,
    43456,
    43456,
    43766,
    43766,
    44013,
    44013,
    68159,
    68159,
    69702,
    69702,
    69744,
    69744,
    69759,
    69759,
    69817,
    69817,
    69939,
    69940,
    70080,
    70080,
    70197,
    70197,
    70378,
    70378,
    70477,
    70477,
    70606,
    70608,
    70722,
    70722,
    70850,
    70850,
    71103,
    71103,
    71231,
    71231,
    71350,
    71350,
    71467,
    71467,
    71737,
    71737,
    71997,
    71998,
    72160,
    72160,
    72244,
    72244,
    72263,
    72263,
    72345,
    72345,
    72767,
    72767,
    73028,
    73029,
    73111,
    73111,
    73537,
    73538,
    90415,
    90415
];
function containsInvalidDomainCodePoint(A) {
    for(let e = 0; e < A.length; e++){
        const t = A.codePointAt(e);
        if (t > 65535) {
            e++;
        }
        if (t <= 32 || 37 === t || 127 === t || t >= 55296 && t <= 57343 || t >= 128 && t <= 159 || t >= 64976 && t <= 65007 || !(65534 & ~t) || 65533 === t) {
            return !0;
        }
    }
    return !1;
}
const [whatwg_url_minimum_s, whatwg_url_minimum_c, l, u] = [
    [
        [],
        "0,6,7,8,m,w,10,1b,1d,1f,72,73,7k,8k,dt,2rk",
        "AAAAAAAAAAAAAAAAAAAAAP////8AAAAAAAAAAAAAAAA/AAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAADAAABwfwAAAAAAAMADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//w8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAhAAAAQAAAAAAAAQCAAABAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgACAAAAAAAAAAAAAAAAD//wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAP///////////////wAAAAAAAAAAAAAAAAAAAAA="
    ],
    [
        [],
        "6,7,8,o,4o,7e,7f,7h,7i,7j,dl",
        "AAAAAEF9+P/+BwAAAMAA//8AAPz/////BlADAAAAAJwAAPz///8AAADA//H/5+X8AAAAAAAAAAAA/P///wcAAAAAAAAAAAAAPv0vAD0BAABA/gAA/5/5/f8BAAAAAAAAgAAAAP//////////////AYD/////BQAAAAAAAAAAAAAAAAAAAAAAAP///////wcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8g+N8B+AAAAAAAAAAAAAAAAAAAAAAAAP//AwAAYAAAAAAAAAAAAAD/////CwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANgAAAAAAAAAAAAAAAAA//8fAB4AAAD//wMAAAAAAH3/HgwAAAAAAAD//////////w8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
    ],
    [
        [],
        "6,7,8,o,4o,7e,7f,7h,7i,7j,dl",
        "AAAAAP3////+BwAAAMDu//////////////8vAADAAJwAAP3///8AAADg////////AAAAAAAAAAAA/P///wcAAAAAAAAAAAAA////Ab0H//9H/gAA/9////8BAAAAAAAAgAAAAP//////////////AYD/////BQAAAAAAAAAAAAAAAAAAAAAAAP///////wcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAL/G//8T+AAAAAAAAAAAAAAAAAAAAAAAAP//AwAAfgAAAAAAAAAAAAD+////DwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANwAAAAAAAAAAAAAAAAA//8fAB4AAAD//wMAAAAAAH3/Hg4AAAAAAAD//////////w8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
    ],
    [
        [],
        "0,3,4,5,6,7,8,9,a,b,c,d,e,f,g,j,n,o,p,q,r,s,t,w,18,19,1c,4m,4o,4p,4q,4r,6z,72,73,75,76,77,7e,7h,7i,7j,7k,7l,7m,7n,7o,7p,7q,7r,7s,7t,7u,7v,7w,7x,7y,7z,8k,9t,a2,a3,a7,cc,cv,cx,cy,d6,dc,dd,de,dg,dh,di,dk,dl,2rk,2rl",
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAD//////////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/v////+/tgAAAAAAAAAAAP8XAAAAAAD4//8AAAEAAAAAAAAAAAAAAMCfnz0AAACAAgAAAP///wcAAAAAAAAAAAAAwP8BAAAAAAAA+A8gAADA++8+AAAAAAAOAAAAAAAAgP8AAAAAAPz///v///8HAAAAAAAAFP4h/gAMAAAAAgAAAAAAABAeIAAADAAAQAYAAAAAAAAQhjkCAAAAIwAGAAAAAAAAEL4hAAAMAAD8AgAAAAAAAJAeIGAADAAAAAQAAAAAAAAAASAAAAAAAAARAAAAAAAA0ME9YAAMAAAAAgAAAAAAAJBAMAAADAAAAAMAAAAAAAAYHiAAAAwAAAACAAAAAAAAAAAEXAAAAAAAAAAAAAAA8geAfwAAAAAAAAAAAAAAAPIfAH8AAAAAAAAAAAADAACgAgAAAAAAAP5/3+D//v///x9AAAAAAAAAAAAAAAAA4P1mAAAAwwEAHgBkIAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAMAAAADAAAAAwAAAAAAAAAsD9A/g8gAAAAAAC4AAAAAAAAAAAAAAAAAABgAAAAAAIAAAAAAAAAAAAAAAAAAIcBBA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAJAAAAAAAAQH/lH/ifAAAAAAAA//////8//w8AAA8AAAAAANAXBAAAAAD4DwADAAAAPDsAAAAAAABAowMAAAAAAADwzwAAAAAAAAAAAAAAAAAAAAAAAAD3//0hEAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//////////wDIAAAAfAAAAAAAAB/8AAAAAAAAAAAAAAAA/////wEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAwAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAA/////wAAAAAAPAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAID3PwAAAMAAAAAAAAAAAAAAAwBECAAAYBAAAAAAAAAAAAAAAAAAAAAAAAAwAAAA//8DgAAAAADAPwAAgP8DAAAAAAAHAAAAAADIMwAAAAAgAAAAAAAAAAB+ZgAIEAAAAAAAEAAAAAAAAJ3BAgAAAAAwQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICEAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//8AAP//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAMAHAAAAAAAAAAAAAAAAAAAAAG7wAAAAAACHAAAAAAAAAAAAAAAAAAAAAAAAAABgAAAAAAAAAPAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAA/AAAAAAAAAAAwP8BAAAAAAA8AAAAAAAAAAAAAAAAAAAAAgAAAAAAAP9/AAAAAAAZgAMAAAAAAHgGBAAAAAAAAAAHAAAAgO8fAAAAAAAAAAgAAwAAAAAAwH8AngAAAAAAAAAAAAAAgNNAAgAAAAAAAAAAAAAAAAAAAAAAAID4BwAAAwAAAAAAABgBAAAAwB8fAAAAAAAAAAD4AUAFAAYAAAAAAAAAAAAA/1wAAEAAAAAAAAAAAAAA+IUNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8sAEAADAAAAAAAAAAAAAA+KcBAAAAAAAAAAAAAAAAKL8AAAAAAAAAAAAAAACgvA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgP8GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFgIAAAAAAAAAAAAAAAAAAAAAADwDAEAAAD+BwAAAAD4eYAAfg4AAAAAAPx/AwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf78AAAAAAAAAAAAA/P///G0AAAAAAAAAAAAAAAAAAAB+tL8AAAAAAAAAAACjAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgAAwAAAAAAwAcFAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//4H/PwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMD/4wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwAAAAAAAAB/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAgAcAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAPAAAAAAAAAAAAAAD//////z///38AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAD+P/nDwAAADwAAAAAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD///////9/+P//////HyAAEAAA+P7/AAAAAAAAAAAAAH////nbBwAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAfwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAPAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASMAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfwAAAAAAAAAAAAAAAADwDwAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAA////////////////AAAAAAAAAAAAAAAAAAAAAP///////////////////////////////////////wAA"
    ]
].map(function prepareBitmap([A, e, t]) {
    return [
        A,
        e.split(",").map((A)=>parseInt(A, 36)),
        Uint8Array.from(atob(t), (A)=>A.charCodeAt(0))
    ];
});
function mapIDNACodePoint(A, e) {
    if (931 === e || 1010 === e || 120531 === e || 120589 === e || 120647 === e || 120705 === e || 120763 === e) {
        return "σ";
    } else if (e >= 5112 && e <= 5117) {
        return String.fromCodePoint(e - 8);
    } else if (e >= 43888 && e <= 43967) {
        return String.fromCodePoint(e - 38864);
    } else if (e >= 93856 && e <= 93880) {
        return String.fromCodePoint(e + 27);
    } else if (837 === e || 890 === e || e >= 8064 && e <= 8111 || e >= 8114 && e <= 8188) {
        return A.normalize("NFD").replace(/\u0345/g, "ι").normalize("NFC").toLowerCase();
    } else {
        return "";
    }
}
function hasCodePointInRanges(A, e) {
    for(let t = 0; t < A.length; t += 2){
        if (e >= A[t] && e <= A[t + 1]) {
            return !0;
        }
    }
    return !1;
}
function hasCodePointInBitmap(A, e) {
    const [t, n, r] = A;
    const o = e >> 8;
    for(let A = 0; A < t.length; A += 2){
        if (o >= t[A] && o <= t[A + 1]) {
            return !0;
        }
    }
    const i = n.indexOf(o);
    if (i < 0) {
        return !1;
    }
    const s = 255 & e;
    return !!(r[32 * i + (s >> 3)] & 1 << (7 & s));
}
function hasValidJoiners(A) {
    const e = Array.from(A, (A)=>A.codePointAt(0));
    for(let A = 0; A < e.length; A++){
        const t = e[A];
        if (8204 !== t && 8205 !== t) {
            continue;
        }
        if (A > 0 && hasCodePointInRanges(whatwg_url_minimum_i, e[A - 1])) {
            continue;
        }
        if (8205 === t) {
            return !1;
        }
        let n = A - 1;
        while(n >= 0 && hasCodePointInBitmap(u, e[n])){
            n--;
        }
        let r = A + 1;
        while(r < e.length && hasCodePointInBitmap(u, e[r])){
            r++;
        }
        if (n >= 0 && r < e.length && hasCodePointInBitmap(whatwg_url_minimum_c, e[n]) && hasCodePointInBitmap(l, e[r])) {
            continue;
        }
        return !1;
    }
    return !0;
}
const a = /(?![0-9\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7-\u05C9\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0897-\u089F\u08CA-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B53-\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C04\u0C3C\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0CF3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1712-\u1715\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u180F-\u1819\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19D0-\u19D9\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1AF0\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA620-\uA629\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880\uA881\uA8B4-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F1\uA8FF-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFF10-\uFF19\u{101FD}\u{102E0}\u{10376}-\u{1037A}\u{104A0}-\u{104A9}\u{10A01}-\u{10A03}\u{10A05}\u{10A06}\u{10A0C}-\u{10A0F}\u{10A38}-\u{10A3A}\u{10A3F}\u{10AE5}\u{10AE6}\u{10D24}-\u{10D27}\u{10D30}-\u{10D39}\u{10D40}-\u{10D49}\u{10D69}-\u{10D6D}\u{10EAB}\u{10EAC}\u{10ECB}-\u{10ECF}\u{10EF0}-\u{10EFF}\u{10F46}-\u{10F50}\u{10F82}-\u{10F85}\u{11000}-\u{11002}\u{11038}-\u{11046}\u{11066}-\u{11070}\u{11073}\u{11074}\u{1107F}-\u{11082}\u{110B0}-\u{110BA}\u{110C2}\u{110F0}-\u{110F9}\u{11100}-\u{11102}\u{11127}-\u{11134}\u{11136}-\u{1113F}\u{11145}\u{11146}\u{11173}\u{11180}-\u{11182}\u{111B3}-\u{111C0}\u{111C9}-\u{111CC}\u{111CE}-\u{111D9}\u{1122C}-\u{11237}\u{1123E}\u{11241}\u{112DF}-\u{112EA}\u{112F0}-\u{112F9}\u{11300}-\u{11303}\u{1133B}\u{1133C}\u{1133E}-\u{11344}\u{11347}\u{11348}\u{1134B}-\u{1134D}\u{11357}\u{11362}\u{11363}\u{11366}-\u{1136C}\u{11370}-\u{11374}\u{113B8}-\u{113C0}\u{113C2}\u{113C5}\u{113C7}-\u{113CA}\u{113CC}-\u{113D0}\u{113D2}\u{113E1}\u{113E2}\u{11435}-\u{11446}\u{11450}-\u{11459}\u{1145E}\u{114B0}-\u{114C3}\u{114D0}-\u{114D9}\u{115AF}-\u{115B5}\u{115B8}-\u{115C0}\u{115DC}\u{115DD}\u{11630}-\u{11640}\u{11650}-\u{11659}\u{116AB}-\u{116B7}\u{116C0}-\u{116C9}\u{116D0}-\u{116E3}\u{1171D}-\u{1172B}\u{11730}-\u{11739}\u{1182C}-\u{1183A}\u{118E0}-\u{118E9}\u{11930}-\u{11935}\u{11937}\u{11938}\u{1193B}-\u{1193E}\u{11940}\u{11942}\u{11943}\u{11950}-\u{11959}\u{119D1}-\u{119D7}\u{119DA}-\u{119E0}\u{119E4}\u{11A01}-\u{11A0A}\u{11A33}-\u{11A39}\u{11A3B}-\u{11A3E}\u{11A47}\u{11A51}-\u{11A5B}\u{11A8A}-\u{11A99}\u{11B60}-\u{11B67}\u{11BF0}-\u{11BF9}\u{11C2F}-\u{11C36}\u{11C38}-\u{11C3F}\u{11C50}-\u{11C59}\u{11C92}-\u{11CA7}\u{11CA9}-\u{11CB6}\u{11D31}-\u{11D36}\u{11D3A}\u{11D3C}\u{11D3D}\u{11D3F}-\u{11D45}\u{11D47}\u{11D50}-\u{11D59}\u{11D8A}-\u{11D8E}\u{11D90}\u{11D91}\u{11D93}-\u{11D97}\u{11DA0}-\u{11DA9}\u{11DE0}-\u{11DE9}\u{11DF0}\u{11EF3}-\u{11EF6}\u{11F00}\u{11F01}\u{11F03}\u{11F34}-\u{11F3A}\u{11F3E}-\u{11F42}\u{11F50}-\u{11F5A}\u{13440}\u{13447}-\u{13455}\u{1611E}-\u{16139}\u{16A60}-\u{16A69}\u{16AC0}-\u{16AC9}\u{16AF0}-\u{16AF4}\u{16B30}-\u{16B36}\u{16B50}-\u{16B59}\u{16D70}-\u{16D79}\u{16F4F}\u{16F51}-\u{16F87}\u{16F8F}-\u{16F92}\u{16FE4}\u{16FF0}\u{16FF1}\u{1BC9D}\u{1BC9E}\u{1CCF0}-\u{1CCF9}\u{1CF00}-\u{1CF2D}\u{1CF30}-\u{1CF46}\u{1D127}\u{1D128}\u{1D165}-\u{1D169}\u{1D16D}-\u{1D172}\u{1D17B}-\u{1D182}\u{1D185}-\u{1D18B}\u{1D1AA}-\u{1D1AD}\u{1D242}-\u{1D244}\u{1D250}-\u{1D252}\u{1D25B}\u{1D25C}\u{1D25F}\u{1D280}\u{1D281}\u{1D7CE}-\u{1D7FF}\u{1DA00}-\u{1DA36}\u{1DA3B}-\u{1DA6C}\u{1DA75}\u{1DA84}\u{1DA9B}-\u{1DA9F}\u{1DAA1}-\u{1DAAF}\u{1E000}-\u{1E006}\u{1E008}-\u{1E018}\u{1E01B}-\u{1E021}\u{1E023}\u{1E024}\u{1E026}-\u{1E02A}\u{1E08F}\u{1E130}-\u{1E136}\u{1E140}-\u{1E149}\u{1E2AE}\u{1E2EC}-\u{1E2F9}\u{1E4EC}-\u{1E4F9}\u{1E5EE}\u{1E5EF}\u{1E5F1}-\u{1E5FA}\u{1E6E3}\u{1E6E6}\u{1E6EE}\u{1E6EF}\u{1E6F5}\u{1E8D0}-\u{1E8D6}\u{1E944}-\u{1E94A}\u{1E950}-\u{1E959}\u{1FBF0}-\u{1FBF9}\u{E0100}-\u{E01EF}])[\u0591-\u05C9\u05D0-\u05EA\u05EF-\u05F4\u0600-\u0604\u0606-\u060B\u060D-\u061A\u061C-\u061E\u0620-\u063F\u0641-\u064A\u0656-\u066F\u0671-\u06DC\u06DE-\u06FF\u0750-\u077F\u0870-\u0891\u0897-\u08E1\u08E3-\u08FF\uFB1D-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFD3D\uFD40-\uFDCF\uFDF0-\uFDFF\uFE70-\uFE74\uFE76-\uFEFC\u{10E60}-\u{10E7E}\u{10EC2}-\u{10EC7}\u{10EC9}-\u{10EEE}\u{10EF0}-\u{10EFF}\u{1EE00}-\u{1EE03}\u{1EE05}-\u{1EE1F}\u{1EE21}\u{1EE22}\u{1EE24}\u{1EE27}\u{1EE29}-\u{1EE32}\u{1EE34}-\u{1EE37}\u{1EE39}\u{1EE3B}\u{1EE42}\u{1EE47}\u{1EE49}\u{1EE4B}\u{1EE4D}-\u{1EE4F}\u{1EE51}\u{1EE52}\u{1EE54}\u{1EE57}\u{1EE59}\u{1EE5B}\u{1EE5D}\u{1EE5F}\u{1EE61}\u{1EE62}\u{1EE64}\u{1EE67}-\u{1EE6A}\u{1EE6C}-\u{1EE72}\u{1EE74}-\u{1EE77}\u{1EE79}-\u{1EE7C}\u{1EE7E}\u{1EE80}-\u{1EE89}\u{1EE8B}-\u{1EE9B}\u{1EEA1}-\u{1EEA3}\u{1EEA5}-\u{1EEA9}\u{1EEAB}-\u{1EEBB}\u{1EEF0}\u{1EEF1}]/u;
const f = /[A-Za-z\xAA\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02B8\u02E0-\u02E4\u1D00-\u1D25\u1D2C-\u1D5C\u1D62-\u1D65\u1D6B-\u1D77\u1D79-\u1DBE\u1E00-\u1EFF\u2071\u207F\u2090-\u209F\u212A\u212B\u2132\u214E\u2160-\u2188\u2C60-\u2C7F\uA722-\uA787\uA78B-\uA7DD\uA7E2\uA7F1-\uA7FF\uAB30-\uAB5A\uAB5C-\uAB64\uAB66-\uAB69\uAB6C\uAB6D\uFB00-\uFB06\uFF21-\uFF3A\uFF41-\uFF5A\u{10780}-\u{10785}\u{10787}-\u{107B0}\u{107B2}-\u{107BF}\u{1DF00}-\u{1DF81}\u{1DF90}-\u{1DF96}\u{1DFCD}-\u{1DFF2}\u{1DFF5}-\u{1DFFF}]/u;
function hasValidBidi(A) {
    return !a.test(A) || !f.test(A);
}
const d = 36;
const h = 1;
const P = 26;
const p = 38;
const g = 700;
const m = 72;
const S = 128;
const w = 2147483647;
function digitToBasic(A) {
    return String.fromCharCode(A + 22 + 75 * Number(A < 26));
}
function adapt(A, e, t) {
    let n = 0;
    A = t ? Math.floor(A / g) : A >> 1;
    A += Math.floor(A / e);
    for(; A > (d - h) * P >> 1; n += d){
        A = Math.floor(A / (d - h));
    }
    return Math.floor(n + (d - h + 1) * A / (A + p));
}
function encodePunycode(A) {
    const e = Array.from(A, (A)=>A.codePointAt(0));
    let t = "";
    let n = 0;
    for(let A = 0; A < e.length; A++){
        const r = e[A];
        if (r < 128) {
            t += String.fromCharCode(r);
            n++;
        }
    }
    const r = n;
    if (r) {
        t += "-";
    }
    let o = S;
    let i = 0;
    let s = m;
    while(n < e.length){
        let A = w;
        for(let t = 0; t < e.length; t++){
            const n = e[t];
            if (n >= o && n < A) {
                A = n;
            }
        }
        i += (A - o) * (n + 1);
        o = A;
        for(let A = 0; A < e.length; A++){
            const c = e[A];
            if (c < o) {
                i++;
            }
            if (c === o) {
                let A = i;
                for(let e = d;; e += d){
                    const n = e <= s ? h : e >= s + P ? P : e - s;
                    if (A < n) {
                        break;
                    }
                    t += digitToBasic(n + (A - n) % (d - n));
                    A = Math.floor((A - n) / (d - n));
                }
                t += digitToBasic(A);
                s = adapt(i, n + 1, n === r);
                i = 0;
                n++;
            }
        }
        i++;
        o++;
    }
    return t;
}
function parseIPv4Number(A) {
    let e = 10;
    if (A.length >= 2 && "0" === A[0] && ("x" === A[1] || "X" === A[1])) {
        A = A.slice(2);
        e = 16;
    } else if (A.length >= 2 && "0" === A[0]) {
        A = A.slice(1);
        e = 8;
    } else if ("" === A) {
        return -1;
    }
    let t = 0;
    for(let n = 0; n < A.length; n++){
        const r = decodeHexDigit(A.charCodeAt(n));
        if (r >= e || r < 0) {
            return -1;
        }
        t = t * e + r;
    }
    return t;
}
function isSingleDot(A) {
    switch(A){
        case ".":
        case "%2e":
        case "%2E":
            return !0;
        default:
            return !1;
    }
}
function isWindowsDriveLetterCodePoints(A, e) {
    return (A >= 65 && A <= 90 || A >= 97 && A <= 122) && (58 === e || 124 === e);
}
function isWindowsDriveLetterString(A) {
    return 2 === A.length && isWindowsDriveLetterCodePoints(A.codePointAt(0), A.codePointAt(1));
}
function containsForbiddenHostCodePoint(A) {
    return -1 !== A.search(/\u0000|\u0009|\u000A|\u000D|\u0020|#|\/|:|<|>|\?|@|\[|\\|\]|\^|\|/u);
}
function isSpecial(A) {
    switch(A){
        case "ftp":
        case "http":
        case "https":
        case "ws":
        case "wss":
        case "file":
            return !0;
        default:
            return !1;
    }
}
function defaultPort(A) {
    switch(A){
        case "ftp":
            return 21;
        case "http":
        case "ws":
            return 80;
        case "https":
        case "wss":
            return 443;
        default:
            return null;
    }
}
function parseHost(A, e) {
    if ("[" === A[0]) {
        return "]" === A[A.length - 1] ? function parseIPv6(A) {
            const e = [
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0
            ];
            let t = null;
            let n = 0;
            let r = 0;
            const o = Array.from(A, (A)=>A.codePointAt(0));
            if (58 === o[r]) {
                if (58 !== o[r + 1]) {
                    return null;
                }
                r += 2;
                n++;
                t = n;
            }
            while(r < o.length){
                if (8 === n) {
                    return null;
                } else if (58 === o[r]) {
                    if (null !== t) {
                        return null;
                    }
                    r++;
                    n++;
                    t = n;
                    continue;
                }
                let A = 0;
                let i = 0;
                let s = 0;
                while(s < 4 && (A = decodeHexDigit(o[r])) >= 0){
                    i = (i << 4) + A;
                    r++;
                    s++;
                }
                if (46 === o[r]) {
                    if (0 === s) {
                        return null;
                    }
                    if (n > 6) {
                        return null;
                    }
                    r -= s;
                    let A = 0;
                    while(void 0 !== o[r]){
                        let t = 0;
                        if (A > 0) {
                            if (46 === o[r] && A < 4) {
                                r++;
                            } else {
                                return null;
                            }
                        }
                        if (null == o[r] || o[r] < 48 || o[r] > 57) {
                            return null;
                        }
                        while(o[r] >= 48 && o[r] <= 57){
                            t = 10 * t + decodeHexDigit(o[r]);
                            if (t > 255) {
                                return null;
                            }
                            r++;
                        }
                        e[n] = 256 * e[n] + t;
                        A++;
                        if (A % 2 == 0) {
                            n++;
                        }
                    }
                    if (4 !== A) {
                        return null;
                    }
                    break;
                } else if (58 === o[r]) {
                    if (void 0 === o[++r]) {
                        return null;
                    }
                } else if (void 0 !== o[r]) {
                    return null;
                }
                e[n] = i;
                n++;
            }
            if (null !== t) {
                let A = n - t;
                n = 7;
                while(0 !== n && A > 0){
                    const r = e[t + A - 1];
                    e[t + A - 1] = e[n];
                    e[n] = r;
                    n--;
                    A--;
                }
            } else if (null === t && 8 !== n) {
                return null;
            }
            return e;
        }(A.substring(1, A.length - 1)) : null;
    } else if (e) {
        return function parseOpaqueHost(A) {
            return !containsForbiddenHostCodePoint(A) ? utf8PercentEncodeString(A, isC0ControlPercentEncode) : null;
        }(A);
    } else {
        const e = function normalizeDomain(A) {
            let e = !1;
            let t = !1;
            for(let n = 0; n < A.length; n++){
                const r = A.charCodeAt(n);
                if (r <= 32 || 37 === r || 127 === r) {
                    return null;
                }
                if (r >= 128) {
                    e = !0;
                    break;
                }
                if (r >= 65 && r <= 90) {
                    t = !0;
                }
            }
            if (!e) {
                return "" !== A ? t ? A.toLowerCase() : A : null;
            }
            if (function hasDisallowedIDNACodePoint(A) {
                for (const e of A){
                    const A = e.codePointAt(0);
                    if (/[\u0378\u0379\u0380-\u0383\u038B\u038D\u03A2\u0530\u0557\u0590\u05CA-\u05CF\u05EB-\u05EE\u05F5-\u05FF\u070E\u074B\u074C\u07B2-\u07BF\u07FB\u07FC\u082E\u082F\u083F\u085C\u085D\u085F\u086B-\u086F\u0892-\u0896\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09FF\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A77-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF2-\u0AF8\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B52\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B78-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BFB-\u0BFF\u0C0D\u0C11\u0C29\u0C3A\u0C3B\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5B\u0C5E\u0C5F\u0C64\u0C65\u0C70-\u0C76\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDB\u0CDF\u0CE4\u0CE5\u0CF0\u0CF4-\u0CFF\u0D0D\u0D11\u0D45\u0D49\u0D50-\u0D53\u0D64\u0D65\u0D80\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DE5\u0DF0\u0DF1\u0DF5-\u0E00\u0E3B-\u0E3E\u0E5C-\u0E80\u0E83\u0E85\u0E8B\u0EA4\u0EA6\u0EBE\u0EBF\u0EC5\u0EC7\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F48\u0F6D-\u0F70\u0F98\u0FBD\u0FCD\u0FDB-\u0FFF\u10C6\u10C8-\u10CC\u10CE\u10CF\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u137D-\u137F\u139A-\u139F\u13F6\u13F7\u13FE\u13FF\u169D-\u169F\u16F9-\u16FF\u1716-\u171E\u1737-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17DE\u17DF\u17EA-\u17EF\u17FA-\u17FF\u181A-\u181F\u1879-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191F\u192C-\u192F\u193C-\u193F\u1941-\u1943\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19DD\u1A1C\u1A1D\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1A9F\u1AAE\u1AAF\u1AF1-\u1AFF\u1B4D\u1BF4-\u1BFB\u1C38-\u1C3A\u1C4A-\u1C4C\u1C8B-\u1C8F\u1CBB\u1CBC\u1CC8-\u1CCF\u1CFB-\u1CFF\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FC5\u1FD4\u1FD5\u1FDC\u1FF0\u1FF1\u1FF5\u1FFF\u2065\u2072\u2073\u20C5-\u20CF\u20F1-\u20FF\u218C-\u218F\u242A-\u243F\u244B-\u245F\u2B74\u2B75\u2CF4-\u2CF8\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D71-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E5E\u2E5F\u2E64-\u2E7F\u2E9A\u2EF4-\u2EFF\u2FD6-\u2FEF\u3040\u3097\u3098\u3100-\u3104\u3130\u318F\u31E6-\u31EE\u321F\uA48D-\uA48F\uA4C7-\uA4CF\uA62C-\uA63F\uA6F8-\uA6FF\uA7DE-\uA7E1\uA7E3-\uA7F0\uA82D-\uA82F\uA83A-\uA83F\uA878-\uA87F\uA8C6-\uA8CD\uA8DA-\uA8DF\uA954-\uA95E\uA97D-\uA97F\uA9CE\uA9DA-\uA9DD\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A\uAA5B\uAAC3-\uAADA\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F\uAB6E\uAB6F\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFDD0-\uFDEF\uFE1A-\uFE1F\uFE53\uFE67\uFE6C-\uFE6F\uFE75\uFEFD\uFEFE\uFF00\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFDF\uFFE7\uFFEF-\uFFF8\uFFFE\uFFFF\u{1000C}\u{10027}\u{1003B}\u{1003E}\u{1004E}\u{1004F}\u{1005E}-\u{1007F}\u{100FB}-\u{100FF}\u{10103}-\u{10106}\u{10134}-\u{10136}\u{1018F}\u{1019D}-\u{1019F}\u{101A1}-\u{101CF}\u{101FE}-\u{1027F}\u{1029D}-\u{1029F}\u{102D1}-\u{102DF}\u{102FC}-\u{102FF}\u{10324}-\u{1032C}\u{1034B}-\u{1034F}\u{1037B}-\u{1037F}\u{1039E}\u{103C4}-\u{103C7}\u{103D6}-\u{103FF}\u{1049E}\u{1049F}\u{104AA}-\u{104AF}\u{104D4}-\u{104D7}\u{104FC}-\u{104FF}\u{10528}-\u{1052F}\u{10564}-\u{1056E}\u{1057B}\u{1058B}\u{10593}\u{10596}\u{105A2}\u{105B2}\u{105BA}\u{105BD}-\u{105BF}\u{105F4}-\u{105FF}\u{10737}-\u{1073F}\u{10756}-\u{1075F}\u{10768}-\u{1077F}\u{10786}\u{107B1}\u{107C0}-\u{107FF}\u{10806}\u{10807}\u{10809}\u{10836}\u{10839}-\u{1083B}\u{1083D}\u{1083E}\u{10856}\u{1089F}-\u{108A6}\u{108B0}-\u{108DF}\u{108F3}\u{108F6}-\u{108FA}\u{1091C}-\u{1091E}\u{1093A}-\u{1093E}\u{1095A}-\u{1097F}\u{109B8}-\u{109BB}\u{109D0}\u{109D1}\u{10A04}\u{10A07}-\u{10A0B}\u{10A14}\u{10A18}\u{10A36}\u{10A37}\u{10A3B}-\u{10A3E}\u{10A49}-\u{10A4F}\u{10A59}-\u{10A5F}\u{10AA0}-\u{10ABF}\u{10AE7}-\u{10AEA}\u{10AF7}-\u{10AFF}\u{10B36}-\u{10B38}\u{10B56}\u{10B57}\u{10B73}-\u{10B77}\u{10B92}-\u{10B98}\u{10B9D}-\u{10BA8}\u{10BB0}-\u{10BFF}\u{10C49}-\u{10C7F}\u{10CB3}-\u{10CBF}\u{10CF3}-\u{10CF9}\u{10D28}-\u{10D2F}\u{10D3A}-\u{10D3F}\u{10D66}-\u{10D68}\u{10D86}-\u{10D8D}\u{10D90}-\u{10E5F}\u{10E7F}\u{10EAA}\u{10EAE}\u{10EAF}\u{10EB2}-\u{10EC1}\u{10EC8}\u{10EEF}\u{10F28}-\u{10F2F}\u{10F5A}-\u{10F6F}\u{10F8A}-\u{10FAF}\u{10FCC}-\u{10FDF}\u{10FF7}-\u{10FFF}\u{1104E}-\u{11051}\u{11076}-\u{1107E}\u{110C3}-\u{110CC}\u{110CE}\u{110CF}\u{110E9}-\u{110EF}\u{110FA}-\u{110FF}\u{11135}\u{11148}-\u{1114F}\u{11177}-\u{1117F}\u{111E0}\u{111F5}-\u{111FF}\u{11212}\u{11242}-\u{1127F}\u{11287}\u{11289}\u{1128E}\u{1129E}\u{112AA}-\u{112AF}\u{112EB}-\u{112EF}\u{112FA}-\u{112FF}\u{11304}\u{1130D}\u{1130E}\u{11311}\u{11312}\u{11329}\u{11331}\u{11334}\u{1133A}\u{11345}\u{11346}\u{11349}\u{1134A}\u{1134E}\u{1134F}\u{11351}-\u{11356}\u{11358}-\u{1135C}\u{11364}\u{11365}\u{1136D}-\u{1136F}\u{11375}-\u{1137F}\u{1138A}\u{1138C}\u{1138D}\u{1138F}\u{113B6}\u{113C1}\u{113C3}\u{113C4}\u{113C6}\u{113CB}\u{113D6}\u{113D9}-\u{113E0}\u{113E3}-\u{113FF}\u{1145C}\u{11462}-\u{1147F}\u{114C8}-\u{114CF}\u{114DA}-\u{1157F}\u{115B6}\u{115B7}\u{115DE}-\u{115FF}\u{11645}-\u{1164F}\u{1165A}-\u{1165F}\u{1166D}-\u{1167F}\u{116BA}-\u{116BF}\u{116CA}-\u{116CF}\u{116E4}-\u{116FF}\u{1171B}\u{1171C}\u{1172C}-\u{1172F}\u{11747}-\u{117FF}\u{1183C}-\u{1189F}\u{118F3}-\u{118FE}\u{11907}\u{11908}\u{1190A}\u{1190B}\u{11914}\u{11917}\u{11936}\u{11939}\u{1193A}\u{11947}-\u{1194F}\u{1195A}-\u{1199F}\u{119A8}\u{119A9}\u{119D8}\u{119D9}\u{119E5}-\u{119FF}\u{11A48}-\u{11A4F}\u{11AA3}-\u{11AAF}\u{11AF9}-\u{11AFF}\u{11B0B}-\u{11B5F}\u{11B68}-\u{11BBF}\u{11BE2}-\u{11BEF}\u{11BFA}-\u{11BFF}\u{11C09}\u{11C37}\u{11C46}-\u{11C4F}\u{11C6D}-\u{11C6F}\u{11C90}\u{11C91}\u{11CA8}\u{11CB7}-\u{11CFF}\u{11D07}\u{11D0A}\u{11D37}-\u{11D39}\u{11D3B}\u{11D3E}\u{11D48}-\u{11D4F}\u{11D5A}-\u{11D5F}\u{11D66}\u{11D69}\u{11D8F}\u{11D92}\u{11D99}-\u{11D9F}\u{11DAA}-\u{11DAF}\u{11DDC}-\u{11DDF}\u{11DEA}-\u{11DEF}\u{11DF2}-\u{11EDF}\u{11EF9}-\u{11EFF}\u{11F11}\u{11F3B}-\u{11F3D}\u{11F5B}-\u{11FAF}\u{11FB1}-\u{11FBF}\u{11FF2}-\u{11FFE}\u{1239A}-\u{123FF}\u{12544}-\u{1254F}\u{12687}-\u{12F8F}\u{12FF3}-\u{12FFF}\u{13456}-\u{1345F}\u{143FB}-\u{143FF}\u{14647}-\u{160FF}\u{1613A}-\u{167FF}\u{16A39}-\u{16A3F}\u{16A5F}\u{16A6A}-\u{16A6D}\u{16ABF}\u{16ACA}-\u{16ACF}\u{16AEE}\u{16AEF}\u{16AF6}-\u{16AFF}\u{16B46}-\u{16B4F}\u{16B5A}\u{16B62}\u{16B78}-\u{16B7C}\u{16B90}-\u{16D3F}\u{16D7A}-\u{16E3F}\u{16E9B}-\u{16E9F}\u{16EB9}\u{16EBA}\u{16ED4}-\u{16EFF}\u{16F4B}-\u{16F4E}\u{16F88}-\u{16F8E}\u{16FA0}-\u{16FDF}\u{16FE5}-\u{16FEF}\u{16FF7}-\u{16FFF}\u{18CDB}-\u{18CFE}\u{18D21}-\u{18D7F}\u{18DF3}-\u{18DFF}\u{19192}-\u{1919F}\u{191D3}-\u{1AFEF}\u{1AFF4}\u{1AFFC}\u{1AFFF}\u{1B129}-\u{1B131}\u{1B133}-\u{1B14F}\u{1B153}\u{1B154}\u{1B156}-\u{1B163}\u{1B169}-\u{1B16F}\u{1B2FC}-\u{1BBFF}\u{1BC6B}-\u{1BC6F}\u{1BC7D}-\u{1BC7F}\u{1BC89}-\u{1BC8F}\u{1BC9A}\u{1BC9B}\u{1BCA4}-\u{1CBFF}\u{1CCFD}-\u{1CCFF}\u{1CEB4}-\u{1CEB9}\u{1CED1}\u{1CED5}-\u{1CEDC}\u{1CEFE}\u{1CEFF}\u{1CF2E}\u{1CF2F}\u{1CF47}-\u{1CF4F}\u{1CFC4}-\u{1CFFF}\u{1D0F6}-\u{1D0FF}\u{1D246}-\u{1D24F}\u{1D282}-\u{1D2BF}\u{1D2D4}-\u{1D2DF}\u{1D2F4}-\u{1D2FF}\u{1D357}-\u{1D35F}\u{1D379}-\u{1D3FF}\u{1D455}\u{1D49D}\u{1D4A0}\u{1D4A1}\u{1D4A3}\u{1D4A4}\u{1D4A7}\u{1D4A8}\u{1D4AD}\u{1D4BA}\u{1D4BC}\u{1D4C4}\u{1D506}\u{1D50B}\u{1D50C}\u{1D515}\u{1D51D}\u{1D53A}\u{1D53F}\u{1D545}\u{1D547}-\u{1D549}\u{1D551}\u{1D6A7}\u{1D7CC}\u{1D7CD}\u{1DA8C}-\u{1DA9A}\u{1DAA0}\u{1DAB0}-\u{1DAFF}\u{1DB1D}-\u{1DEFF}\u{1DF82}-\u{1DF8F}\u{1DF97}-\u{1DFCC}\u{1E007}\u{1E019}\u{1E01A}\u{1E022}\u{1E025}\u{1E02B}-\u{1E02F}\u{1E06E}-\u{1E08E}\u{1E090}-\u{1E0FF}\u{1E12D}-\u{1E12F}\u{1E13E}\u{1E13F}\u{1E14A}-\u{1E14D}\u{1E150}-\u{1E28F}\u{1E2AF}-\u{1E2BF}\u{1E2FA}-\u{1E2FE}\u{1E300}-\u{1E4CF}\u{1E4FA}-\u{1E5CF}\u{1E5FB}-\u{1E5FE}\u{1E600}-\u{1E6BF}\u{1E6DF}\u{1E6F6}-\u{1E6FD}\u{1E700}-\u{1E7DF}\u{1E7E7}\u{1E7EC}\u{1E7EF}\u{1E7FF}\u{1E8C5}\u{1E8C6}\u{1E8D7}-\u{1E8FF}\u{1E94C}-\u{1E94F}\u{1E95A}-\u{1E95D}\u{1E960}-\u{1EC70}\u{1ECB5}-\u{1ED00}\u{1ED3E}-\u{1EDFF}\u{1EE04}\u{1EE20}\u{1EE23}\u{1EE25}\u{1EE26}\u{1EE28}\u{1EE33}\u{1EE38}\u{1EE3A}\u{1EE3C}-\u{1EE41}\u{1EE43}-\u{1EE46}\u{1EE48}\u{1EE4A}\u{1EE4C}\u{1EE50}\u{1EE53}\u{1EE55}\u{1EE56}\u{1EE58}\u{1EE5A}\u{1EE5C}\u{1EE5E}\u{1EE60}\u{1EE63}\u{1EE65}\u{1EE66}\u{1EE6B}\u{1EE73}\u{1EE78}\u{1EE7D}\u{1EE7F}\u{1EE8A}\u{1EE9C}-\u{1EEA0}\u{1EEA4}\u{1EEAA}\u{1EEBC}-\u{1EEEF}\u{1EEF2}-\u{1EFFF}\u{1F02C}-\u{1F02F}\u{1F094}-\u{1F09F}\u{1F0AF}\u{1F0B0}\u{1F0C0}\u{1F0D0}\u{1F0F6}-\u{1F0FF}\u{1F1AF}-\u{1F1E5}\u{1F203}-\u{1F20F}\u{1F23C}-\u{1F23F}\u{1F249}-\u{1F24F}\u{1F252}-\u{1F25F}\u{1F266}-\u{1F2FF}\u{1F6DA}\u{1F6DB}\u{1F6ED}-\u{1F6EF}\u{1F6FD}-\u{1F6FF}\u{1F7DC}-\u{1F7DF}\u{1F7EC}-\u{1F7EF}\u{1F80C}-\u{1F80F}\u{1F848}-\u{1F84F}\u{1F85A}-\u{1F85F}\u{1F888}-\u{1F88F}\u{1F8AE}\u{1F8AF}\u{1F8BC}-\u{1F8BF}\u{1F8C2}-\u{1F8CF}\u{1F8D9}-\u{1F8FF}\u{1FA58}-\u{1FA5F}\u{1FA6E}\u{1FA6F}\u{1FA7D}-\u{1FA7F}\u{1FAC7}\u{1FAC9}-\u{1FACB}\u{1FADE}\u{1FAEC}-\u{1FAEE}\u{1FAFB}-\u{1FAFF}\u{1FB93}\u{1FBFB}-\u{1FFFF}\u{2A6E0}-\u{2A6FF}\u{2B81F}\u{2CEAE}\u{2CEAF}\u{2EBE1}-\u{2EBEF}\u{2EE5E}-\u{2F7FF}\u{2FA1E}-\u{2FFFF}\u{3134B}-\u{3134F}\u{3347A}-\u{3CFFF}\u{3FC40}-\u{E0000}\u{E0002}-\u{E001F}\u{E0080}-\u{E00FF}\u{E01F0}-\u{10FFFF}]/u.test(e) && !hasCodePointInRanges(whatwg_url_minimum_n, A) || hasCodePointInBitmap(whatwg_url_minimum_s, A)) {
                        return !0;
                    }
                }
                return !1;
            }(A)) {
                return null;
            }
            const i = (A = (function mapIDNADomain(A) {
                let e = "";
                for (const t of A){
                    const A = t.codePointAt(0);
                    if (8204 !== A && 8205 !== A && /[\xAD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFF8\u{1BCA0}-\u{1BCA3}\u{1D173}-\u{1D17A}\u{E0000}-\u{E0FFF}]/u.test(t)) {
                        continue;
                    }
                    const n = mapIDNACodePoint(t, A);
                    if (n) {
                        e += n;
                        continue;
                    }
                    const i = whatwg_url_minimum_r.indexOf(A);
                    e += i < 0 ? t : whatwg_url_minimum_o[i];
                }
                return e;
            })(A).normalize("NFKC").replace(/[\u3002\uff0e\uff61]/g, ".").toLowerCase()).split(".");
            for(let A = 0; A < i.length; A++){
                const e = i[A];
                if ("" === e) {
                    continue;
                }
                const t = /[^\0-\x7f]/.test(e);
                if (containsInvalidDomainCodePoint(e) || t && (/^[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7-\u05C9\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0897-\u089F\u08CA-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B53-\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3C\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CF3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1715\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u180F\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1AF0\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\u{101FD}\u{102E0}\u{10376}-\u{1037A}\u{10A01}-\u{10A03}\u{10A05}\u{10A06}\u{10A0C}-\u{10A0F}\u{10A38}-\u{10A3A}\u{10A3F}\u{10AE5}\u{10AE6}\u{10D24}-\u{10D27}\u{10D69}-\u{10D6D}\u{10EAB}\u{10EAC}\u{10ECB}-\u{10ECF}\u{10EF0}-\u{10EFF}\u{10F46}-\u{10F50}\u{10F82}-\u{10F85}\u{11000}-\u{11002}\u{11038}-\u{11046}\u{11070}\u{11073}\u{11074}\u{1107F}-\u{11082}\u{110B0}-\u{110BA}\u{110C2}\u{11100}-\u{11102}\u{11127}-\u{11134}\u{11145}\u{11146}\u{11173}\u{11180}-\u{11182}\u{111B3}-\u{111C0}\u{111C9}-\u{111CC}\u{111CE}\u{111CF}\u{1122C}-\u{11237}\u{1123E}\u{11241}\u{112DF}-\u{112EA}\u{11300}-\u{11303}\u{1133B}\u{1133C}\u{1133E}-\u{11344}\u{11347}\u{11348}\u{1134B}-\u{1134D}\u{11357}\u{11362}\u{11363}\u{11366}-\u{1136C}\u{11370}-\u{11374}\u{113B8}-\u{113C0}\u{113C2}\u{113C5}\u{113C7}-\u{113CA}\u{113CC}-\u{113D0}\u{113D2}\u{113E1}\u{113E2}\u{11435}-\u{11446}\u{1145E}\u{114B0}-\u{114C3}\u{115AF}-\u{115B5}\u{115B8}-\u{115C0}\u{115DC}\u{115DD}\u{11630}-\u{11640}\u{116AB}-\u{116B7}\u{1171D}-\u{1172B}\u{1182C}-\u{1183A}\u{11930}-\u{11935}\u{11937}\u{11938}\u{1193B}-\u{1193E}\u{11940}\u{11942}\u{11943}\u{119D1}-\u{119D7}\u{119DA}-\u{119E0}\u{119E4}\u{11A01}-\u{11A0A}\u{11A33}-\u{11A39}\u{11A3B}-\u{11A3E}\u{11A47}\u{11A51}-\u{11A5B}\u{11A8A}-\u{11A99}\u{11B60}-\u{11B67}\u{11C2F}-\u{11C36}\u{11C38}-\u{11C3F}\u{11C92}-\u{11CA7}\u{11CA9}-\u{11CB6}\u{11D31}-\u{11D36}\u{11D3A}\u{11D3C}\u{11D3D}\u{11D3F}-\u{11D45}\u{11D47}\u{11D8A}-\u{11D8E}\u{11D90}\u{11D91}\u{11D93}-\u{11D97}\u{11DF0}\u{11EF3}-\u{11EF6}\u{11F00}\u{11F01}\u{11F03}\u{11F34}-\u{11F3A}\u{11F3E}-\u{11F42}\u{11F5A}\u{13440}\u{13447}-\u{13455}\u{1611E}-\u{1612F}\u{16AF0}-\u{16AF4}\u{16B30}-\u{16B36}\u{16F4F}\u{16F51}-\u{16F87}\u{16F8F}-\u{16F92}\u{16FE4}\u{16FF0}\u{16FF1}\u{1BC9D}\u{1BC9E}\u{1CF00}-\u{1CF2D}\u{1CF30}-\u{1CF46}\u{1D127}\u{1D128}\u{1D165}-\u{1D169}\u{1D16D}-\u{1D172}\u{1D17B}-\u{1D182}\u{1D185}-\u{1D18B}\u{1D1AA}-\u{1D1AD}\u{1D242}-\u{1D244}\u{1D250}-\u{1D252}\u{1D25B}\u{1D25C}\u{1D25F}\u{1D280}\u{1D281}\u{1DA00}-\u{1DA36}\u{1DA3B}-\u{1DA6C}\u{1DA75}\u{1DA84}\u{1DA9B}-\u{1DA9F}\u{1DAA1}-\u{1DAAF}\u{1E000}-\u{1E006}\u{1E008}-\u{1E018}\u{1E01B}-\u{1E021}\u{1E023}\u{1E024}\u{1E026}-\u{1E02A}\u{1E08F}\u{1E130}-\u{1E136}\u{1E2AE}\u{1E2EC}-\u{1E2EF}\u{1E4EC}-\u{1E4EF}\u{1E5EE}\u{1E5EF}\u{1E6E3}\u{1E6E6}\u{1E6EE}\u{1E6EF}\u{1E6F5}\u{1E8D0}-\u{1E8D6}\u{1E944}-\u{1E94A}\u{E0100}-\u{E01EF}]/u.test(e) || !hasValidJoiners(e) || !hasValidBidi(e) || e.startsWith("xn--"))) {
                    return null;
                }
                if (t) {
                    i[A] = `xn--${encodePunycode(e)}`;
                }
            }
            return "" !== (A = i.join(".")) ? A : null;
        }(-1 === A.indexOf("%") ? A : percentDecodeString(A));
        if (null === e || containsForbiddenHostCodePoint(e)) {
            return null;
        } else if (function isIPv4(A) {
            let e = A.length;
            let t = A.lastIndexOf(".", e - 2) + 1;
            if (46 === A.charCodeAt(e - 1)) {
                e--;
            }
            if (e <= t) {
                return !1;
            }
            if (parseIPv4Number(A.slice(t, e)) >= 0) {
                return !0;
            }
            for(; t < e; t++){
                const e = A.charCodeAt(t);
                if (e < 48 || e > 57) {
                    return !1;
                }
            }
            return !0;
        }(e)) {
            return function parseIPv4(A) {
                const e = A.split(".");
                let t = e.length;
                if (!e[t - 1]) {
                    t--;
                }
                if (t > 4) {
                    return null;
                }
                let n = 0;
                for(let A = 0; A < t - 1; A++){
                    const t = parseIPv4Number(e[A]);
                    if (t < 0 || t > 255) {
                        return null;
                    }
                    n += t * (1 << 8 * (3 - A));
                }
                const r = parseIPv4Number(e[t - 1]);
                if (r < 0 || r >= 256 ** (5 - t)) {
                    return null;
                }
                n += r;
                return n;
            }(e);
        } else {
            return e;
        }
    }
}
function serializeHost(A) {
    if ("number" == typeof A) {
        return function serializeIPv4(A) {
            const e = 255;
            let t = "";
            t += `${(A >>> 24 & e).toString(10)}.`;
            t += `${(A >>> 16 & e).toString(10)}.`;
            t += `${(A >>> 8 & e).toString(10)}.`;
            t += (A & e).toString(10);
            return t;
        }(A);
    } else if (Array.isArray(A)) {
        return `[${function serializeIPv6(A) {
            const e = function findTheIPv6AddressCompressedPieceIndex(A) {
                let e = -1;
                let t = -1;
                let n = 1;
                let r = 0;
                for(let o = 0; o < A.length; ++o){
                    if (0 !== A[o]) {
                        if (r > n) {
                            e = t;
                            n = r;
                        }
                        t = -1;
                        r = 0;
                    } else {
                        if (-1 === t) {
                            t = o;
                        }
                        ++r;
                    }
                }
                return r > n ? t : e;
            }(A);
            let t = "";
            let n = !1;
            for(let r = 0; r <= 7; ++r){
                if (n && 0 === A[r]) {
                    continue;
                } else if (n) {
                    n = !1;
                }
                if (e === r) {
                    t += 0 === r ? "::" : ":";
                    n = !0;
                    continue;
                }
                t += A[r].toString(16);
                if (7 !== r) {
                    t += ":";
                }
            }
            return t;
        }(A)}]`;
    } else {
        return A;
    }
}
function shortenPath(A) {
    if (A.path.length > 0 && (1 !== A.path.length || "file" !== A.scheme || !function isNormalizedWindowsDriveLetter(A) {
        return /^[A-Za-z]:$/u.test(A);
    }(A.path[0]))) {
        A.path.pop();
    }
}
function includesCredentials(A) {
    return "" !== A.username || "" !== A.password;
}
function cannotHaveAUsernamePasswordPort(A) {
    return null === A.host || "" === A.host || "file" === A.scheme;
}
let U = 0;
let D = "";
let y = "";
let C = null;
let E;
let b = !1;
let I = !1;
let L = !1;
let v;
function parseURL(A, e, t, n) {
    if (!e) {
        A = function trimControlChars(A) {
            let e = 0;
            let t = A.length;
            for(; e < t; ++e){
                if (A.charCodeAt(e) > 32) {
                    break;
                }
            }
            for(; t > e; --t){
                if (A.charCodeAt(t - 1) > 32) {
                    break;
                }
            }
            return A.substring(e, t);
        }(A);
    }
    A = function trimTabAndNewline(A) {
        let e = 0;
        for(; e < A.length; e++){
            const t = A.charCodeAt(e);
            if (9 === t || 10 === t || 13 === t) {
                break;
            }
        }
        if (e === A.length) {
            return A;
        }
        let t = A.slice(0, e);
        for(; e < A.length; e++){
            const n = A.charCodeAt(e);
            if (9 !== n && 10 !== n && 13 !== n) {
                t += A[e];
            }
        }
        return t;
    }(A);
    U = 0;
    D = A;
    y = "";
    C = t || null;
    E = e || {
        scheme: "",
        username: "",
        password: "",
        host: null,
        port: null,
        path: [],
        query: null,
        fragment: null,
        opaquePath: !1
    };
    b = !1;
    I = !1;
    L = !1;
    v = n || 0;
    let r = parseSchemeStart;
    switch(n){
        case 3:
        case 4:
            r = parseHostname;
            break;
        case 5:
            r = parsePort;
            break;
        case 6:
            r = parsePathStart;
            break;
        case 7:
            r = parseQuery;
            break;
        case 8:
            r = parseFragment;
    }
    return 1 !== r(codePointAt(A, U)) ? E : null;
}
function continueParse(A, e) {
    U += U === A ? codePointSize(e) : 1;
    return U <= D.length;
}
function codePointAt(A, e) {
    return e < A.length ? A.codePointAt(e) : void 0;
}
function codePointSize(A) {
    return null != A && A > 65535 ? 2 : 1;
}
function codePointToString(A) {
    if (null == A) {
        return "";
    }
    return A <= 65535 ? String.fromCharCode(A) : String.fromCodePoint(A);
}
const parseSchemeStart = (A)=>{
    const e = U;
    if (null != A && (A >= 65 && A <= 90 || A >= 97 && A <= 122)) {
        let e = U + 1;
        A = D.charCodeAt(e);
        while(43 === A || 45 === A || 46 === A || A >= 65 && A <= 90 || A >= 97 && A <= 122 || A >= 48 && A <= 57){
            e++;
            A = D.charCodeAt(e);
        }
        y = D.slice(U, e).toLowerCase();
        U = e;
        return parseScheme(e < D.length ? A : void 0);
    } else if (!v) {
        --U;
        return continueParse(e, A) ? parseNoScheme(codePointAt(D, U)) : 0;
    } else {
        return 1;
    }
};
const parseScheme = (A)=>{
    const e = U;
    if (58 === A) {
        if (v) {
            if (isSpecial(E.scheme) !== isSpecial(y)) {
                return 0;
            } else if ((includesCredentials(E) || null !== E.port) && "file" === y) {
                return 0;
            } else if ("file" === E.scheme && "" === E.host) {
                return 0;
            }
        }
        E.scheme = y;
        if (v) {
            if (E.port === defaultPort(E.scheme)) {
                E.port = null;
            }
            return 0;
        }
        y = "";
        if ("file" === E.scheme) {
            return continueParse(e, A) ? parseFile(codePointAt(D, U)) : 0;
        } else if (isSpecial(E.scheme) && null !== C && C.scheme === E.scheme) {
            return continueParse(e, A) ? parseSpecialRelativeOrAuthority(codePointAt(D, U)) : 0;
        } else if (isSpecial(E.scheme)) {
            return continueParse(e, A) ? parseSpecialAuthoritySlashes(codePointAt(D, U)) : 0;
        } else if (47 === codePointAt(D, U + 1)) {
            U++;
            return continueParse(e, A) ? parsePathOrAuthority(codePointAt(D, U)) : 0;
        } else {
            E.path = [
                ""
            ];
            E.opaquePath = !0;
            return continueParse(e, A) ? parseOpaquePath(codePointAt(D, U)) : 0;
        }
    } else if (!v) {
        y = "";
        U = -1;
        return continueParse(e, A) ? parseNoScheme(codePointAt(D, U)) : 0;
    } else {
        return 1;
    }
};
const parseNoScheme = (A)=>{
    const e = U;
    if (null === C || C.opaquePath && 35 !== A) {
        return 1;
    } else if (C.opaquePath && 35 === A) {
        E.scheme = C.scheme;
        E.path = C.path.slice();
        E.opaquePath = C.opaquePath;
        E.query = C.query;
        E.fragment = "";
        return continueParse(e, A) ? parseFragment(codePointAt(D, U)) : 0;
    } else if ("file" === C.scheme) {
        U--;
        return continueParse(e, A) ? parseFile(codePointAt(D, U)) : 0;
    } else {
        U--;
        return continueParse(e, A) ? parseRelative(codePointAt(D, U)) : 0;
    }
};
const parseSpecialRelativeOrAuthority = (A)=>{
    const e = U;
    if (47 === A && 47 === codePointAt(D, U + 1)) {
        ++U;
        return continueParse(e, A) ? parseSpecialAuthorityIgnoreSlashes(codePointAt(D, U)) : 0;
    } else {
        U--;
        return continueParse(e, A) ? parseRelative(codePointAt(D, U)) : 0;
    }
};
const parsePathOrAuthority = (A)=>{
    const e = U;
    if (47 === A) {
        return continueParse(e, A) ? parseAuthority(codePointAt(D, U)) : 0;
    } else {
        U--;
        return continueParse(e, A) ? parsePath(codePointAt(D, U)) : 0;
    }
};
const parseRelative = (A)=>{
    const e = U;
    E.scheme = C.scheme;
    if (47 === A) {
        return continueParse(e, A) ? parseRelativeSlash(codePointAt(D, U)) : 0;
    } else if (isSpecial(E.scheme) && 92 === A) {
        return continueParse(e, A) ? parseRelativeSlash(codePointAt(D, U)) : 0;
    } else {
        E.username = C.username;
        E.password = C.password;
        E.host = C.host;
        E.port = C.port;
        E.path = C.path.slice();
        E.query = C.query;
        if (63 === A) {
            E.query = "";
            return continueParse(e, A) ? parseQuery(codePointAt(D, U)) : 0;
        } else if (35 === A) {
            E.fragment = "";
            return continueParse(e, A) ? parseFragment(codePointAt(D, U)) : 0;
        } else if (null != A) {
            E.query = null;
            E.path.pop();
            U--;
            return continueParse(e, A) ? parsePath(codePointAt(D, U)) : 0;
        } else {
            return continueParse(e, A) ? parseRelative(codePointAt(D, U)) : 0;
        }
    }
};
const parseRelativeSlash = (A)=>{
    const e = U;
    if (isSpecial(E.scheme) && (47 === A || 92 === A)) {
        return continueParse(e, A) ? parseSpecialAuthorityIgnoreSlashes(codePointAt(D, U)) : 0;
    } else if (47 === A) {
        return continueParse(e, A) ? parseAuthority(codePointAt(D, U)) : 0;
    } else {
        E.username = C.username;
        E.password = C.password;
        E.host = C.host;
        E.port = C.port;
        U--;
        return continueParse(e, A) ? parsePath(codePointAt(D, U)) : 0;
    }
};
const parseSpecialAuthoritySlashes = (A)=>{
    const e = U;
    if (47 === A && 47 === codePointAt(D, U + 1)) {
        U++;
    } else {
        U--;
    }
    return continueParse(e, A) ? parseSpecialAuthorityIgnoreSlashes(codePointAt(D, U)) : 0;
};
const parseSpecialAuthorityIgnoreSlashes = (A)=>{
    const e = U;
    if (47 !== A && 92 !== A) {
        U--;
        return continueParse(e, A) ? parseAuthority(codePointAt(D, U)) : 0;
    } else {
        return continueParse(e, A) ? parseSpecialAuthorityIgnoreSlashes(codePointAt(D, U)) : 0;
    }
};
const parseAuthority = (A)=>{
    const e = U;
    if (null != A && 64 !== A && 35 !== A && 47 !== A && 63 !== A && (92 !== A || !isSpecial(E.scheme))) {
        let t = U + codePointSize(A);
        while(t < D.length){
            const A = codePointAt(D, t);
            if (null == A || 64 === A || 35 === A || 47 === A || 63 === A || 92 === A && isSpecial(E.scheme)) {
                break;
            }
            t += codePointSize(A);
        }
        y += D.slice(U, t);
        U = t - 1;
        return continueParse(e, A) ? parseAuthority(codePointAt(D, U)) : 0;
    }
    if (64 === A) {
        if (b) {
            y = `%40${y}`;
        }
        b = !0;
        for(let A = 0; A < y.length; A++){
            const e = y.codePointAt(A);
            if (58 === e && !I) {
                I = !0;
                continue;
            }
            const t = utf8PercentEncodeCodePoint(e, isUserinfoPercentEncode);
            if (I) {
                E.password += t;
            } else {
                E.username += t;
            }
            if (null != e && e > 65535) {
                A++;
            }
        }
        y = "";
        return continueParse(e, A) ? parseAuthority(codePointAt(D, U)) : 0;
    } else if (null == A || 35 === A || 47 === A || 63 === A || 92 === A && isSpecial(E.scheme)) {
        if (b && "" === y) {
            return 1;
        }
        U -= y.length + 1;
        y = "";
        return continueParse(e, A) ? parseHostname(codePointAt(D, U)) : 0;
    } else {
        y += codePointToString(A);
        return continueParse(e, A) ? parseAuthority(codePointAt(D, U)) : 0;
    }
};
const parseHostname = (A)=>{
    const e = U;
    if (v && "file" === E.scheme) {
        U--;
        return continueParse(e, A) ? parseFileHost(codePointAt(D, U)) : 0;
    } else if (null != A && 58 !== A && 35 !== A && 47 !== A && 63 !== A && (92 !== A || !isSpecial(E.scheme))) {
        let t = U + codePointSize(A);
        if (91 === A) {
            L = !0;
        } else if (93 === A) {
            L = !1;
        }
        while(t < D.length){
            const A = codePointAt(D, t);
            if (null == A || !L && 58 === A || 35 === A || 47 === A || 63 === A || 92 === A && isSpecial(E.scheme)) {
                break;
            }
            if (91 === A) {
                L = !0;
            } else if (93 === A) {
                L = !1;
            }
            t += codePointSize(A);
        }
        y += D.slice(U, t);
        U = t - 1;
        return continueParse(e, A) ? parseHostname(codePointAt(D, U)) : 0;
    } else if (58 === A && !L) {
        if ("" === y) {
            return 1;
        }
        if (4 === v) {
            return 1;
        }
        const t = parseHost(y, !isSpecial(E.scheme));
        if (null === t) {
            return 1;
        }
        E.host = serializeHost(t);
        y = "";
        return continueParse(e, A) ? parsePort(codePointAt(D, U)) : 0;
    } else if (null == A || 35 === A || 47 === A || 63 === A || 92 === A && isSpecial(E.scheme)) {
        U--;
        if (isSpecial(E.scheme) && "" === y) {
            return 1;
        } else if (v && "" === y && (includesCredentials(E) || null !== E.port)) {
            return 1;
        }
        const t = parseHost(y, !isSpecial(E.scheme));
        if (null === t) {
            return 1;
        }
        E.host = serializeHost(t);
        y = "";
        return v ? 0 : continueParse(e, A) ? parsePathStart(codePointAt(D, U)) : 0;
    } else {
        y += codePointToString(A);
        return continueParse(e, A) ? parseHostname(codePointAt(D, U)) : 0;
    }
};
const parsePort = (A)=>{
    const e = U;
    if (null != A && A >= 48 && A <= 57) {
        let t = U + 1;
        while(t < D.length){
            const A = D.charCodeAt(t);
            if (A < 48 || A > 57) {
                break;
            }
            t++;
        }
        y += D.slice(U, t);
        U = t - 1;
        return continueParse(e, A) ? parsePort(codePointAt(D, U)) : 0;
    } else if (v || null == A || 35 === A || 47 === A || 63 === A || 92 === A && isSpecial(E.scheme)) {
        if ("" !== y) {
            const A = parseInt(y, 10);
            if (A > 65535) {
                return 1;
            }
            E.port = A === defaultPort(E.scheme) ? null : A;
            y = "";
            if (v) {
                return 0;
            }
        }
        if (v) {
            return 1;
        } else {
            U--;
            return continueParse(e, A) ? parsePathStart(codePointAt(D, U)) : 0;
        }
    } else {
        return 1;
    }
};
function startsWithWindowsDriveLetter(A, e) {
    const t = A.length - e;
    if (t < 2) {
        return !1;
    }
    if (!isWindowsDriveLetterCodePoints(codePointAt(A, e), codePointAt(A, e + 1))) {
        return !1;
    } else if (2 === t) {
        return !0;
    } else {
        const t = codePointAt(A, e + 2);
        return 47 === t || 92 === t || 63 === t || 35 === t;
    }
}
const parseFile = (A)=>{
    const e = U;
    E.scheme = "file";
    E.host = "";
    if (47 === A || 92 === A) {
        return continueParse(e, A) ? parseFileSlash(codePointAt(D, U)) : 0;
    } else if ("file" === (C === null || C === void 0 ? void 0 : C.scheme)) {
        E.host = C.host;
        E.path = C.path.slice();
        E.opaquePath = C.opaquePath;
        E.query = C.query;
        if (63 === A) {
            E.query = "";
            return continueParse(e, A) ? parseQuery(codePointAt(D, U)) : 0;
        } else if (35 === A) {
            E.fragment = "";
            return continueParse(e, A) ? parseFragment(codePointAt(D, U)) : 0;
        } else if (null != A) {
            E.query = null;
            if (!startsWithWindowsDriveLetter(D, U)) {
                shortenPath(E);
            } else {
                E.path = [];
            }
            U--;
            return continueParse(e, A) ? parsePath(codePointAt(D, U)) : 0;
        } else {
            return continueParse(e, A) ? parseFile(codePointAt(D, U)) : 0;
        }
    } else {
        U--;
        return continueParse(e, A) ? parsePath(codePointAt(D, U)) : 0;
    }
};
const parseFileSlash = (A)=>{
    const e = U;
    if (47 === A || 92 === A) {
        return continueParse(e, A) ? parseFileHost(codePointAt(D, U)) : 0;
    } else {
        if (null !== C && "file" === C.scheme) {
            if (!startsWithWindowsDriveLetter(D, U) && function isNormalizedWindowsDriveLetterString(A) {
                if (2 === A.length) {
                    const e = A.codePointAt(0);
                    const t = A.codePointAt(1);
                    return (e >= 65 && e <= 90 || e >= 97 && e <= 122) && 58 === t;
                } else {
                    return !1;
                }
            }(C.path[0])) {
                E.path.push(C.path[0]);
            }
            E.host = C.host;
        }
        U--;
        return continueParse(e, A) ? parsePath(codePointAt(D, U)) : 0;
    }
};
const parseFileHost = (A)=>{
    const e = U;
    if (null != A && 47 !== A && 92 !== A && 63 !== A && 35 !== A) {
        let t = U + codePointSize(A);
        while(t < D.length){
            const A = codePointAt(D, t);
            if (null == A || 47 === A || 92 === A || 63 === A || 35 === A) {
                break;
            }
            t += codePointSize(A);
        }
        y += D.slice(U, t);
        U = t - 1;
        return continueParse(e, A) ? parseFileHost(codePointAt(D, U)) : 0;
    } else if (null == A || 47 === A || 92 === A || 63 === A || 35 === A) {
        U--;
        if (!v && isWindowsDriveLetterString(y)) {
            return continueParse(e, A) ? parsePath(codePointAt(D, U)) : 0;
        } else if ("" === y) {
            E.host = "";
            return v ? 0 : continueParse(e, A) ? parsePathStart(codePointAt(D, U)) : 0;
        } else {
            let t = parseHost(y, !isSpecial(E.scheme));
            if (null === t) {
                return 1;
            }
            if ("localhost" === t) {
                t = "";
            }
            E.host = serializeHost(t);
            y = "";
            return v ? 0 : continueParse(e, A) ? parsePathStart(codePointAt(D, U)) : 0;
        }
    }
    return 1;
};
const parsePathStart = (A)=>{
    const e = U;
    if (isSpecial(E.scheme)) {
        if (92 !== A && 47 !== A) {
            U--;
        }
        return continueParse(e, A) ? parsePath(codePointAt(D, U)) : 0;
    } else if (!v && 63 === A) {
        E.query = "";
        return continueParse(e, A) ? parseQuery(codePointAt(D, U)) : 0;
    } else if (!v && 35 === A) {
        E.fragment = "";
        return continueParse(e, A) ? parseFragment(codePointAt(D, U)) : 0;
    } else if (null != A) {
        if (47 !== A) {
            U--;
        }
        return continueParse(e, A) ? parsePath(codePointAt(D, U)) : 0;
    } else if (v && null === E.host) {
        E.path.push("");
        return continueParse(e, A) ? parsePathStart(codePointAt(D, U)) : 0;
    } else {
        return continueParse(e, A) ? parsePathStart(codePointAt(D, U)) : 0;
    }
};
const parsePath = (A)=>{
    const e = U;
    if (null != A && 47 !== A && (!isSpecial(E.scheme) || 92 !== A) && (v || 63 !== A && 35 !== A)) {
        let e = U + codePointSize(A);
        while(e < D.length){
            const A = codePointAt(D, e);
            if (null == A || 47 === A || isSpecial(E.scheme) && 92 === A || !v && (63 === A || 35 === A)) {
                break;
            }
            e += codePointSize(A);
        }
        y += utf8PercentEncodeString(D.slice(U, e), isPathPercentEncode);
        U = e;
        A = codePointAt(D, e);
    }
    if (null == A || 47 === A || isSpecial(E.scheme) && 92 === A || !v && (63 === A || 35 === A)) {
        const t = isSpecial(E.scheme) && 92 === A;
        if (function isDoubleDot(A) {
            switch(A){
                case "..":
                case "%2e.":
                case "%2E.":
                case ".%2e":
                case ".%2E":
                case "%2e%2e":
                case "%2E%2e":
                case "%2e%2E":
                case "%2E%2E":
                    return !0;
                default:
                    return !1;
            }
        }(y)) {
            shortenPath(E);
            if (47 !== A && !t) {
                E.path.push("");
            }
        } else if (isSingleDot(y) && 47 !== A && !t) {
            E.path.push("");
        } else if (!isSingleDot(y)) {
            if ("file" === E.scheme && 0 === E.path.length && isWindowsDriveLetterString(y)) {
                y = `${y[0]}:`;
            }
            E.path.push(y);
        }
        y = "";
        if (63 === A) {
            E.query = "";
            return continueParse(e, A) ? parseQuery(codePointAt(D, U)) : 0;
        } else if (35 === A) {
            E.fragment = "";
            return continueParse(e, A) ? parseFragment(codePointAt(D, U)) : 0;
        } else {
            return continueParse(e, A) ? parsePath(codePointAt(D, U)) : 0;
        }
    } else {
        y += utf8PercentEncodeCodePoint(A, isPathPercentEncode);
        return continueParse(e, A) ? parsePath(codePointAt(D, U)) : 0;
    }
};
const parseOpaquePath = (A)=>{
    const e = U;
    if (63 === A) {
        E.query = "";
        return continueParse(e, A) ? parseQuery(codePointAt(D, U)) : 0;
    } else if (35 === A) {
        E.fragment = "";
        return continueParse(e, A) ? parseFragment(codePointAt(D, U)) : 0;
    } else {
        if (null != A) {
            let t = U + codePointSize(A);
            while(t < D.length){
                const A = codePointAt(D, t);
                if (63 === A || 35 === A) {
                    break;
                }
                t += codePointSize(A);
            }
            const n = D.slice(U, t);
            if (t < D.length && 32 === n.charCodeAt(n.length - 1)) {
                E.path[0] += utf8PercentEncodeString(n.slice(0, -1), isC0ControlPercentEncode) + "%20";
            } else {
                E.path[0] += utf8PercentEncodeString(n, isC0ControlPercentEncode);
            }
            U = t;
            if (63 === (A = codePointAt(D, t))) {
                E.query = "";
                return continueParse(e, A) ? parseQuery(codePointAt(D, U)) : 0;
            } else if (35 === A) {
                E.fragment = "";
                return continueParse(e, A) ? parseFragment(codePointAt(D, U)) : 0;
            }
        }
        return continueParse(e, A) ? parseOpaquePath(codePointAt(D, U)) : 0;
    }
};
const parseQuery = (A)=>{
    const e = U;
    let t = U;
    if (null != A) {
        if (!v) {
            const A = D.indexOf("#", U);
            t = -1 === A ? D.length : A;
        } else {
            t = D.length;
        }
        const A = isSpecial(E.scheme) ? isSpecialQueryPercentEncode : isQueryPercentEncode;
        E.query += utf8PercentEncodeString(D.slice(U, t), A);
    }
    U = t;
    if (35 === codePointAt(D, t) && !v) {
        E.fragment = "";
        return continueParse(e, A) ? parseFragment(codePointAt(D, U)) : 0;
    }
    return continueParse(e, A) ? parseQuery(codePointAt(D, U)) : 0;
};
const parseFragment = (A)=>{
    const e = U;
    if (null != A) {
        E.fragment += utf8PercentEncodeString(D.slice(U), isFragmentPercentEncode);
        U = D.length;
    }
    return continueParse(e, A) ? parseFragment(codePointAt(D, U)) : 0;
};
function serializePath(A) {
    if (A.opaquePath) {
        return A.path[0];
    } else {
        let e = "";
        for (const t of A.path){
            e += `/${t}`;
        }
        return e;
    }
}
function serializeURLOrigin(A) {
    switch(A.scheme){
        case "blob":
            {
                const e = parseURL(serializePath(A), null, null, 0);
                if (null === e) {
                    return "null";
                } else if ("http" !== e.scheme && "https" !== e.scheme) {
                    return "null";
                } else {
                    return serializeURLOrigin(e);
                }
            }
        case "ftp":
        case "http":
        case "https":
        case "ws":
        case "wss":
            return function serializeOrigin(A) {
                let e = `${A.scheme}://`;
                e += A.host;
                if (null !== A.port) {
                    e += `:${A.port}`;
                }
                return e;
            }(A);
        default:
            return "null";
    }
}
const R = Symbol("URLImpl");
class URL {
    static createObjectURL(A) {
        throw new TypeError("URL.createObjetURL is unsupported");
    }
    static revokeObjectURL(A) {}
    static parse(A, e) {
        A = toUSVString(A);
        if (void 0 !== e) {
            e = toUSVString(e);
        }
        try {
            return new URL(A, e);
        } catch  {
            return null;
        }
    }
    static canParse(A, e) {
        A = toUSVString(A);
        if (void 0 !== e) {
            e = toUSVString(e);
        }
        let t = null;
        if (null != e) {
            t = parseURL(e, null, null, 0);
            if (null == t) {
                return !1;
            }
        }
        return null != parseURL(A, null, t, 0);
    }
    get href() {
        return function serializeURL(A) {
            let e = `${A.scheme}:`;
            if (null !== A.host) {
                e += "//";
                if ("" !== A.username || "" !== A.password) {
                    e += A.username;
                    if ("" !== A.password) {
                        e += `:${A.password}`;
                    }
                    e += "@";
                }
                e += A.host;
                if (null !== A.port) {
                    e += `:${A.port}`;
                }
            }
            if (null === A.host && !A.opaquePath && A.path.length > 1 && "" === A.path[0]) {
                e += "/.";
            }
            e += serializePath(A);
            if (null !== A.query) {
                e += `?${A.query}`;
            }
            if (null !== A.fragment) {
                e += `#${A.fragment}`;
            }
            return e;
        }(this[R].url);
    }
    set href(A) {
        const e = parseURL(A = toUSVString(A), null, null, 0);
        if (null == e) {
            throw new TypeError(`Invalid URL: ${A}`);
        }
        this[R].url = e;
        if (this[R].query) {
            updateSearchParams(this[R].query, e.query);
        }
    }
    get origin() {
        return serializeURLOrigin(this[R].url);
    }
    get protocol() {
        return `${this[R].url.scheme}:`;
    }
    set protocol(A) {
        parseURL(`${A = toUSVString(A)}:`, this[R].url, null, 2);
    }
    get username() {
        return this[R].url.username;
    }
    set username(A) {
        A = toUSVString(A);
        if (!cannotHaveAUsernamePasswordPort(this[R].url)) {
            !function setURLUsername(A, e) {
                A.username = utf8PercentEncodeString(e, isUserinfoPercentEncode);
            }(this[R].url, A);
        }
    }
    get password() {
        return this[R].url.password;
    }
    set password(A) {
        A = toUSVString(A);
        if (!cannotHaveAUsernamePasswordPort(this[R].url)) {
            !function setURLPassword(A, e) {
                A.password = utf8PercentEncodeString(e, isUserinfoPercentEncode);
            }(this[R].url, A);
        }
    }
    get host() {
        const { url: A } = this[R];
        if (null == A.host) {
            return "";
        } else if (null == A.port) {
            return A.host;
        } else {
            return `${A.host}:${A.port}`;
        }
    }
    set host(A) {
        A = toUSVString(A);
        if (!this[R].url.opaquePath) {
            parseURL(A, this[R].url, null, 3);
        }
    }
    get hostname() {
        const { url: A } = this[R];
        return null != A.host ? A.host : "";
    }
    set hostname(A) {
        A = toUSVString(A);
        if (!this[R].url.opaquePath) {
            parseURL(A, this[R].url, null, 4);
        }
    }
    get port() {
        const { url: A } = this[R];
        return null != A.port ? `${A.port}` : "";
    }
    set port(A) {
        A = toUSVString(A);
        const { url: e } = this[R];
        if (!cannotHaveAUsernamePasswordPort(e)) {
            if (!A) {
                e.port = null;
            } else {
                parseURL(A, e, null, 5);
            }
        }
    }
    get pathname() {
        return serializePath(this[R].url);
    }
    set pathname(A) {
        A = toUSVString(A);
        const { url: e } = this[R];
        if (!e.opaquePath) {
            e.path = [];
            parseURL(A, e, null, 6);
        }
    }
    get search() {
        const { url: A } = this[R];
        return A.query ? `?${A.query}` : "";
    }
    set search(A) {
        A = toUSVString(A);
        const { url: e, query: t } = this[R];
        if (!A) {
            e.query = null;
            if (t) {
                updateSearchParams(t, null);
            }
        } else {
            const n = "?" === A[0] ? A.substring(1) : A;
            e.query = "";
            parseURL(n, e, null, 7);
            if (t) {
                updateSearchParams(t, e.query);
            }
        }
    }
    get searchParams() {
        const A = this[R];
        let e = A.query;
        if (null == e) {
            e = A.query = function createSearchParams(A, e) {
                const t = new URLSearchParams;
                t[B].url = A;
                t[B].serialized = null == e;
                if (e) {
                    t[B].list = parseUrlencoded(e);
                }
                return t;
            }(this, A.url.query);
        }
        return e;
    }
    get hash() {
        const { url: A } = this[R];
        return A.fragment ? `#${A.fragment}` : "";
    }
    set hash(A) {
        A = toUSVString(A);
        const { url: e } = this[R];
        if (!A) {
            e.fragment = null;
        } else {
            const t = "#" === A[0] ? A.substring(1) : A;
            e.fragment = "";
            parseURL(t, e, null, 8);
        }
    }
    toJSON() {
        return this.href;
    }
    toString() {
        return this.href;
    }
    constructor(A, e){
        if (void 0 === A && void 0 === e) {
            throw new TypeError('The "url" argument must be specified.');
        }
        A = toUSVString(A);
        if (null != e) {
            e = toUSVString(e);
        }
        let t = null;
        if (null != e) {
            t = parseURL(e, null, null, 0);
            if (null == t) {
                throw new TypeError(`Invalid base URL: ${e}`);
            }
        }
        const n = parseURL(A, null, t, 0);
        if (null == n) {
            throw new TypeError(`Invalid URL: ${A}`);
        }
        this[R] = {
            url: n,
            query: null
        };
    }
}
Object.defineProperty(URL.prototype, Symbol.toStringTag, {
    value: "URL",
    configurable: !0
});
const B = Symbol("URLSearchParamsImpl");
const q = Symbol.dispose || Symbol.for("dispose");
function updateSearchParams(A, e) {
    if (e) {
        A[B].list = parseUrlencoded(e);
    } else {
        A[B].list.length = 0;
    }
    A[B].serialized = null == e;
}
function updateInternalURL(A) {
    if (A.url) {
        const e = serializeUrlencoded(A.list);
        !function updateURLQuery(A, e) {
            A[R].url.query = e;
        }(A.url, e || null);
        A.serialized = !0;
    }
}
const z = "undefined" != typeof Iterator ? Iterator : Object;
class URLSearchParamsIteratorImpl extends z {
    next() {
        const A = this[B];
        return A.index < A.ptr.list.length ? {
            value: A.map(A.ptr.list[A.index++]),
            done: !1
        } : {
            value: void 0,
            done: !0
        };
    }
    [Symbol.iterator]() {
        return this;
    }
    [q]() {}
    constructor(A, e){
        super();
        this[B] = {
            ptr: A,
            map: e,
            index: 0
        };
    }
}
class URLSearchParams {
    get size() {
        return this[B].list.length;
    }
    append(A, e) {
        A = toUSVString(A);
        e = toUSVString(e);
        this[B].list.push([
            A,
            e
        ]);
        const t = this[B];
        if (t.url && t.serialized) {
            !function appendURLQuery(A, e) {
                const t = A[R].url;
                t.query = t.query ? `${t.query}&${e}` : e;
            }(t.url, serializeUrlencoded([
                [
                    A,
                    e
                ]
            ]));
        } else {
            updateInternalURL(t);
        }
    }
    delete(A, e) {
        A = toUSVString(A);
        e = null != e ? toUSVString(e) : void 0;
        const { list: t } = this[B];
        let n = 0;
        while(n < t.length){
            if (t[n][0] === A && (null == e || t[n][1] === e)) {
                t.splice(n, 1);
            } else {
                n++;
            }
        }
        updateInternalURL(this[B]);
    }
    get(A) {
        A = toUSVString(A);
        const { list: e } = this[B];
        for(let t = 0; t < e.length; t++){
            if (e[t][0] === A) {
                return e[t][1];
            }
        }
        return null;
    }
    getAll(A) {
        A = toUSVString(A);
        const e = [];
        const { list: t } = this[B];
        for(let n = 0; n < t.length; n++){
            if (t[n][0] === A) {
                e.push(t[n][1]);
            }
        }
        return e;
    }
    has(A, e) {
        A = toUSVString(A);
        e = null != e ? toUSVString(e) : void 0;
        const { list: t } = this[B];
        for(let n = 0; n < t.length; n++){
            if (t[n][0] === A && (null == e || t[n][1] === e)) {
                return !0;
            }
        }
        return !1;
    }
    set(A, e) {
        A = toUSVString(A);
        e = toUSVString(e);
        const { list: t } = this[B];
        let n = !1;
        let r = !1;
        let o = 0;
        while(o < t.length){
            if (t[o][0] === A) {
                if (n) {
                    t.splice(o, 1);
                    r = !0;
                } else {
                    n = !0;
                    if (t[o][1] !== e) {
                        t[o][1] = e;
                        r = !0;
                    }
                    o++;
                }
            } else {
                o++;
            }
        }
        if (!n) {
            t.push([
                A,
                e
            ]);
            r = !0;
        }
        if (r) {
            updateInternalURL(this[B]);
        }
    }
    sort() {
        this[B].list.sort((A, e)=>{
            if (A[0] < e[0]) {
                return -1;
            } else if (A[0] > e[0]) {
                return 1;
            } else {
                return 0;
            }
        });
        updateInternalURL(this[B]);
    }
    forEach(A, e) {
        if ("function" != typeof A) {
            throw new TypeError('The "callback" argument must be of type function');
        }
        const { list: t } = this[B];
        for(let n = 0; n < t.length; n++){
            A.call(e, t[n][1], t[n][0], this);
        }
    }
    entries() {
        return new URLSearchParamsIteratorImpl(this[B], (A)=>A);
    }
    keys() {
        return new URLSearchParamsIteratorImpl(this[B], (A)=>A[0]);
    }
    values() {
        return new URLSearchParamsIteratorImpl(this[B], (A)=>A[1]);
    }
    toString() {
        return serializeUrlencoded(this[B].list);
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    constructor(A){
        const e = this[B] = {
            list: [],
            url: null,
            serialized: !0
        };
        let t;
        if (Array.isArray(A)) {
            for(let t = 0; t < A.length; t++){
                e.list.push(toQueryPair(A[t]));
            }
        } else if (null != (t = toIterator(A))) {
            let A;
            while(!(A = toObject(t.next())).done){
                e.list.push(toQueryPair(A.value));
            }
        } else if (("object" == typeof A || "function" == typeof A) && null != A) {
            const t = Object.keys(A);
            for(let n = 0; n < t.length; n++){
                const r = t[n];
                const o = toWellFormed(r);
                const i = toUSVString(A[r]);
                const s = e.list.find((A)=>A[0] === o);
                if (s) {
                    s[1] = i;
                } else {
                    e.list.push([
                        o,
                        i
                    ]);
                }
            }
        } else if (void 0 !== A) {
            let t = toUSVString(A);
            t = "?" === t[0] ? t.substring(1) : t;
            e.list = parseUrlencoded(t);
        }
    }
}
Object.defineProperty(URLSearchParams.prototype, Symbol.toStringTag, {
    value: "URLSearchParams",
    configurable: !0
});
 //# sourceMappingURL=whatwg-url-minimum.mjs.map

// The URL and URLSearchParams the URL fill installs.


export { URL, URLSearchParams };
