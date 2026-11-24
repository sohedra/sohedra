/*!
 * urlpattern-polyfill 10.1.0 (MIT)
 *
 * Copyright 2020 Intel Corporation
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


function _check_private_redeclaration(obj, privateCollection) {
    if (privateCollection.has(obj)) {
        throw new TypeError("Cannot initialize the same private elements twice on an object");
    }
}
function _class_apply_descriptor_get(receiver, descriptor) {
    if (descriptor.get) return descriptor.get.call(receiver);
    return descriptor.value;
}
function _class_apply_descriptor_set(receiver, descriptor, value) {
    if (descriptor.set) descriptor.set.call(receiver, value);
    else {
        if (!descriptor.writable) {
            throw new TypeError("attempted to set read only private field");
        }
        descriptor.value = value;
    }
}
function _class_extract_field_descriptor(receiver, privateMap, action) {
    if (!privateMap.has(receiver)) throw new TypeError("attempted to " + action + " private field on non-instance");
    return privateMap.get(receiver);
}
function _class_private_field_get(receiver, privateMap) {
    var descriptor = _class_extract_field_descriptor(receiver, privateMap, "get");
    return _class_apply_descriptor_get(receiver, descriptor);
}
function _class_private_field_init(obj, privateMap, value) {
    _check_private_redeclaration(obj, privateMap);
    privateMap.set(obj, value);
}
function _class_private_field_set(receiver, privateMap, value) {
    var descriptor = _class_extract_field_descriptor(receiver, privateMap, "set");
    _class_apply_descriptor_set(receiver, descriptor, value);
    return value;
}
function _class_private_method_get(receiver, privateSet, fn) {
    if (!privateSet.has(receiver)) throw new TypeError("attempted to get private field on non-instance");
    return fn;
}
function _class_private_method_init(obj, privateSet) {
    _check_private_redeclaration(obj, privateSet);
    privateSet.add(obj);
}
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else obj[key] = value;
    return obj;
}
var _i, _n, urlpattern_t, _e, _s, _l, urlpattern_o, _d, _p, _g, urlpattern_r, _R, _b, _u, _m, _a, _P, _E, _S, _O, _k, _x, _h, _f, _T, _A, _y, _w, _c, _C, _class, _i1, _n1, urlpattern_t1, _e1, _s1, _l1;
var Pe = Object.defineProperty;
var a = (e, t)=>Pe(e, "name", {
        value: t,
        configurable: !0
    });
var P = class {
    hasCustomName() {
        return this.name !== "" && typeof this.name != "number";
    }
    constructor(t, r, n, c, l, f){
        _define_property(this, "type", 3);
        _define_property(this, "name", "");
        _define_property(this, "prefix", "");
        _define_property(this, "value", "");
        _define_property(this, "suffix", "");
        _define_property(this, "modifier", 3);
        this.type = t, this.name = r, this.prefix = n, this.value = c, this.suffix = l, this.modifier = f;
    }
};
a(P, "Part");
var Re = /[\$A-Z_a-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0558\u0559\u0560-\u0588\u058B\u058C\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u0870-\u0887\u0889-\u088F\u08A0-\u08C9\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C5C\u0C5D\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDC-\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D04-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u1711\u171F-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4C\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C8A\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u208F-\u209F\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7DD\uA7E2\uA7F1-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB6C\uAB6D\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC\u{10000}-\u{1000B}\u{1000D}-\u{10026}\u{10028}-\u{1003A}\u{1003C}\u{1003D}\u{1003F}-\u{1004D}\u{10050}-\u{1005D}\u{10080}-\u{100FA}\u{10140}-\u{10174}\u{10280}-\u{1029C}\u{102A0}-\u{102D0}\u{10300}-\u{1031F}\u{1032D}-\u{1034A}\u{10350}-\u{10375}\u{10380}-\u{1039D}\u{103A0}-\u{103C3}\u{103C8}-\u{103CF}\u{103D1}-\u{103D5}\u{10400}-\u{1049D}\u{104B0}-\u{104D3}\u{104D8}-\u{104FB}\u{10500}-\u{10527}\u{10530}-\u{10563}\u{10570}-\u{1057A}\u{1057C}-\u{1058A}\u{1058C}-\u{10592}\u{10594}\u{10595}\u{10597}-\u{105A1}\u{105A3}-\u{105B1}\u{105B3}-\u{105B9}\u{105BB}\u{105BC}\u{105C0}-\u{105F3}\u{10600}-\u{10736}\u{10740}-\u{10755}\u{10760}-\u{10767}\u{10780}-\u{10785}\u{10787}-\u{107B0}\u{107B2}-\u{107BF}\u{10800}-\u{10805}\u{10808}\u{1080A}-\u{10835}\u{10837}\u{10838}\u{1083C}\u{1083F}-\u{10855}\u{10860}-\u{10876}\u{10880}-\u{1089E}\u{108E0}-\u{108F2}\u{108F4}\u{108F5}\u{10900}-\u{10915}\u{10920}-\u{10939}\u{10940}-\u{10959}\u{10980}-\u{109B7}\u{109BE}\u{109BF}\u{10A00}\u{10A10}-\u{10A13}\u{10A15}-\u{10A17}\u{10A19}-\u{10A35}\u{10A60}-\u{10A7C}\u{10A80}-\u{10A9C}\u{10AC0}-\u{10AC7}\u{10AC9}-\u{10AE4}\u{10B00}-\u{10B35}\u{10B40}-\u{10B55}\u{10B60}-\u{10B72}\u{10B80}-\u{10B91}\u{10C00}-\u{10C48}\u{10C80}-\u{10CB2}\u{10CC0}-\u{10CF2}\u{10D00}-\u{10D23}\u{10D4A}-\u{10D65}\u{10D6F}-\u{10D85}\u{10E80}-\u{10EA9}\u{10EB0}\u{10EB1}\u{10EC2}-\u{10EC7}\u{10ED9}-\u{10EEE}\u{10F00}-\u{10F1C}\u{10F27}\u{10F30}-\u{10F45}\u{10F70}-\u{10F81}\u{10FB0}-\u{10FC4}\u{10FE0}-\u{10FF6}\u{11003}-\u{11037}\u{11071}\u{11072}\u{11075}\u{11083}-\u{110AF}\u{110D0}-\u{110E8}\u{11103}-\u{11126}\u{11144}\u{11147}\u{11150}-\u{11172}\u{11176}\u{11183}-\u{111B2}\u{111C1}-\u{111C4}\u{111DA}\u{111DC}\u{11200}-\u{11211}\u{11213}-\u{1122B}\u{1123F}\u{11240}\u{11280}-\u{11286}\u{11288}\u{1128A}-\u{1128D}\u{1128F}-\u{1129D}\u{1129F}-\u{112A8}\u{112B0}-\u{112DE}\u{11305}-\u{1130C}\u{1130F}\u{11310}\u{11313}-\u{11328}\u{1132A}-\u{11330}\u{11332}\u{11333}\u{11335}-\u{11339}\u{1133D}\u{11350}\u{1135D}-\u{11361}\u{11380}-\u{11389}\u{1138B}\u{1138E}\u{11390}-\u{113B5}\u{113B7}\u{113D1}\u{113D3}\u{11400}-\u{11434}\u{11447}-\u{1144A}\u{1145F}-\u{11461}\u{11480}-\u{114AF}\u{114C4}\u{114C5}\u{114C7}\u{11580}-\u{115AE}\u{115D8}-\u{115DB}\u{11600}-\u{1162F}\u{11644}\u{11680}-\u{116AA}\u{116B8}\u{11700}-\u{1171A}\u{11740}-\u{11746}\u{11800}-\u{1182B}\u{118A0}-\u{118DF}\u{118FF}-\u{11906}\u{11909}\u{1190C}-\u{11913}\u{11915}\u{11916}\u{11918}-\u{1192F}\u{1193F}\u{11941}\u{119A0}-\u{119A7}\u{119AA}-\u{119D0}\u{119E1}\u{119E3}\u{11A00}\u{11A0B}-\u{11A32}\u{11A3A}\u{11A50}\u{11A5C}-\u{11A89}\u{11A9D}\u{11AB0}-\u{11AF8}\u{11B0A}\u{11BC0}-\u{11BE0}\u{11C00}-\u{11C08}\u{11C0A}-\u{11C2E}\u{11C40}\u{11C72}-\u{11C8F}\u{11D00}-\u{11D06}\u{11D08}\u{11D09}\u{11D0B}-\u{11D30}\u{11D46}\u{11D60}-\u{11D65}\u{11D67}\u{11D68}\u{11D6A}-\u{11D89}\u{11D98}\u{11DB0}-\u{11DDB}\u{11DF1}\u{11EE0}-\u{11EF2}\u{11F02}\u{11F04}-\u{11F10}\u{11F12}-\u{11F33}\u{11FB0}\u{12000}-\u{12399}\u{12400}-\u{1246F}\u{12475}-\u{12543}\u{12550}-\u{12686}\u{12F90}-\u{12FF0}\u{13000}-\u{1342F}\u{13441}-\u{13446}\u{13460}-\u{143FA}\u{14400}-\u{14646}\u{16100}-\u{1611D}\u{16800}-\u{16A38}\u{16A40}-\u{16A5E}\u{16A70}-\u{16ABE}\u{16AD0}-\u{16AED}\u{16B00}-\u{16B2F}\u{16B40}-\u{16B43}\u{16B63}-\u{16B77}\u{16B7D}-\u{16B8F}\u{16D40}-\u{16D6C}\u{16E40}-\u{16E7F}\u{16EA0}-\u{16EB8}\u{16EBB}-\u{16ED3}\u{16F00}-\u{16F4A}\u{16F50}\u{16F93}-\u{16F9F}\u{16FE0}\u{16FE1}\u{16FE3}\u{16FF2}-\u{16FF6}\u{17000}-\u{18CDA}\u{18CFF}-\u{18D20}\u{18D80}-\u{18DF2}\u{18E00}-\u{19191}\u{191A0}-\u{191D2}\u{1AFF0}-\u{1AFF3}\u{1AFF5}-\u{1AFFB}\u{1AFFD}\u{1AFFE}\u{1B000}-\u{1B128}\u{1B132}\u{1B150}-\u{1B152}\u{1B155}\u{1B164}-\u{1B168}\u{1B170}-\u{1B2FB}\u{1BC00}-\u{1BC6A}\u{1BC70}-\u{1BC7C}\u{1BC80}-\u{1BC88}\u{1BC90}-\u{1BC99}\u{1D400}-\u{1D454}\u{1D456}-\u{1D49C}\u{1D49E}\u{1D49F}\u{1D4A2}\u{1D4A5}\u{1D4A6}\u{1D4A9}-\u{1D4AC}\u{1D4AE}-\u{1D4B9}\u{1D4BB}\u{1D4BD}-\u{1D4C3}\u{1D4C5}-\u{1D505}\u{1D507}-\u{1D50A}\u{1D50D}-\u{1D514}\u{1D516}-\u{1D51C}\u{1D51E}-\u{1D539}\u{1D53B}-\u{1D53E}\u{1D540}-\u{1D544}\u{1D546}\u{1D54A}-\u{1D550}\u{1D552}-\u{1D6A6}\u{1D6A8}-\u{1D6C0}\u{1D6C2}-\u{1D6DA}\u{1D6DC}-\u{1D6FA}\u{1D6FC}-\u{1D714}\u{1D716}-\u{1D734}\u{1D736}-\u{1D74E}\u{1D750}-\u{1D76E}\u{1D770}-\u{1D788}\u{1D78A}-\u{1D7A8}\u{1D7AA}-\u{1D7C2}\u{1D7C4}-\u{1D7CB}\u{1DF00}-\u{1DF81}\u{1DF90}-\u{1DF96}\u{1DFCD}-\u{1DFFF}\u{1E030}-\u{1E06D}\u{1E100}-\u{1E12C}\u{1E137}-\u{1E13D}\u{1E14E}\u{1E290}-\u{1E2AD}\u{1E2C0}-\u{1E2EB}\u{1E4D0}-\u{1E4EB}\u{1E5D0}-\u{1E5ED}\u{1E5F0}\u{1E6C0}-\u{1E6DE}\u{1E6E0}-\u{1E6E2}\u{1E6E4}\u{1E6E5}\u{1E6E7}-\u{1E6ED}\u{1E6F0}-\u{1E6F4}\u{1E6FE}\u{1E6FF}\u{1E7E0}-\u{1E7E6}\u{1E7E8}-\u{1E7EB}\u{1E7ED}\u{1E7EE}\u{1E7F0}-\u{1E7FE}\u{1E800}-\u{1E8C4}\u{1E900}-\u{1E943}\u{1E94B}\u{1EE00}-\u{1EE03}\u{1EE05}-\u{1EE1F}\u{1EE21}\u{1EE22}\u{1EE24}\u{1EE27}\u{1EE29}-\u{1EE32}\u{1EE34}-\u{1EE37}\u{1EE39}\u{1EE3B}\u{1EE42}\u{1EE47}\u{1EE49}\u{1EE4B}\u{1EE4D}-\u{1EE4F}\u{1EE51}\u{1EE52}\u{1EE54}\u{1EE57}\u{1EE59}\u{1EE5B}\u{1EE5D}\u{1EE5F}\u{1EE61}\u{1EE62}\u{1EE64}\u{1EE67}-\u{1EE6A}\u{1EE6C}-\u{1EE72}\u{1EE74}-\u{1EE77}\u{1EE79}-\u{1EE7C}\u{1EE7E}\u{1EE80}-\u{1EE89}\u{1EE8B}-\u{1EE9B}\u{1EEA1}-\u{1EEA3}\u{1EEA5}-\u{1EEA9}\u{1EEAB}-\u{1EEBB}\u{20000}-\u{2A6DF}\u{2A700}-\u{2B81E}\u{2B820}-\u{2CEAD}\u{2CEB0}-\u{2EBE0}\u{2EBF0}-\u{2EE5D}\u{2F800}-\u{2FA1D}\u{30000}-\u{3134A}\u{31350}-\u{33479}\u{3D000}-\u{3FC3F}]/u, Ee = /[\$0-9A-Z_a-z\xAA\xB5\xB7\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0558\u0559\u0560-\u0588\u058B\u058C\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7-\u05C9\u05D0-\u05EA\u05EF-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u07FD\u0800-\u082D\u0840-\u085B\u0860-\u086A\u0870-\u0887\u0889-\u088F\u0897-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u09FC\u09FE\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9-\u0AFF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B53-\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3C-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C5C\u0C5D\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDC-\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1-\u0CF3\u0D00-\u0D0C\u0D0E-\u0D10\u0D12-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D81-\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECE\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1369-\u1371\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u1715\u171F-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u180F-\u1819\u1820-\u1878\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1ABF-\u1AF0\u1B00-\u1B4C\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C8A\u1C90-\u1CBA\u1CBD-\u1CBF\u1CD0-\u1CD2\u1CD4-\u1CFA\u1D00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u208F-\u209F\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099-\u309F\u30A1-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7DD\uA7E2\uA7F1-\uA827\uA82C\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB6C\uAB6D\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF65-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC\u{10000}-\u{1000B}\u{1000D}-\u{10026}\u{10028}-\u{1003A}\u{1003C}\u{1003D}\u{1003F}-\u{1004D}\u{10050}-\u{1005D}\u{10080}-\u{100FA}\u{10140}-\u{10174}\u{101FD}\u{10280}-\u{1029C}\u{102A0}-\u{102D0}\u{102E0}\u{10300}-\u{1031F}\u{1032D}-\u{1034A}\u{10350}-\u{1037A}\u{10380}-\u{1039D}\u{103A0}-\u{103C3}\u{103C8}-\u{103CF}\u{103D1}-\u{103D5}\u{10400}-\u{1049D}\u{104A0}-\u{104A9}\u{104B0}-\u{104D3}\u{104D8}-\u{104FB}\u{10500}-\u{10527}\u{10530}-\u{10563}\u{10570}-\u{1057A}\u{1057C}-\u{1058A}\u{1058C}-\u{10592}\u{10594}\u{10595}\u{10597}-\u{105A1}\u{105A3}-\u{105B1}\u{105B3}-\u{105B9}\u{105BB}\u{105BC}\u{105C0}-\u{105F3}\u{10600}-\u{10736}\u{10740}-\u{10755}\u{10760}-\u{10767}\u{10780}-\u{10785}\u{10787}-\u{107B0}\u{107B2}-\u{107BF}\u{10800}-\u{10805}\u{10808}\u{1080A}-\u{10835}\u{10837}\u{10838}\u{1083C}\u{1083F}-\u{10855}\u{10860}-\u{10876}\u{10880}-\u{1089E}\u{108E0}-\u{108F2}\u{108F4}\u{108F5}\u{10900}-\u{10915}\u{10920}-\u{10939}\u{10940}-\u{10959}\u{10980}-\u{109B7}\u{109BE}\u{109BF}\u{10A00}-\u{10A03}\u{10A05}\u{10A06}\u{10A0C}-\u{10A13}\u{10A15}-\u{10A17}\u{10A19}-\u{10A35}\u{10A38}-\u{10A3A}\u{10A3F}\u{10A60}-\u{10A7C}\u{10A80}-\u{10A9C}\u{10AC0}-\u{10AC7}\u{10AC9}-\u{10AE6}\u{10B00}-\u{10B35}\u{10B40}-\u{10B55}\u{10B60}-\u{10B72}\u{10B80}-\u{10B91}\u{10C00}-\u{10C48}\u{10C80}-\u{10CB2}\u{10CC0}-\u{10CF2}\u{10D00}-\u{10D27}\u{10D30}-\u{10D39}\u{10D40}-\u{10D65}\u{10D69}-\u{10D6D}\u{10D6F}-\u{10D85}\u{10E80}-\u{10EA9}\u{10EAB}\u{10EAC}\u{10EB0}\u{10EB1}\u{10EC2}-\u{10EC7}\u{10ECB}-\u{10ECF}\u{10ED9}-\u{10EEE}\u{10EF0}-\u{10F1C}\u{10F27}\u{10F30}-\u{10F50}\u{10F70}-\u{10F85}\u{10FB0}-\u{10FC4}\u{10FE0}-\u{10FF6}\u{11000}-\u{11046}\u{11066}-\u{11075}\u{1107F}-\u{110BA}\u{110C2}\u{110D0}-\u{110E8}\u{110F0}-\u{110F9}\u{11100}-\u{11134}\u{11136}-\u{1113F}\u{11144}-\u{11147}\u{11150}-\u{11173}\u{11176}\u{11180}-\u{111C4}\u{111C9}-\u{111CC}\u{111CE}-\u{111DA}\u{111DC}\u{11200}-\u{11211}\u{11213}-\u{11237}\u{1123E}-\u{11241}\u{11280}-\u{11286}\u{11288}\u{1128A}-\u{1128D}\u{1128F}-\u{1129D}\u{1129F}-\u{112A8}\u{112B0}-\u{112EA}\u{112F0}-\u{112F9}\u{11300}-\u{11303}\u{11305}-\u{1130C}\u{1130F}\u{11310}\u{11313}-\u{11328}\u{1132A}-\u{11330}\u{11332}\u{11333}\u{11335}-\u{11339}\u{1133B}-\u{11344}\u{11347}\u{11348}\u{1134B}-\u{1134D}\u{11350}\u{11357}\u{1135D}-\u{11363}\u{11366}-\u{1136C}\u{11370}-\u{11374}\u{11380}-\u{11389}\u{1138B}\u{1138E}\u{11390}-\u{113B5}\u{113B7}-\u{113C0}\u{113C2}\u{113C5}\u{113C7}-\u{113CA}\u{113CC}-\u{113D3}\u{113E1}\u{113E2}\u{11400}-\u{1144A}\u{11450}-\u{11459}\u{1145E}-\u{11461}\u{11480}-\u{114C5}\u{114C7}\u{114D0}-\u{114D9}\u{11580}-\u{115B5}\u{115B8}-\u{115C0}\u{115D8}-\u{115DD}\u{11600}-\u{11640}\u{11644}\u{11650}-\u{11659}\u{11680}-\u{116B8}\u{116C0}-\u{116C9}\u{116D0}-\u{116E3}\u{11700}-\u{1171A}\u{1171D}-\u{1172B}\u{11730}-\u{11739}\u{11740}-\u{11746}\u{11800}-\u{1183A}\u{118A0}-\u{118E9}\u{118FF}-\u{11906}\u{11909}\u{1190C}-\u{11913}\u{11915}\u{11916}\u{11918}-\u{11935}\u{11937}\u{11938}\u{1193B}-\u{11943}\u{11950}-\u{11959}\u{119A0}-\u{119A7}\u{119AA}-\u{119D7}\u{119DA}-\u{119E1}\u{119E3}\u{119E4}\u{11A00}-\u{11A3E}\u{11A47}\u{11A50}-\u{11A99}\u{11A9D}\u{11AB0}-\u{11AF8}\u{11B0A}\u{11B60}-\u{11B67}\u{11BC0}-\u{11BE0}\u{11BF0}-\u{11BF9}\u{11C00}-\u{11C08}\u{11C0A}-\u{11C36}\u{11C38}-\u{11C40}\u{11C50}-\u{11C59}\u{11C72}-\u{11C8F}\u{11C92}-\u{11CA7}\u{11CA9}-\u{11CB6}\u{11D00}-\u{11D06}\u{11D08}\u{11D09}\u{11D0B}-\u{11D36}\u{11D3A}\u{11D3C}\u{11D3D}\u{11D3F}-\u{11D47}\u{11D50}-\u{11D59}\u{11D60}-\u{11D65}\u{11D67}\u{11D68}\u{11D6A}-\u{11D8E}\u{11D90}\u{11D91}\u{11D93}-\u{11D98}\u{11DA0}-\u{11DA9}\u{11DB0}-\u{11DDB}\u{11DE0}-\u{11DE9}\u{11DF0}\u{11DF1}\u{11EE0}-\u{11EF6}\u{11F00}-\u{11F10}\u{11F12}-\u{11F3A}\u{11F3E}-\u{11F42}\u{11F50}-\u{11F5A}\u{11FB0}\u{12000}-\u{12399}\u{12400}-\u{1246F}\u{12475}-\u{12543}\u{12550}-\u{12686}\u{12F90}-\u{12FF0}\u{13000}-\u{1342F}\u{13440}-\u{13455}\u{13460}-\u{143FA}\u{14400}-\u{14646}\u{16100}-\u{16139}\u{16800}-\u{16A38}\u{16A40}-\u{16A5E}\u{16A60}-\u{16A69}\u{16A70}-\u{16ABE}\u{16AC0}-\u{16AC9}\u{16AD0}-\u{16AED}\u{16AF0}-\u{16AF4}\u{16B00}-\u{16B36}\u{16B40}-\u{16B43}\u{16B50}-\u{16B59}\u{16B63}-\u{16B77}\u{16B7D}-\u{16B8F}\u{16D40}-\u{16D6C}\u{16D70}-\u{16D79}\u{16E40}-\u{16E7F}\u{16EA0}-\u{16EB8}\u{16EBB}-\u{16ED3}\u{16F00}-\u{16F4A}\u{16F4F}-\u{16F87}\u{16F8F}-\u{16F9F}\u{16FE0}\u{16FE1}\u{16FE3}\u{16FE4}\u{16FF0}-\u{16FF6}\u{17000}-\u{18CDA}\u{18CFF}-\u{18D20}\u{18D80}-\u{18DF2}\u{18E00}-\u{19191}\u{191A0}-\u{191D2}\u{1AFF0}-\u{1AFF3}\u{1AFF5}-\u{1AFFB}\u{1AFFD}\u{1AFFE}\u{1B000}-\u{1B128}\u{1B132}\u{1B150}-\u{1B152}\u{1B155}\u{1B164}-\u{1B168}\u{1B170}-\u{1B2FB}\u{1BC00}-\u{1BC6A}\u{1BC70}-\u{1BC7C}\u{1BC80}-\u{1BC88}\u{1BC90}-\u{1BC99}\u{1BC9D}\u{1BC9E}\u{1CCF0}-\u{1CCF9}\u{1CF00}-\u{1CF2D}\u{1CF30}-\u{1CF46}\u{1D127}\u{1D128}\u{1D165}-\u{1D169}\u{1D16D}-\u{1D172}\u{1D17B}-\u{1D182}\u{1D185}-\u{1D18B}\u{1D1AA}-\u{1D1AD}\u{1D242}-\u{1D244}\u{1D250}-\u{1D252}\u{1D25B}\u{1D25C}\u{1D25F}\u{1D280}\u{1D281}\u{1D400}-\u{1D454}\u{1D456}-\u{1D49C}\u{1D49E}\u{1D49F}\u{1D4A2}\u{1D4A5}\u{1D4A6}\u{1D4A9}-\u{1D4AC}\u{1D4AE}-\u{1D4B9}\u{1D4BB}\u{1D4BD}-\u{1D4C3}\u{1D4C5}-\u{1D505}\u{1D507}-\u{1D50A}\u{1D50D}-\u{1D514}\u{1D516}-\u{1D51C}\u{1D51E}-\u{1D539}\u{1D53B}-\u{1D53E}\u{1D540}-\u{1D544}\u{1D546}\u{1D54A}-\u{1D550}\u{1D552}-\u{1D6A6}\u{1D6A8}-\u{1D6C0}\u{1D6C2}-\u{1D6DA}\u{1D6DC}-\u{1D6FA}\u{1D6FC}-\u{1D714}\u{1D716}-\u{1D734}\u{1D736}-\u{1D74E}\u{1D750}-\u{1D76E}\u{1D770}-\u{1D788}\u{1D78A}-\u{1D7A8}\u{1D7AA}-\u{1D7C2}\u{1D7C4}-\u{1D7CB}\u{1D7CE}-\u{1D7FF}\u{1DA00}-\u{1DA36}\u{1DA3B}-\u{1DA6C}\u{1DA75}\u{1DA84}\u{1DA9B}-\u{1DA9F}\u{1DAA1}-\u{1DAAF}\u{1DF00}-\u{1DF81}\u{1DF90}-\u{1DF96}\u{1DFCD}-\u{1E006}\u{1E008}-\u{1E018}\u{1E01B}-\u{1E021}\u{1E023}\u{1E024}\u{1E026}-\u{1E02A}\u{1E030}-\u{1E06D}\u{1E08F}\u{1E100}-\u{1E12C}\u{1E130}-\u{1E13D}\u{1E140}-\u{1E149}\u{1E14E}\u{1E290}-\u{1E2AE}\u{1E2C0}-\u{1E2F9}\u{1E4D0}-\u{1E4F9}\u{1E5D0}-\u{1E5FA}\u{1E6C0}-\u{1E6DE}\u{1E6E0}-\u{1E6F5}\u{1E6FE}\u{1E6FF}\u{1E7E0}-\u{1E7E6}\u{1E7E8}-\u{1E7EB}\u{1E7ED}\u{1E7EE}\u{1E7F0}-\u{1E7FE}\u{1E800}-\u{1E8C4}\u{1E8D0}-\u{1E8D6}\u{1E900}-\u{1E94B}\u{1E950}-\u{1E959}\u{1EE00}-\u{1EE03}\u{1EE05}-\u{1EE1F}\u{1EE21}\u{1EE22}\u{1EE24}\u{1EE27}\u{1EE29}-\u{1EE32}\u{1EE34}-\u{1EE37}\u{1EE39}\u{1EE3B}\u{1EE42}\u{1EE47}\u{1EE49}\u{1EE4B}\u{1EE4D}-\u{1EE4F}\u{1EE51}\u{1EE52}\u{1EE54}\u{1EE57}\u{1EE59}\u{1EE5B}\u{1EE5D}\u{1EE5F}\u{1EE61}\u{1EE62}\u{1EE64}\u{1EE67}-\u{1EE6A}\u{1EE6C}-\u{1EE72}\u{1EE74}-\u{1EE77}\u{1EE79}-\u{1EE7C}\u{1EE7E}\u{1EE80}-\u{1EE89}\u{1EE8B}-\u{1EE9B}\u{1EEA1}-\u{1EEA3}\u{1EEA5}-\u{1EEA9}\u{1EEAB}-\u{1EEBB}\u{1FBF0}-\u{1FBF9}\u{20000}-\u{2A6DF}\u{2A700}-\u{2B81E}\u{2B820}-\u{2CEAD}\u{2CEB0}-\u{2EBE0}\u{2EBF0}-\u{2EE5D}\u{2F800}-\u{2FA1D}\u{30000}-\u{3134A}\u{31350}-\u{33479}\u{3D000}-\u{3FC3F}\u{E0100}-\u{E01EF}]/u, v = ".*";
function Oe(e, t) {
    return (t ? /^[\x00-\xFF]*$/ : /^[\x00-\x7F]*$/).test(e);
}
a(Oe, "isASCII");
function D(e, t = !1) {
    let r = [], n = 0;
    for(; n < e.length;){
        let c = e[n], l = a(function(f) {
            if (!t) throw new TypeError(f);
            r.push({
                type: "INVALID_CHAR",
                index: n,
                value: e[n++]
            });
        }, "ErrorOrInvalid");
        if (c === "*") {
            r.push({
                type: "ASTERISK",
                index: n,
                value: e[n++]
            });
            continue;
        }
        if (c === "+" || c === "?") {
            r.push({
                type: "OTHER_MODIFIER",
                index: n,
                value: e[n++]
            });
            continue;
        }
        if (c === "\\") {
            r.push({
                type: "ESCAPED_CHAR",
                index: n++,
                value: e[n++]
            });
            continue;
        }
        if (c === "{") {
            r.push({
                type: "OPEN",
                index: n,
                value: e[n++]
            });
            continue;
        }
        if (c === "}") {
            r.push({
                type: "CLOSE",
                index: n,
                value: e[n++]
            });
            continue;
        }
        if (c === ":") {
            let f = "", s = n + 1;
            for(; s < e.length;){
                let i = e.substr(s, 1);
                if (s === n + 1 && Re.test(i) || s !== n + 1 && Ee.test(i)) {
                    f += e[s++];
                    continue;
                }
                break;
            }
            if (!f) {
                l(`Missing parameter name at ${n}`);
                continue;
            }
            r.push({
                type: "NAME",
                index: n,
                value: f
            }), n = s;
            continue;
        }
        if (c === "(") {
            let f = 1, s = "", i = n + 1, o = !1;
            if (e[i] === "?") {
                l(`Pattern cannot start with "?" at ${i}`);
                continue;
            }
            for(; i < e.length;){
                if (!Oe(e[i], !1)) {
                    l(`Invalid character '${e[i]}' at ${i}.`), o = !0;
                    break;
                }
                if (e[i] === "\\") {
                    s += e[i++] + e[i++];
                    continue;
                }
                if (e[i] === ")") {
                    if (f--, f === 0) {
                        i++;
                        break;
                    }
                } else if (e[i] === "(" && (f++, e[i + 1] !== "?")) {
                    l(`Capturing groups are not allowed at ${i}`), o = !0;
                    break;
                }
                s += e[i++];
            }
            if (o) continue;
            if (f) {
                l(`Unbalanced pattern at ${n}`);
                continue;
            }
            if (!s) {
                l(`Missing pattern at ${n}`);
                continue;
            }
            r.push({
                type: "REGEX",
                index: n,
                value: s
            }), n = i;
            continue;
        }
        r.push({
            type: "CHAR",
            index: n,
            value: e[n++]
        });
    }
    return r.push({
        type: "END",
        index: n,
        value: ""
    }), r;
}
a(D, "lexer");
function F(e, t = {}) {
    var _t, _delimiter, _t1, _prefixes;
    let r = D(e);
    (_delimiter = (_t = t).delimiter) !== null && _delimiter !== void 0 ? _delimiter : _t.delimiter = "/#?", (_prefixes = (_t1 = t).prefixes) !== null && _prefixes !== void 0 ? _prefixes : _t1.prefixes = "./";
    let n = `[^${x(t.delimiter)}]+?`, c = [], l = 0, f = 0, s = "", i = new Set, o = a((u)=>{
        if (f < r.length && r[f].type === u) return r[f++].value;
    }, "tryConsume"), h = a(()=>{
        var _o;
        return (_o = o("OTHER_MODIFIER")) !== null && _o !== void 0 ? _o : o("ASTERISK");
    }, "tryConsumeModifier"), p = a((u)=>{
        let d = o(u);
        if (d !== void 0) return d;
        let { type: g, index: y } = r[f];
        throw new TypeError(`Unexpected ${g} at ${y}, expected ${u}`);
    }, "mustConsume"), A = a(()=>{
        var _o;
        let u = "", d;
        for(; d = (_o = o("CHAR")) !== null && _o !== void 0 ? _o : o("ESCAPED_CHAR");)u += d;
        return u;
    }, "consumeText"), xe = a((u)=>u, "DefaultEncodePart"), N = t.encodePart || xe, H = "", $ = a((u)=>{
        H += u;
    }, "appendToPendingFixedValue"), M = a(()=>{
        H.length && (c.push(new P(3, "", "", N(H), "", 3)), H = "");
    }, "maybeAddPartFromPendingFixedValue"), X = a((u, d, g, y, Z)=>{
        let m = 3;
        switch(Z){
            case "?":
                m = 1;
                break;
            case "*":
                m = 0;
                break;
            case "+":
                m = 2;
                break;
        }
        if (!d && !g && m === 3) {
            $(u);
            return;
        }
        if (M(), !d && !g) {
            if (!u) return;
            c.push(new P(3, "", "", N(u), "", m));
            return;
        }
        let S;
        g ? g === "*" ? S = v : S = g : S = n;
        let k = 2;
        S === n ? (k = 1, S = "") : S === v && (k = 0, S = "");
        let E;
        if (d ? E = d : g && (E = l++), i.has(E)) throw new TypeError(`Duplicate name '${E}'.`);
        i.add(E), c.push(new P(k, E, N(u), S, N(y), m));
    }, "addPart");
    for(; f < r.length;){
        let u = o("CHAR"), d = o("NAME"), g = o("REGEX");
        if (!d && !g && (g = o("ASTERISK")), d || g) {
            let m = u !== null && u !== void 0 ? u : "";
            t.prefixes.indexOf(m) === -1 && ($(m), m = ""), M();
            let S = h();
            X(m, d, g, "", S);
            continue;
        }
        let y = u !== null && u !== void 0 ? u : o("ESCAPED_CHAR");
        if (y) {
            $(y);
            continue;
        }
        if (o("OPEN")) {
            let m = A(), S = o("NAME"), k = o("REGEX");
            !S && !k && (k = o("ASTERISK"));
            let E = A();
            p("CLOSE");
            let be = h();
            X(m, S, k, E, be);
            continue;
        }
        M(), p("END");
    }
    return c;
}
a(F, "parse");
function x(e) {
    return e.replace(/([.+*?^${}()[\]|/\\])/g, "\\$1");
}
a(x, "escapeString");
function B(e) {
    return e && e.ignoreCase ? "ui" : "u";
}
a(B, "flags");
function q(e, t, r) {
    return W(F(e, r), t, r);
}
a(q, "stringToRegexp");
function T(e) {
    switch(e){
        case 0:
            return "*";
        case 1:
            return "?";
        case 2:
            return "+";
        case 3:
            return "";
    }
}
a(T, "modifierToString");
function W(e, t, r = {}) {
    var _r, _delimiter, _r1, _prefixes, _r2, _sensitive, _r3, _strict, _r4, _end, _r5, _start;
    (_delimiter = (_r = r).delimiter) !== null && _delimiter !== void 0 ? _delimiter : _r.delimiter = "/#?", (_prefixes = (_r1 = r).prefixes) !== null && _prefixes !== void 0 ? _prefixes : _r1.prefixes = "./", (_sensitive = (_r2 = r).sensitive) !== null && _sensitive !== void 0 ? _sensitive : _r2.sensitive = !1, (_strict = (_r3 = r).strict) !== null && _strict !== void 0 ? _strict : _r3.strict = !1, (_end = (_r4 = r).end) !== null && _end !== void 0 ? _end : _r4.end = !0, (_start = (_r5 = r).start) !== null && _start !== void 0 ? _start : _r5.start = !0, r.endsWith = "";
    let n = r.start ? "^" : "";
    for (let s of e){
        if (s.type === 3) {
            s.modifier === 3 ? n += x(s.value) : n += `(?:${x(s.value)})${T(s.modifier)}`;
            continue;
        }
        t && t.push(s.name);
        let i = `[^${x(r.delimiter)}]+?`, o = s.value;
        if (s.type === 1 ? o = i : s.type === 0 && (o = v), !s.prefix.length && !s.suffix.length) {
            s.modifier === 3 || s.modifier === 1 ? n += `(${o})${T(s.modifier)}` : n += `((?:${o})${T(s.modifier)})`;
            continue;
        }
        if (s.modifier === 3 || s.modifier === 1) {
            n += `(?:${x(s.prefix)}(${o})${x(s.suffix)})`, n += T(s.modifier);
            continue;
        }
        n += `(?:${x(s.prefix)}`, n += `((?:${o})(?:`, n += x(s.suffix), n += x(s.prefix), n += `(?:${o}))*)${x(s.suffix)})`, s.modifier === 0 && (n += "?");
    }
    let c = `[${x(r.endsWith)}]|$`, l = `[${x(r.delimiter)}]`;
    if (r.end) return r.strict || (n += `${l}?`), r.endsWith.length ? n += `(?=${c})` : n += "$", new RegExp(n, B(r));
    r.strict || (n += `(?:${l}(?=${c}))?`);
    let f = !1;
    if (e.length) {
        let s = e[e.length - 1];
        s.type === 3 && s.modifier === 3 && (f = r.delimiter.indexOf(s) > -1);
    }
    return f || (n += `(?=${l}|${c})`), new RegExp(n, B(r));
}
a(W, "partsToRegexp");
var b = {
    delimiter: "",
    prefixes: "",
    sensitive: !0,
    strict: !0
}, J = {
    delimiter: ".",
    prefixes: "",
    sensitive: !0,
    strict: !0
}, Q = {
    delimiter: "/",
    prefixes: "/",
    sensitive: !0,
    strict: !0
};
function ee(e, t) {
    return e.length ? e[0] === "/" ? !0 : !t || e.length < 2 ? !1 : (e[0] == "\\" || e[0] == "{") && e[1] == "/" : !1;
}
a(ee, "isAbsolutePathname");
function te(e, t) {
    return e.startsWith(t) ? e.substring(t.length, e.length) : e;
}
a(te, "maybeStripPrefix");
function ke(e, t) {
    return e.endsWith(t) ? e.substr(0, e.length - t.length) : e;
}
a(ke, "maybeStripSuffix");
function _(e) {
    return !e || e.length < 2 ? !1 : e[0] === "[" || (e[0] === "\\" || e[0] === "{") && e[1] === "[";
}
a(_, "treatAsIPv6Hostname");
var re = [
    "ftp",
    "file",
    "http",
    "https",
    "ws",
    "wss"
];
function U(e) {
    if (!e) return !0;
    for (let t of re)if (e.test(t)) return !0;
    return !1;
}
a(U, "isSpecialScheme");
function ne(e, t) {
    if (e = te(e, "#"), t || e === "") return e;
    let r = new URL("https://example.com");
    return r.hash = e, r.hash ? r.hash.substring(1, r.hash.length) : "";
}
a(ne, "canonicalizeHash");
function se(e, t) {
    if (e = te(e, "?"), t || e === "") return e;
    let r = new URL("https://example.com");
    return r.search = e, r.search ? r.search.substring(1, r.search.length) : "";
}
a(se, "canonicalizeSearch");
function ie(e, t) {
    return t || e === "" ? e : _(e) ? K(e) : j(e);
}
a(ie, "canonicalizeHostname");
function ae(e, t) {
    if (t || e === "") return e;
    let r = new URL("https://example.com");
    return r.password = e, r.password;
}
a(ae, "canonicalizePassword");
function oe(e, t) {
    if (t || e === "") return e;
    let r = new URL("https://example.com");
    return r.username = e, r.username;
}
a(oe, "canonicalizeUsername");
function ce(e, t, r) {
    if (r || e === "") return e;
    if (t && !re.includes(t)) return new URL(`${t}:${e}`).pathname;
    let n = e[0] == "/";
    return e = new URL(n ? e : "/-" + e, "https://example.com").pathname, n || (e = e.substring(2, e.length)), e;
}
a(ce, "canonicalizePathname");
function le(e, t, r) {
    return z(t) === e && (e = ""), r || e === "" ? e : G(e);
}
a(le, "canonicalizePort");
function fe(e, t) {
    return e = ke(e, ":"), t || e === "" ? e : w(e);
}
a(fe, "canonicalizeProtocol");
function z(e) {
    switch(e){
        case "ws":
        case "http":
            return "80";
        case "wws":
        case "https":
            return "443";
        case "ftp":
            return "21";
        default:
            return "";
    }
}
a(z, "defaultPortForProtocol");
function w(e) {
    if (e === "") return e;
    if (/^[-+.A-Za-z0-9]*$/.test(e)) return e.toLowerCase();
    throw new TypeError(`Invalid protocol '${e}'.`);
}
a(w, "protocolEncodeCallback");
function he(e) {
    if (e === "") return e;
    let t = new URL("https://example.com");
    return t.username = e, t.username;
}
a(he, "usernameEncodeCallback");
function ue(e) {
    if (e === "") return e;
    let t = new URL("https://example.com");
    return t.password = e, t.password;
}
a(ue, "passwordEncodeCallback");
function j(e) {
    if (e === "") return e;
    if (/[\t\n\r #%/:<>?@[\]^\\|]/g.test(e)) throw new TypeError(`Invalid hostname '${e}'`);
    let t = new URL("https://example.com");
    return t.hostname = e, t.hostname;
}
a(j, "hostnameEncodeCallback");
function K(e) {
    if (e === "") return e;
    if (/[^0-9a-fA-F[\]:]/g.test(e)) throw new TypeError(`Invalid IPv6 hostname '${e}'`);
    return e.toLowerCase();
}
a(K, "ipv6HostnameEncodeCallback");
function G(e) {
    if (e === "" || /^[0-9]*$/.test(e) && parseInt(e) <= 65535) return e;
    throw new TypeError(`Invalid port '${e}'.`);
}
a(G, "portEncodeCallback");
function de(e) {
    if (e === "") return e;
    let t = new URL("https://example.com");
    return t.pathname = e[0] !== "/" ? "/-" + e : e, e[0] !== "/" ? t.pathname.substring(2, t.pathname.length) : t.pathname;
}
a(de, "standardURLPathnameEncodeCallback");
function pe(e) {
    return e === "" ? e : new URL(`data:${e}`).pathname;
}
a(pe, "pathURLPathnameEncodeCallback");
function ge(e) {
    if (e === "") return e;
    let t = new URL("https://example.com");
    return t.search = e, t.search.substring(1, t.search.length);
}
a(ge, "searchEncodeCallback");
function me(e) {
    if (e === "") return e;
    let t = new URL("https://example.com");
    return t.hash = e, t.hash.substring(1, t.hash.length);
}
a(me, "hashEncodeCallback");
var C = (_i = /*#__PURE__*/ new WeakMap(), _n = /*#__PURE__*/ new WeakMap(), urlpattern_t = /*#__PURE__*/ new WeakMap(), _e = /*#__PURE__*/ new WeakMap(), _s = /*#__PURE__*/ new WeakMap(), _l = /*#__PURE__*/ new WeakMap(), urlpattern_o = /*#__PURE__*/ new WeakMap(), _d = /*#__PURE__*/ new WeakMap(), _p = /*#__PURE__*/ new WeakMap(), _g = /*#__PURE__*/ new WeakMap(), urlpattern_r = /*#__PURE__*/ new WeakSet(), _R = /*#__PURE__*/ new WeakSet(), _b = /*#__PURE__*/ new WeakSet(), _u = /*#__PURE__*/ new WeakSet(), _m = /*#__PURE__*/ new WeakSet(), _a = /*#__PURE__*/ new WeakSet(), _P = /*#__PURE__*/ new WeakSet(), _E = /*#__PURE__*/ new WeakSet(), _S = /*#__PURE__*/ new WeakSet(), _O = /*#__PURE__*/ new WeakSet(), _k = /*#__PURE__*/ new WeakSet(), _x = /*#__PURE__*/ new WeakSet(), _h = /*#__PURE__*/ new WeakSet(), _f = /*#__PURE__*/ new WeakSet(), _T = /*#__PURE__*/ new WeakSet(), _A = /*#__PURE__*/ new WeakSet(), _y = /*#__PURE__*/ new WeakSet(), _w = /*#__PURE__*/ new WeakSet(), _c = /*#__PURE__*/ new WeakSet(), _C = /*#__PURE__*/ new WeakSet(), _class = class {
    get result() {
        return _class_private_field_get(this, urlpattern_t);
    }
    parse() {
        for(_class_private_field_set(this, _n, D(_class_private_field_get(this, _i), !0)); _class_private_field_get(this, _e) < _class_private_field_get(this, _n).length; _class_private_field_set(this, _e, _class_private_field_get(this, _e) + _class_private_field_get(this, _s))){
            if (_class_private_field_set(this, _s, 1), _class_private_field_get(this, _n)[_class_private_field_get(this, _e)].type === "END") {
                if (_class_private_field_get(this, urlpattern_o) === 0) {
                    _class_private_method_get(this, _b, b1).call(this), _class_private_method_get(this, _f, urlpattern_f).call(this) ? _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 9, 1) : _class_private_method_get(this, _h, urlpattern_h).call(this) ? _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 8, 1) : _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 7, 0);
                    continue;
                } else if (_class_private_field_get(this, urlpattern_o) === 2) {
                    _class_private_method_get(this, _u, urlpattern_u).call(this, 5);
                    continue;
                }
                _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 10, 0);
                break;
            }
            if (_class_private_field_get(this, _d) > 0) if (_class_private_method_get(this, _A, urlpattern_A).call(this)) _class_private_field_set(this, _d, _class_private_field_get(this, _d) - 1);
            else continue;
            if (_class_private_method_get(this, _T, T1).call(this)) {
                _class_private_field_set(this, _d, _class_private_field_get(this, _d) + 1);
                continue;
            }
            switch(_class_private_field_get(this, urlpattern_o)){
                case 0:
                    _class_private_method_get(this, _P, P1).call(this) && _class_private_method_get(this, _u, urlpattern_u).call(this, 1);
                    break;
                case 1:
                    if (_class_private_method_get(this, _P, P1).call(this)) {
                        _class_private_method_get(this, _C, C1).call(this);
                        let t = 7, r1 = 1;
                        _class_private_method_get(this, _E, urlpattern_E).call(this) ? (t = 2, r1 = 3) : _class_private_field_get(this, _g) && (t = 2), _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, t, r1);
                    }
                    break;
                case 2:
                    _class_private_method_get(this, _S, urlpattern_S).call(this) ? _class_private_method_get(this, _u, urlpattern_u).call(this, 3) : (_class_private_method_get(this, _x, x1).call(this) || _class_private_method_get(this, _h, urlpattern_h).call(this) || _class_private_method_get(this, _f, urlpattern_f).call(this)) && _class_private_method_get(this, _u, urlpattern_u).call(this, 5);
                    break;
                case 3:
                    _class_private_method_get(this, _O, O1).call(this) ? _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 4, 1) : _class_private_method_get(this, _S, urlpattern_S).call(this) && _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 5, 1);
                    break;
                case 4:
                    _class_private_method_get(this, _S, urlpattern_S).call(this) && _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 5, 1);
                    break;
                case 5:
                    _class_private_method_get(this, _y, urlpattern_y).call(this) ? _class_private_field_set(this, _p, _class_private_field_get(this, _p) + 1) : _class_private_method_get(this, _w, w1).call(this) && _class_private_field_set(this, _p, _class_private_field_get(this, _p) - 1), _class_private_method_get(this, _k, urlpattern_k).call(this) && !_class_private_field_get(this, _p) ? _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 6, 1) : _class_private_method_get(this, _x, x1).call(this) ? _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 7, 0) : _class_private_method_get(this, _h, urlpattern_h).call(this) ? _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 8, 1) : _class_private_method_get(this, _f, urlpattern_f).call(this) && _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 9, 1);
                    break;
                case 6:
                    _class_private_method_get(this, _x, x1).call(this) ? _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 7, 0) : _class_private_method_get(this, _h, urlpattern_h).call(this) ? _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 8, 1) : _class_private_method_get(this, _f, urlpattern_f).call(this) && _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 9, 1);
                    break;
                case 7:
                    _class_private_method_get(this, _h, urlpattern_h).call(this) ? _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 8, 1) : _class_private_method_get(this, _f, urlpattern_f).call(this) && _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 9, 1);
                    break;
                case 8:
                    _class_private_method_get(this, _f, urlpattern_f).call(this) && _class_private_method_get(this, urlpattern_r, dist_urlpattern_r).call(this, 9, 1);
                    break;
                case 9:
                    break;
                case 10:
                    break;
            }
        }
        _class_private_field_get(this, urlpattern_t).hostname !== void 0 && _class_private_field_get(this, urlpattern_t).port === void 0 && (_class_private_field_get(this, urlpattern_t).port = "");
    }
    constructor(t){
        _class_private_method_init(this, urlpattern_r);
        _class_private_method_init(this, _R);
        _class_private_method_init(this, _b);
        _class_private_method_init(this, _u);
        _class_private_method_init(this, _m);
        _class_private_method_init(this, _a);
        _class_private_method_init(this, _P);
        _class_private_method_init(this, _E);
        _class_private_method_init(this, _S);
        _class_private_method_init(this, _O);
        _class_private_method_init(this, _k);
        _class_private_method_init(this, _x);
        _class_private_method_init(this, _h);
        _class_private_method_init(this, _f);
        _class_private_method_init(this, _T);
        _class_private_method_init(this, _A);
        _class_private_method_init(this, _y);
        _class_private_method_init(this, _w);
        _class_private_method_init(this, _c);
        _class_private_method_init(this, _C);
        _class_private_field_init(this, _i, {
            writable: true,
            value: void 0
        });
        _class_private_field_init(this, _n, {
            writable: true,
            value: []
        });
        _class_private_field_init(this, urlpattern_t, {
            writable: true,
            value: {}
        });
        _class_private_field_init(this, _e, {
            writable: true,
            value: 0
        });
        _class_private_field_init(this, _s, {
            writable: true,
            value: 1
        });
        _class_private_field_init(this, _l, {
            writable: true,
            value: 0
        });
        _class_private_field_init(this, urlpattern_o, {
            writable: true,
            value: 0
        });
        _class_private_field_init(this, _d, {
            writable: true,
            value: 0
        });
        _class_private_field_init(this, _p, {
            writable: true,
            value: 0
        });
        _class_private_field_init(this, _g, {
            writable: true,
            value: !1
        });
        _class_private_field_set(this, _i, t);
    }
}, _class);
a(C, "Parser");
var V = [
    "protocol",
    "username",
    "password",
    "hostname",
    "port",
    "pathname",
    "search",
    "hash"
], O = "*";
function Se(e, t) {
    if (typeof e != "string") throw new TypeError("parameter 1 is not of type 'string'.");
    let r = new URL(e, t);
    return {
        protocol: r.protocol.substring(0, r.protocol.length - 1),
        username: r.username,
        password: r.password,
        hostname: r.hostname,
        port: r.port,
        pathname: r.pathname,
        search: r.search !== "" ? r.search.substring(1, r.search.length) : void 0,
        hash: r.hash !== "" ? r.hash.substring(1, r.hash.length) : void 0
    };
}
a(Se, "extractValues");
function R(e, t) {
    return t ? I(e) : e;
}
a(R, "processBaseURLString");
function L(e, t, r) {
    let n;
    if (typeof t.baseURL == "string") try {
        n = new URL(t.baseURL), t.protocol === void 0 && (e.protocol = R(n.protocol.substring(0, n.protocol.length - 1), r)), !r && t.protocol === void 0 && t.hostname === void 0 && t.port === void 0 && t.username === void 0 && (e.username = R(n.username, r)), !r && t.protocol === void 0 && t.hostname === void 0 && t.port === void 0 && t.username === void 0 && t.password === void 0 && (e.password = R(n.password, r)), t.protocol === void 0 && t.hostname === void 0 && (e.hostname = R(n.hostname, r)), t.protocol === void 0 && t.hostname === void 0 && t.port === void 0 && (e.port = R(n.port, r)), t.protocol === void 0 && t.hostname === void 0 && t.port === void 0 && t.pathname === void 0 && (e.pathname = R(n.pathname, r)), t.protocol === void 0 && t.hostname === void 0 && t.port === void 0 && t.pathname === void 0 && t.search === void 0 && (e.search = R(n.search.substring(1, n.search.length), r)), t.protocol === void 0 && t.hostname === void 0 && t.port === void 0 && t.pathname === void 0 && t.search === void 0 && t.hash === void 0 && (e.hash = R(n.hash.substring(1, n.hash.length), r));
    } catch  {
        throw new TypeError(`invalid baseURL '${t.baseURL}'.`);
    }
    if (typeof t.protocol == "string" && (e.protocol = fe(t.protocol, r)), typeof t.username == "string" && (e.username = oe(t.username, r)), typeof t.password == "string" && (e.password = ae(t.password, r)), typeof t.hostname == "string" && (e.hostname = ie(t.hostname, r)), typeof t.port == "string" && (e.port = le(t.port, e.protocol, r)), typeof t.pathname == "string") {
        if (e.pathname = t.pathname, n && !ee(e.pathname, r)) {
            let c = n.pathname.lastIndexOf("/");
            c >= 0 && (e.pathname = R(n.pathname.substring(0, c + 1), r) + e.pathname);
        }
        e.pathname = ce(e.pathname, e.protocol, r);
    }
    return typeof t.search == "string" && (e.search = se(t.search, r)), typeof t.hash == "string" && (e.hash = ne(t.hash, r)), e;
}
a(L, "applyInit");
function I(e) {
    return e.replace(/([+*?:{}()\\])/g, "\\$1");
}
a(I, "escapePatternString");
function Te(e) {
    return e.replace(/([.+*?^${}()[\]|/\\])/g, "\\$1");
}
a(Te, "escapeRegexpString");
function Ae(e, t) {
    var _t, _delimiter, _t1, _prefixes, _t2, _sensitive, _t3, _strict, _t4, _end, _t5, _start;
    (_delimiter = (_t = t).delimiter) !== null && _delimiter !== void 0 ? _delimiter : _t.delimiter = "/#?", (_prefixes = (_t1 = t).prefixes) !== null && _prefixes !== void 0 ? _prefixes : _t1.prefixes = "./", (_sensitive = (_t2 = t).sensitive) !== null && _sensitive !== void 0 ? _sensitive : _t2.sensitive = !1, (_strict = (_t3 = t).strict) !== null && _strict !== void 0 ? _strict : _t3.strict = !1, (_end = (_t4 = t).end) !== null && _end !== void 0 ? _end : _t4.end = !0, (_start = (_t5 = t).start) !== null && _start !== void 0 ? _start : _t5.start = !0, t.endsWith = "";
    let r = ".*", n = `[^${Te(t.delimiter)}]+?`, c = /[\$0-9A-Z_a-z\xAA\xB5\xB7\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0558\u0559\u0560-\u0588\u058B\u058C\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7-\u05C9\u05D0-\u05EA\u05EF-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u07FD\u0800-\u082D\u0840-\u085B\u0860-\u086A\u0870-\u0887\u0889-\u088F\u0897-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u09FC\u09FE\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9-\u0AFF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B53-\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3C-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C5C\u0C5D\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDC-\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1-\u0CF3\u0D00-\u0D0C\u0D0E-\u0D10\u0D12-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D81-\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECE\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1369-\u1371\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u1715\u171F-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u180F-\u1819\u1820-\u1878\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1ABF-\u1AF0\u1B00-\u1B4C\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C8A\u1C90-\u1CBA\u1CBD-\u1CBF\u1CD0-\u1CD2\u1CD4-\u1CFA\u1D00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u208F-\u209F\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099-\u309F\u30A1-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7DD\uA7E2\uA7F1-\uA827\uA82C\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB6C\uAB6D\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF65-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC\u{10000}-\u{1000B}\u{1000D}-\u{10026}\u{10028}-\u{1003A}\u{1003C}\u{1003D}\u{1003F}-\u{1004D}\u{10050}-\u{1005D}\u{10080}-\u{100FA}\u{10140}-\u{10174}\u{101FD}\u{10280}-\u{1029C}\u{102A0}-\u{102D0}\u{102E0}\u{10300}-\u{1031F}\u{1032D}-\u{1034A}\u{10350}-\u{1037A}\u{10380}-\u{1039D}\u{103A0}-\u{103C3}\u{103C8}-\u{103CF}\u{103D1}-\u{103D5}\u{10400}-\u{1049D}\u{104A0}-\u{104A9}\u{104B0}-\u{104D3}\u{104D8}-\u{104FB}\u{10500}-\u{10527}\u{10530}-\u{10563}\u{10570}-\u{1057A}\u{1057C}-\u{1058A}\u{1058C}-\u{10592}\u{10594}\u{10595}\u{10597}-\u{105A1}\u{105A3}-\u{105B1}\u{105B3}-\u{105B9}\u{105BB}\u{105BC}\u{105C0}-\u{105F3}\u{10600}-\u{10736}\u{10740}-\u{10755}\u{10760}-\u{10767}\u{10780}-\u{10785}\u{10787}-\u{107B0}\u{107B2}-\u{107BF}\u{10800}-\u{10805}\u{10808}\u{1080A}-\u{10835}\u{10837}\u{10838}\u{1083C}\u{1083F}-\u{10855}\u{10860}-\u{10876}\u{10880}-\u{1089E}\u{108E0}-\u{108F2}\u{108F4}\u{108F5}\u{10900}-\u{10915}\u{10920}-\u{10939}\u{10940}-\u{10959}\u{10980}-\u{109B7}\u{109BE}\u{109BF}\u{10A00}-\u{10A03}\u{10A05}\u{10A06}\u{10A0C}-\u{10A13}\u{10A15}-\u{10A17}\u{10A19}-\u{10A35}\u{10A38}-\u{10A3A}\u{10A3F}\u{10A60}-\u{10A7C}\u{10A80}-\u{10A9C}\u{10AC0}-\u{10AC7}\u{10AC9}-\u{10AE6}\u{10B00}-\u{10B35}\u{10B40}-\u{10B55}\u{10B60}-\u{10B72}\u{10B80}-\u{10B91}\u{10C00}-\u{10C48}\u{10C80}-\u{10CB2}\u{10CC0}-\u{10CF2}\u{10D00}-\u{10D27}\u{10D30}-\u{10D39}\u{10D40}-\u{10D65}\u{10D69}-\u{10D6D}\u{10D6F}-\u{10D85}\u{10E80}-\u{10EA9}\u{10EAB}\u{10EAC}\u{10EB0}\u{10EB1}\u{10EC2}-\u{10EC7}\u{10ECB}-\u{10ECF}\u{10ED9}-\u{10EEE}\u{10EF0}-\u{10F1C}\u{10F27}\u{10F30}-\u{10F50}\u{10F70}-\u{10F85}\u{10FB0}-\u{10FC4}\u{10FE0}-\u{10FF6}\u{11000}-\u{11046}\u{11066}-\u{11075}\u{1107F}-\u{110BA}\u{110C2}\u{110D0}-\u{110E8}\u{110F0}-\u{110F9}\u{11100}-\u{11134}\u{11136}-\u{1113F}\u{11144}-\u{11147}\u{11150}-\u{11173}\u{11176}\u{11180}-\u{111C4}\u{111C9}-\u{111CC}\u{111CE}-\u{111DA}\u{111DC}\u{11200}-\u{11211}\u{11213}-\u{11237}\u{1123E}-\u{11241}\u{11280}-\u{11286}\u{11288}\u{1128A}-\u{1128D}\u{1128F}-\u{1129D}\u{1129F}-\u{112A8}\u{112B0}-\u{112EA}\u{112F0}-\u{112F9}\u{11300}-\u{11303}\u{11305}-\u{1130C}\u{1130F}\u{11310}\u{11313}-\u{11328}\u{1132A}-\u{11330}\u{11332}\u{11333}\u{11335}-\u{11339}\u{1133B}-\u{11344}\u{11347}\u{11348}\u{1134B}-\u{1134D}\u{11350}\u{11357}\u{1135D}-\u{11363}\u{11366}-\u{1136C}\u{11370}-\u{11374}\u{11380}-\u{11389}\u{1138B}\u{1138E}\u{11390}-\u{113B5}\u{113B7}-\u{113C0}\u{113C2}\u{113C5}\u{113C7}-\u{113CA}\u{113CC}-\u{113D3}\u{113E1}\u{113E2}\u{11400}-\u{1144A}\u{11450}-\u{11459}\u{1145E}-\u{11461}\u{11480}-\u{114C5}\u{114C7}\u{114D0}-\u{114D9}\u{11580}-\u{115B5}\u{115B8}-\u{115C0}\u{115D8}-\u{115DD}\u{11600}-\u{11640}\u{11644}\u{11650}-\u{11659}\u{11680}-\u{116B8}\u{116C0}-\u{116C9}\u{116D0}-\u{116E3}\u{11700}-\u{1171A}\u{1171D}-\u{1172B}\u{11730}-\u{11739}\u{11740}-\u{11746}\u{11800}-\u{1183A}\u{118A0}-\u{118E9}\u{118FF}-\u{11906}\u{11909}\u{1190C}-\u{11913}\u{11915}\u{11916}\u{11918}-\u{11935}\u{11937}\u{11938}\u{1193B}-\u{11943}\u{11950}-\u{11959}\u{119A0}-\u{119A7}\u{119AA}-\u{119D7}\u{119DA}-\u{119E1}\u{119E3}\u{119E4}\u{11A00}-\u{11A3E}\u{11A47}\u{11A50}-\u{11A99}\u{11A9D}\u{11AB0}-\u{11AF8}\u{11B0A}\u{11B60}-\u{11B67}\u{11BC0}-\u{11BE0}\u{11BF0}-\u{11BF9}\u{11C00}-\u{11C08}\u{11C0A}-\u{11C36}\u{11C38}-\u{11C40}\u{11C50}-\u{11C59}\u{11C72}-\u{11C8F}\u{11C92}-\u{11CA7}\u{11CA9}-\u{11CB6}\u{11D00}-\u{11D06}\u{11D08}\u{11D09}\u{11D0B}-\u{11D36}\u{11D3A}\u{11D3C}\u{11D3D}\u{11D3F}-\u{11D47}\u{11D50}-\u{11D59}\u{11D60}-\u{11D65}\u{11D67}\u{11D68}\u{11D6A}-\u{11D8E}\u{11D90}\u{11D91}\u{11D93}-\u{11D98}\u{11DA0}-\u{11DA9}\u{11DB0}-\u{11DDB}\u{11DE0}-\u{11DE9}\u{11DF0}\u{11DF1}\u{11EE0}-\u{11EF6}\u{11F00}-\u{11F10}\u{11F12}-\u{11F3A}\u{11F3E}-\u{11F42}\u{11F50}-\u{11F5A}\u{11FB0}\u{12000}-\u{12399}\u{12400}-\u{1246F}\u{12475}-\u{12543}\u{12550}-\u{12686}\u{12F90}-\u{12FF0}\u{13000}-\u{1342F}\u{13440}-\u{13455}\u{13460}-\u{143FA}\u{14400}-\u{14646}\u{16100}-\u{16139}\u{16800}-\u{16A38}\u{16A40}-\u{16A5E}\u{16A60}-\u{16A69}\u{16A70}-\u{16ABE}\u{16AC0}-\u{16AC9}\u{16AD0}-\u{16AED}\u{16AF0}-\u{16AF4}\u{16B00}-\u{16B36}\u{16B40}-\u{16B43}\u{16B50}-\u{16B59}\u{16B63}-\u{16B77}\u{16B7D}-\u{16B8F}\u{16D40}-\u{16D6C}\u{16D70}-\u{16D79}\u{16E40}-\u{16E7F}\u{16EA0}-\u{16EB8}\u{16EBB}-\u{16ED3}\u{16F00}-\u{16F4A}\u{16F4F}-\u{16F87}\u{16F8F}-\u{16F9F}\u{16FE0}\u{16FE1}\u{16FE3}\u{16FE4}\u{16FF0}-\u{16FF6}\u{17000}-\u{18CDA}\u{18CFF}-\u{18D20}\u{18D80}-\u{18DF2}\u{18E00}-\u{19191}\u{191A0}-\u{191D2}\u{1AFF0}-\u{1AFF3}\u{1AFF5}-\u{1AFFB}\u{1AFFD}\u{1AFFE}\u{1B000}-\u{1B128}\u{1B132}\u{1B150}-\u{1B152}\u{1B155}\u{1B164}-\u{1B168}\u{1B170}-\u{1B2FB}\u{1BC00}-\u{1BC6A}\u{1BC70}-\u{1BC7C}\u{1BC80}-\u{1BC88}\u{1BC90}-\u{1BC99}\u{1BC9D}\u{1BC9E}\u{1CCF0}-\u{1CCF9}\u{1CF00}-\u{1CF2D}\u{1CF30}-\u{1CF46}\u{1D127}\u{1D128}\u{1D165}-\u{1D169}\u{1D16D}-\u{1D172}\u{1D17B}-\u{1D182}\u{1D185}-\u{1D18B}\u{1D1AA}-\u{1D1AD}\u{1D242}-\u{1D244}\u{1D250}-\u{1D252}\u{1D25B}\u{1D25C}\u{1D25F}\u{1D280}\u{1D281}\u{1D400}-\u{1D454}\u{1D456}-\u{1D49C}\u{1D49E}\u{1D49F}\u{1D4A2}\u{1D4A5}\u{1D4A6}\u{1D4A9}-\u{1D4AC}\u{1D4AE}-\u{1D4B9}\u{1D4BB}\u{1D4BD}-\u{1D4C3}\u{1D4C5}-\u{1D505}\u{1D507}-\u{1D50A}\u{1D50D}-\u{1D514}\u{1D516}-\u{1D51C}\u{1D51E}-\u{1D539}\u{1D53B}-\u{1D53E}\u{1D540}-\u{1D544}\u{1D546}\u{1D54A}-\u{1D550}\u{1D552}-\u{1D6A6}\u{1D6A8}-\u{1D6C0}\u{1D6C2}-\u{1D6DA}\u{1D6DC}-\u{1D6FA}\u{1D6FC}-\u{1D714}\u{1D716}-\u{1D734}\u{1D736}-\u{1D74E}\u{1D750}-\u{1D76E}\u{1D770}-\u{1D788}\u{1D78A}-\u{1D7A8}\u{1D7AA}-\u{1D7C2}\u{1D7C4}-\u{1D7CB}\u{1D7CE}-\u{1D7FF}\u{1DA00}-\u{1DA36}\u{1DA3B}-\u{1DA6C}\u{1DA75}\u{1DA84}\u{1DA9B}-\u{1DA9F}\u{1DAA1}-\u{1DAAF}\u{1DF00}-\u{1DF81}\u{1DF90}-\u{1DF96}\u{1DFCD}-\u{1E006}\u{1E008}-\u{1E018}\u{1E01B}-\u{1E021}\u{1E023}\u{1E024}\u{1E026}-\u{1E02A}\u{1E030}-\u{1E06D}\u{1E08F}\u{1E100}-\u{1E12C}\u{1E130}-\u{1E13D}\u{1E140}-\u{1E149}\u{1E14E}\u{1E290}-\u{1E2AE}\u{1E2C0}-\u{1E2F9}\u{1E4D0}-\u{1E4F9}\u{1E5D0}-\u{1E5FA}\u{1E6C0}-\u{1E6DE}\u{1E6E0}-\u{1E6F5}\u{1E6FE}\u{1E6FF}\u{1E7E0}-\u{1E7E6}\u{1E7E8}-\u{1E7EB}\u{1E7ED}\u{1E7EE}\u{1E7F0}-\u{1E7FE}\u{1E800}-\u{1E8C4}\u{1E8D0}-\u{1E8D6}\u{1E900}-\u{1E94B}\u{1E950}-\u{1E959}\u{1EE00}-\u{1EE03}\u{1EE05}-\u{1EE1F}\u{1EE21}\u{1EE22}\u{1EE24}\u{1EE27}\u{1EE29}-\u{1EE32}\u{1EE34}-\u{1EE37}\u{1EE39}\u{1EE3B}\u{1EE42}\u{1EE47}\u{1EE49}\u{1EE4B}\u{1EE4D}-\u{1EE4F}\u{1EE51}\u{1EE52}\u{1EE54}\u{1EE57}\u{1EE59}\u{1EE5B}\u{1EE5D}\u{1EE5F}\u{1EE61}\u{1EE62}\u{1EE64}\u{1EE67}-\u{1EE6A}\u{1EE6C}-\u{1EE72}\u{1EE74}-\u{1EE77}\u{1EE79}-\u{1EE7C}\u{1EE7E}\u{1EE80}-\u{1EE89}\u{1EE8B}-\u{1EE9B}\u{1EEA1}-\u{1EEA3}\u{1EEA5}-\u{1EEA9}\u{1EEAB}-\u{1EEBB}\u{1FBF0}-\u{1FBF9}\u{20000}-\u{2A6DF}\u{2A700}-\u{2B81E}\u{2B820}-\u{2CEAD}\u{2CEB0}-\u{2EBE0}\u{2EBF0}-\u{2EE5D}\u{2F800}-\u{2FA1D}\u{30000}-\u{3134A}\u{31350}-\u{33479}\u{3D000}-\u{3FC3F}\u{E0100}-\u{E01EF}]/u, l = "";
    for(let f = 0; f < e.length; ++f){
        let s = e[f];
        if (s.type === 3) {
            if (s.modifier === 3) {
                l += I(s.value);
                continue;
            }
            l += `{${I(s.value)}}${T(s.modifier)}`;
            continue;
        }
        let i = s.hasCustomName(), o = !!s.suffix.length || !!s.prefix.length && (s.prefix.length !== 1 || !t.prefixes.includes(s.prefix)), h = f > 0 ? e[f - 1] : null, p = f < e.length - 1 ? e[f + 1] : null;
        if (!o && i && s.type === 1 && s.modifier === 3 && p && !p.prefix.length && !p.suffix.length) if (p.type === 3) {
            let A = p.value.length > 0 ? p.value[0] : "";
            o = c.test(A);
        } else o = !p.hasCustomName();
        if (!o && !s.prefix.length && h && h.type === 3) {
            let A = h.value[h.value.length - 1];
            o = t.prefixes.includes(A);
        }
        o && (l += "{"), l += I(s.prefix), i && (l += `:${s.name}`), s.type === 2 ? l += `(${s.value})` : s.type === 1 ? i || (l += `(${n})`) : s.type === 0 && (!i && (!h || h.type === 3 || h.modifier !== 3 || o || s.prefix !== "") ? l += "*" : l += `(${r})`), s.type === 1 && i && s.suffix.length && c.test(s.suffix[0]) && (l += "\\"), l += I(s.suffix), o && (l += "}"), s.modifier !== 3 && (l += T(s.modifier));
    }
    return l;
}
a(Ae, "partsToPattern");
var Y = (_i1 = /*#__PURE__*/ new WeakMap(), _n1 = /*#__PURE__*/ new WeakMap(), urlpattern_t1 = /*#__PURE__*/ new WeakMap(), _e1 = /*#__PURE__*/ new WeakMap(), _s1 = /*#__PURE__*/ new WeakMap(), _l1 = /*#__PURE__*/ new WeakMap(), class {
    get [Symbol.toStringTag]() {
        return "URLPattern";
    }
    test(t = {}, r) {
        let n = {
            pathname: "",
            protocol: "",
            username: "",
            password: "",
            hostname: "",
            port: "",
            search: "",
            hash: ""
        };
        if (typeof t != "string" && r) throw new TypeError("parameter 1 is not of type 'string'.");
        if (typeof t > "u") return !1;
        try {
            typeof t == "object" ? n = L(n, t, !1) : n = L(n, Se(t, r), !1);
        } catch  {
            return !1;
        }
        let c;
        for (c of V)if (!_class_private_field_get(this, _n1)[c].exec(n[c])) return !1;
        return !0;
    }
    exec(t = {}, r) {
        let n = {
            pathname: "",
            protocol: "",
            username: "",
            password: "",
            hostname: "",
            port: "",
            search: "",
            hash: ""
        };
        if (typeof t != "string" && r) throw new TypeError("parameter 1 is not of type 'string'.");
        if (typeof t > "u") return;
        try {
            typeof t == "object" ? n = L(n, t, !1) : n = L(n, Se(t, r), !1);
        } catch  {
            return null;
        }
        let c = {};
        r ? c.inputs = [
            t,
            r
        ] : c.inputs = [
            t
        ];
        let l;
        for (l of V){
            var _n_l;
            let f = _class_private_field_get(this, _n1)[l].exec(n[l]);
            if (!f) return null;
            let s = {};
            for (let [i, o] of _class_private_field_get(this, urlpattern_t1)[l].entries())if (typeof o == "string" || typeof o == "number") {
                let h = f[i + 1];
                s[o] = h;
            }
            c[l] = {
                input: (_n_l = n[l]) !== null && _n_l !== void 0 ? _n_l : "",
                groups: s
            };
        }
        return c;
    }
    static compareComponent(t, r, n) {
        let c = a((i, o)=>{
            for (let h of [
                "type",
                "modifier",
                "prefix",
                "value",
                "suffix"
            ]){
                if (i[h] < o[h]) return -1;
                if (i[h] === o[h]) continue;
                return 1;
            }
            return 0;
        }, "comparePart"), l = new P(3, "", "", "", "", 3), f = new P(0, "", "", "", "", 3), s = a((i, o)=>{
            var _i_h, _o_h;
            let h = 0;
            for(; h < Math.min(i.length, o.length); ++h){
                let p = c(i[h], o[h]);
                if (p) return p;
            }
            return i.length === o.length ? 0 : c((_i_h = i[h]) !== null && _i_h !== void 0 ? _i_h : l, (_o_h = o[h]) !== null && _o_h !== void 0 ? _o_h : l);
        }, "comparePartList");
        return !_class_private_field_get(r, _e1)[t] && !_class_private_field_get(n, _e1)[t] ? 0 : _class_private_field_get(r, _e1)[t] && !_class_private_field_get(n, _e1)[t] ? s(_class_private_field_get(r, _s1)[t], [
            f
        ]) : !_class_private_field_get(r, _e1)[t] && _class_private_field_get(n, _e1)[t] ? s([
            f
        ], _class_private_field_get(n, _s1)[t]) : s(_class_private_field_get(r, _s1)[t], _class_private_field_get(n, _s1)[t]);
    }
    get protocol() {
        return _class_private_field_get(this, _e1).protocol;
    }
    get username() {
        return _class_private_field_get(this, _e1).username;
    }
    get password() {
        return _class_private_field_get(this, _e1).password;
    }
    get hostname() {
        return _class_private_field_get(this, _e1).hostname;
    }
    get port() {
        return _class_private_field_get(this, _e1).port;
    }
    get pathname() {
        return _class_private_field_get(this, _e1).pathname;
    }
    get search() {
        return _class_private_field_get(this, _e1).search;
    }
    get hash() {
        return _class_private_field_get(this, _e1).hash;
    }
    get hasRegExpGroups() {
        return _class_private_field_get(this, _l1);
    }
    constructor(t = {}, r, n){
        _class_private_field_init(this, _i1, {
            writable: true,
            value: void 0
        });
        _class_private_field_init(this, _n1, {
            writable: true,
            value: {}
        });
        _class_private_field_init(this, urlpattern_t1, {
            writable: true,
            value: {}
        });
        _class_private_field_init(this, _e1, {
            writable: true,
            value: {}
        });
        _class_private_field_init(this, _s1, {
            writable: true,
            value: {}
        });
        _class_private_field_init(this, _l1, {
            writable: true,
            value: !1
        });
        try {
            let c;
            if (typeof r == "string" ? c = r : n = r, typeof t == "string") {
                let i = new C(t);
                if (i.parse(), t = i.result, c === void 0 && typeof t.protocol != "string") throw new TypeError("A base URL must be provided for a relative constructor string.");
                t.baseURL = c;
            } else {
                if (!t || typeof t != "object") throw new TypeError("parameter 1 is not of type 'string' and cannot convert to dictionary.");
                if (c) throw new TypeError("parameter 1 is not of type 'string'.");
            }
            typeof n > "u" && (n = {
                ignoreCase: !1
            });
            let l = {
                ignoreCase: n.ignoreCase === !0
            }, f = {
                pathname: O,
                protocol: O,
                username: O,
                password: O,
                hostname: O,
                port: O,
                search: O,
                hash: O
            };
            _class_private_field_set(this, _i1, L(f, t, !0)), z(_class_private_field_get(this, _i1).protocol) === _class_private_field_get(this, _i1).port && (_class_private_field_get(this, _i1).port = "");
            let s;
            for (s of V){
                if (!(s in _class_private_field_get(this, _i1))) continue;
                let i = {}, o = _class_private_field_get(this, _i1)[s];
                switch(_class_private_field_get(this, urlpattern_t1)[s] = [], s){
                    case "protocol":
                        Object.assign(i, b), i.encodePart = w;
                        break;
                    case "username":
                        Object.assign(i, b), i.encodePart = he;
                        break;
                    case "password":
                        Object.assign(i, b), i.encodePart = ue;
                        break;
                    case "hostname":
                        Object.assign(i, J), _(o) ? i.encodePart = K : i.encodePart = j;
                        break;
                    case "port":
                        Object.assign(i, b), i.encodePart = G;
                        break;
                    case "pathname":
                        U(_class_private_field_get(this, _n1).protocol) ? (Object.assign(i, Q, l), i.encodePart = de) : (Object.assign(i, b, l), i.encodePart = pe);
                        break;
                    case "search":
                        Object.assign(i, b, l), i.encodePart = ge;
                        break;
                    case "hash":
                        Object.assign(i, b, l), i.encodePart = me;
                        break;
                }
                try {
                    _class_private_field_get(this, _s1)[s] = F(o, i), _class_private_field_get(this, _n1)[s] = W(_class_private_field_get(this, _s1)[s], _class_private_field_get(this, urlpattern_t1)[s], i), _class_private_field_get(this, _e1)[s] = Ae(_class_private_field_get(this, _s1)[s], i), _class_private_field_set(this, _l1, _class_private_field_get(this, _l1) || _class_private_field_get(this, _s1)[s].some((h)=>h.type === 2));
                } catch  {
                    throw new TypeError(`invalid ${s} pattern '${_class_private_field_get(this, _i1)[s]}'.`);
                }
            }
        } catch (c) {
            throw new TypeError(`Failed to construct 'URLPattern': ${c.message}`);
        }
    }
});
a(Y, "URLPattern");

function dist_urlpattern_r(t, r) {
    var _class_private_field_get1, _hostname, _class_private_field_get2, _pathname, _class_private_field_get3, _search;
    switch(_class_private_field_get(this, urlpattern_o)){
        case 0:
            break;
        case 1:
            _class_private_field_get(this, urlpattern_t).protocol = _class_private_method_get(this, _c, urlpattern_c).call(this);
            break;
        case 2:
            break;
        case 3:
            _class_private_field_get(this, urlpattern_t).username = _class_private_method_get(this, _c, urlpattern_c).call(this);
            break;
        case 4:
            _class_private_field_get(this, urlpattern_t).password = _class_private_method_get(this, _c, urlpattern_c).call(this);
            break;
        case 5:
            _class_private_field_get(this, urlpattern_t).hostname = _class_private_method_get(this, _c, urlpattern_c).call(this);
            break;
        case 6:
            _class_private_field_get(this, urlpattern_t).port = _class_private_method_get(this, _c, urlpattern_c).call(this);
            break;
        case 7:
            _class_private_field_get(this, urlpattern_t).pathname = _class_private_method_get(this, _c, urlpattern_c).call(this);
            break;
        case 8:
            _class_private_field_get(this, urlpattern_t).search = _class_private_method_get(this, _c, urlpattern_c).call(this);
            break;
        case 9:
            _class_private_field_get(this, urlpattern_t).hash = _class_private_method_get(this, _c, urlpattern_c).call(this);
            break;
        case 10:
            break;
    }
    _class_private_field_get(this, urlpattern_o) !== 0 && t !== 10 && ([
        1,
        2,
        3,
        4
    ].includes(_class_private_field_get(this, urlpattern_o)) && [
        6,
        7,
        8,
        9
    ].includes(t) && ((_hostname = (_class_private_field_get1 = _class_private_field_get(this, urlpattern_t)).hostname) !== null && _hostname !== void 0 ? _hostname : _class_private_field_get1.hostname = ""), [
        1,
        2,
        3,
        4,
        5,
        6
    ].includes(_class_private_field_get(this, urlpattern_o)) && [
        8,
        9
    ].includes(t) && ((_pathname = (_class_private_field_get2 = _class_private_field_get(this, urlpattern_t)).pathname) !== null && _pathname !== void 0 ? _pathname : _class_private_field_get2.pathname = _class_private_field_get(this, _g) ? "/" : ""), [
        1,
        2,
        3,
        4,
        5,
        6,
        7
    ].includes(_class_private_field_get(this, urlpattern_o)) && t === 9 && ((_search = (_class_private_field_get3 = _class_private_field_get(this, urlpattern_t)).search) !== null && _search !== void 0 ? _search : _class_private_field_get3.search = "")), _class_private_method_get(this, _R, R1).call(this, t, r);
}
function R1(t, r) {
    _class_private_field_set(this, urlpattern_o, t), _class_private_field_set(this, _l, _class_private_field_get(this, _e) + r), _class_private_field_set(this, _e, _class_private_field_get(this, _e) + r), _class_private_field_set(this, _s, 0);
}
function b1() {
    _class_private_field_set(this, _e, _class_private_field_get(this, _l)), _class_private_field_set(this, _s, 0);
}
function urlpattern_u(t) {
    _class_private_method_get(this, _b, b1).call(this), _class_private_field_set(this, urlpattern_o, t);
}
function urlpattern_m(t) {
    return t < 0 && (t = _class_private_field_get(this, _n).length - t), t < _class_private_field_get(this, _n).length ? _class_private_field_get(this, _n)[t] : _class_private_field_get(this, _n)[_class_private_field_get(this, _n).length - 1];
}
function a1(t, r) {
    let n = _class_private_method_get(this, _m, urlpattern_m).call(this, t);
    return n.value === r && (n.type === "CHAR" || n.type === "ESCAPED_CHAR" || n.type === "INVALID_CHAR");
}
function P1() {
    return _class_private_method_get(this, _a, a1).call(this, _class_private_field_get(this, _e), ":");
}
function urlpattern_E() {
    return _class_private_method_get(this, _a, a1).call(this, _class_private_field_get(this, _e) + 1, "/") && _class_private_method_get(this, _a, a1).call(this, _class_private_field_get(this, _e) + 2, "/");
}
function urlpattern_S() {
    return _class_private_method_get(this, _a, a1).call(this, _class_private_field_get(this, _e), "@");
}
function O1() {
    return _class_private_method_get(this, _a, a1).call(this, _class_private_field_get(this, _e), ":");
}
function urlpattern_k() {
    return _class_private_method_get(this, _a, a1).call(this, _class_private_field_get(this, _e), ":");
}
function x1() {
    return _class_private_method_get(this, _a, a1).call(this, _class_private_field_get(this, _e), "/");
}
function urlpattern_h() {
    if (_class_private_method_get(this, _a, a1).call(this, _class_private_field_get(this, _e), "?")) return !0;
    if (_class_private_field_get(this, _n)[_class_private_field_get(this, _e)].value !== "?") return !1;
    let t = _class_private_method_get(this, _m, urlpattern_m).call(this, _class_private_field_get(this, _e) - 1);
    return t.type !== "NAME" && t.type !== "REGEX" && t.type !== "CLOSE" && t.type !== "ASTERISK";
}
function urlpattern_f() {
    return _class_private_method_get(this, _a, a1).call(this, _class_private_field_get(this, _e), "#");
}
function T1() {
    return _class_private_field_get(this, _n)[_class_private_field_get(this, _e)].type == "OPEN";
}
function urlpattern_A() {
    return _class_private_field_get(this, _n)[_class_private_field_get(this, _e)].type == "CLOSE";
}
function urlpattern_y() {
    return _class_private_method_get(this, _a, a1).call(this, _class_private_field_get(this, _e), "[");
}
function w1() {
    return _class_private_method_get(this, _a, a1).call(this, _class_private_field_get(this, _e), "]");
}
function urlpattern_c() {
    let t = _class_private_field_get(this, _n)[_class_private_field_get(this, _e)], r = _class_private_method_get(this, _m, urlpattern_m).call(this, _class_private_field_get(this, _l)).index;
    return _class_private_field_get(this, _i).substring(r, t.index);
}
function C1() {
    let t = {};
    Object.assign(t, b), t.encodePart = w;
    let r = q(_class_private_method_get(this, _c, urlpattern_c).call(this), void 0, t);
    _class_private_field_set(this, _g, U(r));
}

// The URLPattern class, without the package's own entry, which installs it on load.


export { Y as URLPattern };
