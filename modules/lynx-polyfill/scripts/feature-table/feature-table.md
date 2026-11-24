# Feature table

Generated 2026-11-24T08:01:22.792Z by make-table.ts from 3 run(s).

Columns:

- `primjs-4.2-lynx-4.2-android-mt`: main thread, runtimeType quickjs, osVersion 36; runs run2-ft-off, run3-ft-off, run4-ft-off
- `primjs-4.2-lynx-4.2-android-bg`: background, runtimeType quickjs, osVersion 36; runs run2-ft-off, run3-ft-off, run4-ft-off

Statuses: **yes** there, and its check gives the specified result; **no** missing (or only the binding's fill); **wrong** there, but its check fails; **param** background only as a lynx-core wrapper parameter: the free name works, globalThis lacks it.

Cells that varied between runs: 0.

## built-ins (core-js modules)

| Row | Edition | `primjs-4.2-lynx-4.2-android-mt` | `primjs-4.2-lynx-4.2-android-bg` |
| --- | --- | --- | --- |
| `es.symbol` | ES2015 or a fix | yes | yes |
| `es.symbol.description` | ES2019 | yes | yes |
| `es.symbol.async-dispose` | after ES2025 | no: absent (TypeError: cannot read property 'value' of undefined) | no: absent (TypeError: cannot read property 'value' of undefined) |
| `es.symbol.async-iterator` | ES2018 | yes | yes |
| `es.symbol.dispose` | after ES2025 | no: absent (TypeError: cannot read property 'value' of undefined) | no: absent (TypeError: cannot read property 'value' of undefined) |
| `es.symbol.has-instance` | ES2015 or a fix | yes | yes |
| `es.symbol.is-concat-spreadable` | ES2015 or a fix | yes | yes |
| `es.symbol.iterator` | ES2015 or a fix | yes | yes |
| `es.symbol.match` | ES2015 or a fix | yes | yes |
| `es.symbol.match-all` | ES2020 | yes | yes |
| `es.symbol.replace` | ES2015 or a fix | yes | yes |
| `es.symbol.search` | ES2015 or a fix | yes | yes |
| `es.symbol.species` | ES2015 or a fix | yes | yes |
| `es.symbol.split` | ES2015 or a fix | yes | yes |
| `es.symbol.to-primitive` | ES2015 or a fix | yes | yes |
| `es.symbol.to-string-tag` | ES2015 or a fix | yes | yes |
| `es.symbol.unscopables` | ES2015 or a fix | yes | yes |
| `es.error.cause` | ES2022 | wrong: present, but core-js's check 0 fails. error.cause.option: got undefined, want 7 | wrong: present, but core-js's check 0 fails. error.cause.option: got undefined, want 7 |
| `es.error.is-error` | after ES2025 | no: absent (TypeError: not a function) | no: absent (TypeError: Error.isError is not a function) |
| `es.error.to-string` | ES2015 or a fix | yes | yes |
| `es.aggregate-error` | ES2021 | yes | yes |
| `es.aggregate-error.cause` | ES2022 | wrong: present, but core-js's check 0 fails. aggregate-error.cause: got undefined, want 7 | wrong: present, but core-js's check 0 fails. aggregate-error.cause: got undefined, want 7 |
| `es.suppressed-error.constructor` | after ES2025 | no: absent | no: absent |
| `es.array.at` | ES2022 | no: absent | no: absent |
| `es.array.concat` | ES2015 or a fix | yes | yes |
| `es.array.copy-within` | ES2015 or a fix | yes | yes |
| `es.array.every` | ES2015 or a fix | yes | yes |
| `es.array.fill` | ES2015 or a fix | yes | yes |
| `es.array.filter` | ES2015 or a fix | yes | yes |
| `es.array.find` | ES2015 or a fix | yes | yes |
| `es.array.find-index` | ES2015 or a fix | yes | yes |
| `es.array.find-last` | ES2023 | no: absent | no: absent |
| `es.array.find-last-index` | ES2023 | no: absent | no: absent |
| `es.array.flat` | ES2019 | yes | yes |
| `es.array.flat-map` | ES2019 | yes | yes |
| `es.array.for-each` | ES2015 or a fix | yes | yes |
| `es.array.from` | ES2015 or a fix | yes | yes |
| `es.array.includes` | ES2016 | yes | yes |
| `es.array.index-of` | ES2015 or a fix | yes | yes |
| `es.array.is-array` | ES2015 or a fix | yes | yes |
| `es.array.iterator` | ES2015 or a fix | yes | yes |
| `es.array.join` | ES2015 or a fix | yes | yes |
| `es.array.last-index-of` | ES2015 or a fix | yes | yes |
| `es.array.map` | ES2015 or a fix | yes | yes |
| `es.array.of` | ES2015 or a fix | yes | yes |
| `es.array.push` | ES2015 or a fix | yes | yes |
| `es.array.reduce` | ES2015 or a fix | yes | yes |
| `es.array.reduce-right` | ES2015 or a fix | yes | yes |
| `es.array.reverse` | ES2015 or a fix | yes | yes |
| `es.array.slice` | ES2015 or a fix | yes | yes |
| `es.array.some` | ES2015 or a fix | yes | yes |
| `es.array.sort` | ES2015 or a fix | yes | yes |
| `es.array.species` | ES2015 or a fix | yes | yes |
| `es.array.splice` | ES2015 or a fix | yes | yes |
| `es.array.to-reversed` | ES2023 | no: absent | no: absent |
| `es.array.to-sorted` | ES2023 | no: absent | no: absent |
| `es.array.to-spliced` | ES2023 | no: absent | no: absent |
| `es.array.unscopables.flat` | ES2019 | yes | yes |
| `es.array.unscopables.flat-map` | ES2019 | yes | yes |
| `es.array.unshift` | ES2015 or a fix | yes | yes |
| `es.array.with` | ES2023 | no: absent | no: absent |
| `es.array-buffer.constructor` | ES2015 or a fix | yes | yes |
| `es.array-buffer.is-view` | ES2015 or a fix | yes | yes |
| `es.array-buffer.slice` | ES2015 or a fix | yes | yes |
| `es.data-view` | ES2015 or a fix | yes | yes |
| `es.data-view.get-float16` | ES2025 | no: absent | no: absent |
| `es.data-view.set-float16` | ES2025 | no: absent | no: absent |
| `es.array-buffer.detached` | ES2024 | no: absent | no: absent |
| `es.array-buffer.transfer` | ES2024 | no: absent | no: absent |
| `es.array-buffer.transfer-to-fixed-length` | ES2024 | no: absent | no: absent |
| `es.date.get-year` | Annex B | yes | yes |
| `es.date.now` | ES2015 or a fix | yes | yes |
| `es.date.set-year` | Annex B | yes | yes |
| `es.date.to-gmt-string` | Annex B | yes | yes |
| `es.date.to-iso-string` | ES2015 or a fix | yes | yes |
| `es.date.to-json` | ES2015 or a fix | yes | yes |
| `es.date.to-primitive` | ES2015 or a fix | yes | yes |
| `es.date.to-string` | ES2015 or a fix | yes | yes |
| `es.disposable-stack.constructor` | after ES2025 | no: absent | no: absent |
| `es.escape` | Annex B | yes | yes |
| `es.function.bind` | ES2015 or a fix | yes | yes |
| `es.function.has-instance` | ES2015 or a fix | yes | yes |
| `es.function.name` | ES2015 or a fix | yes | yes |
| `es.global-this` | ES2020 | yes | yes |
| `es.iterator.constructor` | ES2025 | no: absent | no: absent |
| `es.iterator.chunks` | after ES2025 | no: absent (ReferenceError: Iterator is not defined) | no: absent (ReferenceError: Iterator is not defined) |
| `es.iterator.concat` | after ES2025 | no: absent (ReferenceError: Iterator is not defined) | no: absent (ReferenceError: Iterator is not defined) |
| `es.iterator.dispose` | after ES2025 | no: absent | no: absent |
| `es.iterator.drop` | ES2025 | no: absent | no: absent |
| `es.iterator.every` | ES2025 | no: absent | no: absent |
| `es.iterator.filter` | ES2025 | no: absent | no: absent |
| `es.iterator.find` | ES2025 | no: absent | no: absent |
| `es.iterator.flat-map` | ES2025 | no: absent | no: absent |
| `es.iterator.for-each` | ES2025 | no: absent | no: absent |
| `es.iterator.from` | ES2025 | no: absent (ReferenceError: Iterator is not defined) | no: absent (ReferenceError: Iterator is not defined) |
| `es.iterator.includes` | after ES2025 | no: absent (ReferenceError: Iterator is not defined) | no: absent (ReferenceError: Iterator is not defined) |
| `es.iterator.join` | after ES2025 | no: absent (ReferenceError: Iterator is not defined) | no: absent (ReferenceError: Iterator is not defined) |
| `es.iterator.map` | ES2025 | no: absent | no: absent |
| `es.iterator.reduce` | ES2025 | no: absent | no: absent |
| `es.iterator.some` | ES2025 | no: absent | no: absent |
| `es.iterator.take` | ES2025 | no: absent | no: absent |
| `es.iterator.to-array` | ES2025 | no: absent (ReferenceError: Iterator is not defined) | no: absent (ReferenceError: Iterator is not defined) |
| `es.iterator.windows` | after ES2025 | no: absent (ReferenceError: Iterator is not defined) | no: absent (ReferenceError: Iterator is not defined) |
| `es.iterator.zip` | after ES2025 | no: absent (ReferenceError: Iterator is not defined) | no: absent (ReferenceError: Iterator is not defined) |
| `es.iterator.zip-keyed` | after ES2025 | no: absent (ReferenceError: Iterator is not defined) | no: absent (ReferenceError: Iterator is not defined) |
| `es.json.is-raw-json` | after ES2025 | no: absent (TypeError: not a function) | no: absent (TypeError: JSON.rawJSON is not a function) |
| `es.json.parse` | after ES2025 | wrong: present, but core-js's check 0 throws TypeError: cannot read property 'source' of undefined. json.parse.source: got undefined, want 9007199254740993 | wrong: present, but core-js's check 0 throws TypeError: cannot read property 'source' of undefined. json.parse.source: got undefined, want 9007199254740993 |
| `es.json.raw-json` | after ES2025 | no: absent (TypeError: not a function) | no: absent (TypeError: JSON.rawJSON is not a function) |
| `es.json.stringify` | ES2015 or a fix | wrong: present, but core-js's check 0 throws TypeError: not a function: function NATIVE_RAW_JSON() { var unsafeInt = '9007199254740993'; var raw = JSON.rawJSON(unsafeInt); return JSO… | wrong: present, but core-js's check 0 throws TypeError: JSON.rawJSON is not a function: function NATIVE_RAW_JSON() { var unsafeInt = '9007199254740993'; var raw = JSON.rawJSON(unsafeInt); return JSO… |
| `es.json.to-string-tag` | ES2015 or a fix | yes | yes |
| `es.map` | ES2015 or a fix | yes | yes |
| `es.map.group-by` | ES2024 | no: absent (TypeError: not a function) | no: absent (TypeError: Map.groupBy is not a function) |
| `es.map.get-or-insert` | after ES2025 | no: absent | no: absent |
| `es.map.get-or-insert-computed` | after ES2025 | no: absent | no: absent |
| `es.math.acosh` | ES2015 or a fix | yes | yes |
| `es.math.asinh` | ES2015 or a fix | yes | yes |
| `es.math.atanh` | ES2015 or a fix | yes | yes |
| `es.math.cbrt` | ES2015 or a fix | yes | yes |
| `es.math.clz32` | ES2015 or a fix | yes | yes |
| `es.math.cosh` | ES2015 or a fix | yes | yes |
| `es.math.expm1` | ES2015 or a fix | yes | yes |
| `es.math.fround` | ES2015 or a fix | yes | yes |
| `es.math.f16round` | ES2025 | no: absent | no: absent |
| `es.math.hypot` | ES2015 or a fix | yes | yes |
| `es.math.imul` | ES2015 or a fix | yes | yes |
| `es.math.log10` | ES2015 or a fix | yes | yes |
| `es.math.log1p` | ES2015 or a fix | yes | yes |
| `es.math.log2` | ES2015 or a fix | yes | yes |
| `es.math.sign` | ES2015 or a fix | yes | yes |
| `es.math.sinh` | ES2015 or a fix | yes | yes |
| `es.math.sum-precise` | after ES2025 | no: absent (TypeError: not a function) | no: absent (TypeError: Math.sumPrecise is not a function) |
| `es.math.tanh` | ES2015 or a fix | yes | yes |
| `es.math.to-string-tag` | ES2015 or a fix | yes | yes |
| `es.math.trunc` | ES2015 or a fix | yes | yes |
| `es.number.constructor` | ES2015 or a fix | yes | yes |
| `es.number.epsilon` | ES2015 or a fix | yes | yes |
| `es.number.is-finite` | ES2015 or a fix | yes | yes |
| `es.number.is-integer` | ES2015 or a fix | yes | yes |
| `es.number.is-nan` | ES2015 or a fix | yes | yes |
| `es.number.is-safe-integer` | ES2015 or a fix | yes | yes |
| `es.number.max-safe-integer` | ES2015 or a fix | yes | yes |
| `es.number.min-safe-integer` | ES2015 or a fix | yes | yes |
| `es.number.parse-float` | ES2015 or a fix | yes | yes |
| `es.number.parse-int` | ES2015 or a fix | yes | yes |
| `es.number.to-exponential` | ES2015 or a fix | yes | yes |
| `es.number.to-fixed` | ES2015 or a fix | yes | yes |
| `es.number.to-precision` | ES2015 or a fix | yes | yes |
| `es.object.assign` | ES2015 or a fix | wrong: present, but core-js's check 0 fails. object.assign.getter-defines: got 3, want 1 | wrong: present, but core-js's check 0 fails. object.assign.getter-defines: got 3, want 1 |
| `es.object.create` | ES2015 or a fix | yes | yes |
| `es.object.define-getter` | Annex B | yes | yes |
| `es.object.define-properties` | ES2015 or a fix | yes | yes |
| `es.object.define-property` | ES2015 or a fix | yes | yes |
| `es.object.define-setter` | Annex B | yes | yes |
| `es.object.entries` | ES2017 | yes | yes |
| `es.object.freeze` | ES2015 or a fix | yes | yes |
| `es.object.from-entries` | ES2019 | yes | yes |
| `es.object.get-own-property-descriptor` | ES2015 or a fix | wrong: present, but core-js's check 1 fails. object.gopd.primitive: got undefined, want {"value":"q","writable":false,… | wrong: present, but core-js's check 1 fails. object.gopd.primitive: got undefined, want {"value":"q","writable":false,… |
| `es.object.get-own-property-descriptors` | ES2017 | yes | yes |
| `es.object.get-own-property-names` | ES2015 or a fix | yes | yes |
| `es.object.get-prototype-of` | ES2015 or a fix | yes | yes |
| `es.object.group-by` | ES2024 | no: absent (TypeError: not a function) | no: absent (TypeError: Object.groupBy is not a function) |
| `es.object.has-own` | ES2022 | no: absent | no: absent |
| `es.object.is` | ES2015 or a fix | yes | yes |
| `es.object.is-extensible` | ES2015 or a fix | yes | yes |
| `es.object.is-frozen` | ES2015 or a fix | yes | yes |
| `es.object.is-sealed` | ES2015 or a fix | yes | yes |
| `es.object.keys` | ES2015 or a fix | yes | yes |
| `es.object.lookup-getter` | Annex B | yes | yes |
| `es.object.lookup-setter` | Annex B | yes | yes |
| `es.object.prevent-extensions` | ES2015 or a fix | yes | yes |
| `es.object.proto` | Annex B | yes | yes |
| `es.object.seal` | ES2015 or a fix | yes | yes |
| `es.object.set-prototype-of` | ES2015 or a fix | yes | yes |
| `es.object.to-string` | ES2015 or a fix | yes | yes |
| `es.object.values` | ES2017 | yes | yes |
| `es.parse-float` | ES2015 or a fix | yes | yes |
| `es.parse-int` | ES2015 or a fix | yes | yes |
| `es.promise` | ES2015 or a fix | yes | wrong: present, but core-js's check 0 throws TypeError: not a constructor. promise.species: got THROWS TypeError: not a constructor, want true; promise.species-getter: got false, want true. checked on the bundle's Promise (lynx.Promise) |
| `es.promise.all-settled` | ES2020 | yes | wrong: present, but core-js's check 0 throws TypeError: not a constructor. promise.species: got THROWS TypeError: not a constructor, want true. checked on the bundle's Promise (lynx.Promise) |
| `es.promise.any` | ES2021 | yes | no: absent (TypeError: not a constructor). checked on the bundle's Promise (lynx.Promise) |
| `es.promise.finally` | ES2018 | yes | wrong: present, but core-js's check 0 throws TypeError: not a constructor. promise.species: got THROWS TypeError: not a constructor, want true. checked on the bundle's Promise (lynx.Promise) |
| `es.promise.try` | ES2025 | no: absent (TypeError: not a function) | no: absent (TypeError: not a constructor). checked on the bundle's Promise (lynx.Promise) |
| `es.promise.with-resolvers` | ES2024 | no: absent | no: absent (TypeError: not a constructor). checked on the bundle's Promise (lynx.Promise) |
| `es.array.from-async` | after ES2025 | no: absent (TypeError: cannot read property 'call' of undefined) | no: absent (TypeError: cannot read property 'call' of undefined) |
| `es.async-disposable-stack.constructor` | after ES2025 | no: absent | no: absent |
| `es.async-iterator.async-dispose` | after ES2025 | no: absent (ReferenceError: AsyncIterator is not defined) | no: absent (ReferenceError: AsyncIterator is not defined) |
| `es.reflect.apply` | ES2015 or a fix | wrong: present, but core-js's check 0 fails. reflect.apply.no-args: got no throw, want TypeError | wrong: present, but core-js's check 0 fails. reflect.apply.no-args: got no throw, want TypeError |
| `es.reflect.construct` | ES2015 or a fix | yes | yes |
| `es.reflect.define-property` | ES2015 or a fix | yes | yes |
| `es.reflect.delete-property` | ES2015 or a fix | yes | yes |
| `es.reflect.get` | ES2015 or a fix | yes | yes |
| `es.reflect.get-own-property-descriptor` | ES2015 or a fix | yes | yes |
| `es.reflect.get-prototype-of` | ES2015 or a fix | yes | yes |
| `es.reflect.has` | ES2015 or a fix | yes | yes |
| `es.reflect.is-extensible` | ES2015 or a fix | yes | yes |
| `es.reflect.own-keys` | ES2015 or a fix | yes | yes |
| `es.reflect.prevent-extensions` | ES2015 or a fix | yes | yes |
| `es.reflect.set` | ES2015 or a fix | yes | yes |
| `es.reflect.set-prototype-of` | ES2015 or a fix | yes | yes |
| `es.reflect.to-string-tag` | ES2015 or a fix | no: absent | no: absent |
| `es.regexp.constructor` | ES2015 or a fix | yes | yes |
| `es.regexp.escape` | ES2025 | no: absent (TypeError: not a function) | no: absent (TypeError: RegExp.escape is not a function) |
| `es.regexp.dot-all` | ES2018 | yes | yes |
| `es.regexp.exec` | ES2015 or a fix | yes | yes |
| `es.regexp.flags` | ES2015 or a fix | yes | yes |
| `es.regexp.sticky` | ES2015 or a fix | yes | yes |
| `es.regexp.test` | ES2015 or a fix | yes | yes |
| `es.regexp.to-string` | ES2015 or a fix | yes | yes |
| `es.set` | ES2015 or a fix | yes | yes |
| `es.set.difference.v2` | ES2025 | no: absent | no: absent |
| `es.set.intersection.v2` | ES2025 | no: absent | no: absent |
| `es.set.is-disjoint-from.v2` | ES2025 | no: absent | no: absent |
| `es.set.is-subset-of.v2` | ES2025 | no: absent | no: absent |
| `es.set.is-superset-of.v2` | ES2025 | no: absent | no: absent |
| `es.set.symmetric-difference.v2` | ES2025 | no: absent | no: absent |
| `es.set.union.v2` | ES2025 | no: absent | no: absent |
| `es.string.at-alternative` | ES2022 | no: absent (TypeError: not a function) | no: absent (TypeError: "𠮷".at is not a function) |
| `es.string.code-point-at` | ES2015 or a fix | yes | yes |
| `es.string.ends-with` | ES2015 or a fix | yes | yes |
| `es.string.from-code-point` | ES2015 or a fix | yes | yes |
| `es.string.includes` | ES2015 or a fix | yes | yes |
| `es.string.is-well-formed` | ES2024 | no: absent | no: absent |
| `es.string.iterator` | ES2015 or a fix | yes | yes |
| `es.string.match` | ES2015 or a fix | yes | yes |
| `es.string.match-all` | ES2020 | wrong: present, but core-js's check 0 fails. string.match-all.non-global: got no throw, want TypeError | wrong: present, but core-js's check 0 fails. string.match-all.non-global: got no throw, want TypeError |
| `es.string.pad-end` | ES2017 | yes | yes |
| `es.string.pad-start` | ES2017 | yes | yes |
| `es.string.raw` | ES2015 or a fix | yes | yes |
| `es.string.repeat` | ES2015 or a fix | yes | yes |
| `es.string.replace` | ES2015 or a fix | yes: core-js's check is miscompiled by the build's minifier (it folds `/./[Symbol.replace]('a', '$0') === '$0'` to 0); each of its five conditions passes on its own | yes: core-js's check is miscompiled by the build's minifier (it folds `/./[Symbol.replace]('a', '$0') === '$0'` to 0); each of its five conditions passes on its own |
| `es.string.replace-all` | ES2021 | no: engine lacks it; the binding fills it (native name="ev" function ev() { [native…) | no: engine lacks it; the binding fills it (js name="g" function g(e,t){if(this===nu…) |
| `es.string.search` | ES2015 or a fix | yes | yes |
| `es.string.split` | ES2015 or a fix | yes | yes |
| `es.string.starts-with` | ES2015 or a fix | yes | yes |
| `es.string.substr` | Annex B | yes | yes |
| `es.string.to-well-formed` | ES2024 | no: absent (TypeError: cannot read property 'call' of undefined) | no: absent (TypeError: cannot read property 'call' of undefined) |
| `es.string.trim` | ES2015 or a fix | yes | yes |
| `es.string.trim-end` | ES2019 | yes | yes |
| `es.string.trim-start` | ES2019 | yes | yes |
| `es.string.anchor` | Annex B | yes | yes |
| `es.string.big` | Annex B | yes | yes |
| `es.string.blink` | Annex B | yes | yes |
| `es.string.bold` | Annex B | yes | yes |
| `es.string.fixed` | Annex B | yes | yes |
| `es.string.fontcolor` | Annex B | yes | yes |
| `es.string.fontsize` | Annex B | yes | yes |
| `es.string.italics` | Annex B | yes | yes |
| `es.string.link` | Annex B | yes | yes |
| `es.string.small` | Annex B | yes | yes |
| `es.string.strike` | Annex B | yes | yes |
| `es.string.sub` | Annex B | yes | yes |
| `es.string.sup` | Annex B | yes | yes |
| `es.typed-array.float32-array` | ES2015 or a fix | yes | yes |
| `es.typed-array.float64-array` | ES2015 or a fix | yes | yes |
| `es.typed-array.int8-array` | ES2015 or a fix | yes | yes |
| `es.typed-array.int16-array` | ES2015 or a fix | yes | yes |
| `es.typed-array.int32-array` | ES2015 or a fix | yes | yes |
| `es.typed-array.uint8-array` | ES2015 or a fix | yes | yes |
| `es.typed-array.uint8-clamped-array` | ES2015 or a fix | yes | yes |
| `es.typed-array.uint16-array` | ES2015 or a fix | yes | yes |
| `es.typed-array.uint32-array` | ES2015 or a fix | yes | yes |
| `es.typed-array.at` | ES2022 | no: absent | no: absent |
| `es.typed-array.copy-within` | ES2015 or a fix | yes | yes |
| `es.typed-array.every` | ES2015 or a fix | yes | yes |
| `es.typed-array.fill` | ES2015 or a fix | yes | yes |
| `es.typed-array.filter` | ES2015 or a fix | yes | yes |
| `es.typed-array.find` | ES2015 or a fix | yes | yes |
| `es.typed-array.find-index` | ES2015 or a fix | yes | yes |
| `es.typed-array.find-last` | ES2023 | yes | yes |
| `es.typed-array.find-last-index` | ES2023 | yes | yes |
| `es.typed-array.for-each` | ES2015 or a fix | yes | yes |
| `es.typed-array.from` | ES2015 or a fix | yes | yes |
| `es.typed-array.includes` | ES2016 | yes | yes |
| `es.typed-array.index-of` | ES2015 or a fix | yes | yes |
| `es.typed-array.iterator` | ES2015 or a fix | yes | yes |
| `es.typed-array.join` | ES2015 or a fix | yes | yes |
| `es.typed-array.last-index-of` | ES2015 or a fix | yes | yes |
| `es.typed-array.map` | ES2015 or a fix | yes | yes |
| `es.typed-array.of` | ES2015 or a fix | yes | yes |
| `es.typed-array.reduce` | ES2015 or a fix | yes | yes |
| `es.typed-array.reduce-right` | ES2015 or a fix | yes | yes |
| `es.typed-array.reverse` | ES2015 or a fix | yes | yes |
| `es.typed-array.set` | ES2015 or a fix | yes | yes |
| `es.typed-array.slice` | ES2015 or a fix | yes | yes |
| `es.typed-array.some` | ES2015 or a fix | yes | yes |
| `es.typed-array.sort` | ES2015 or a fix | yes | yes |
| `es.typed-array.subarray` | ES2015 or a fix | yes | yes |
| `es.typed-array.to-locale-string` | ES2015 or a fix | yes | yes |
| `es.typed-array.to-reversed` | ES2023 | no: absent | no: absent |
| `es.typed-array.to-sorted` | ES2023 | no: absent | no: absent |
| `es.typed-array.to-string` | ES2015 or a fix | yes | yes |
| `es.typed-array.with` | ES2023 | no: absent | no: absent |
| `es.uint8-array.from-base64` | after ES2025 | no: absent | no: absent |
| `es.uint8-array.from-hex` | after ES2025 | no: absent | no: absent |
| `es.uint8-array.set-from-base64` | after ES2025 | no: absent | no: absent |
| `es.uint8-array.set-from-hex` | after ES2025 | no: absent | no: absent |
| `es.uint8-array.to-base64` | after ES2025 | no: absent | no: absent |
| `es.uint8-array.to-hex` | after ES2025 | no: absent | no: absent |
| `es.unescape` | Annex B | yes | yes |
| `es.weak-map` | ES2015 or a fix | yes | yes |
| `es.weak-map.get-or-insert` | after ES2025 | no: absent | no: absent |
| `es.weak-map.get-or-insert-computed` | after ES2025 | no: absent | no: absent |
| `es.weak-set` | ES2015 or a fix | yes | yes |

## built-ins (no core-js module)

| Row | Edition | `primjs-4.2-lynx-4.2-android-mt` | `primjs-4.2-lynx-4.2-android-bg` |
| --- | --- | --- | --- |
| `x.string.normalize` | ES2015 | no: absent (THROWS TypeError: not a function) | no: absent (THROWS TypeError: "é".normalize is not a function) |
| `x.string.normalize.nfc` | ES2015 | no: absent (THROWS TypeError: not a function) | no: absent (THROWS TypeError: "é".normalize is not a function) |
| `x.error.cause.option` | ES2022 | wrong: got undefined, want 7 | wrong: got undefined, want 7 |
| `x.error.cause.own` | ES2022 | wrong: got false, want true | wrong: got false, want true |
| `x.atomics` | ES2017 | no: absent (THROWS ReferenceError: Atomics is not defined) | no: absent (THROWS ReferenceError: Atomics is not defined) |
| `x.atomics.wait-async` | ES2024 | no: absent (THROWS ReferenceError: Atomics is not defined) | no: absent (THROWS ReferenceError: Atomics is not defined) |
| `x.shared-array-buffer` | ES2017 | yes | yes |
| `x.shared-array-buffer.growable` | ES2024 | no: absent (THROWS TypeError: not a function) | no: absent (THROWS TypeError: (e=new SharedArrayBuffer(2,{maxByteLength:…) |
| `x.array-buffer.resizable` | ES2024 | no: absent (THROWS TypeError: not a function) | no: absent (THROWS TypeError: (e=new ArrayBuffer(2,{maxByteLength:8})).r…) |
| `x.array-buffer.transfer.smoke` | ES2024 | no: absent (THROWS TypeError: not a function) | no: absent (THROWS TypeError: (e=new ArrayBuffer(4)).transfer is not a f…) |
| `x.weak-map.symbol-keys` | ES2023 | wrong: got THROWS TypeError: not an object, want 1 | wrong: got THROWS TypeError: not an object, want 1 |
| `x.weak-set.symbol-keys` | ES2023 | wrong: got THROWS TypeError: not an object, want true | wrong: got THROWS TypeError: not an object, want true |
| `x.weak-ref.symbol-target` | ES2023 | wrong: got THROWS TypeError: WeakRef: target must be an object, want symbol | wrong: got THROWS TypeError: WeakRef: target must be an object, want symbol |
| `x.weak-ref` | ES2021 | yes | yes |
| `x.finalization-registry` | ES2021 | yes | yes |
| `x.proxy` | ES2015 | yes | yes |
| `x.bigint` | ES2020 | wrong: got -1, want 18446744073709551615 | wrong: got -1, want 18446744073709551615 |
| `x.bigint64-array` | ES2020 | yes | yes |
| `x.error.stack` | - | yes | yes |
| `x.error.capture-stack-trace` | - | no: absent (undefined) | no: absent (undefined) |
| `x.function.to-string` | ES2019 | yes | yes |
| `x.array.sort.stable` | ES2019 | yes | yes |
| `x.symbol.description` | ES2019 | yes | yes |
| `x.string.locale-upper-tr` | ES5 + ECMA-402 | wrong: got I, want İ | wrong: got I, want İ |
| `x.string.locale-compare` | ES5 + ECMA-402 | wrong: got false, want true | wrong: got false, want true |
| `x.number.to-locale-string-de` | ES5 + ECMA-402 | wrong: got 1234.5, want 1.234,5 | wrong: got 1234.5, want 1.234,5 |
| `x.date.to-locale-date-string-utc` | ES5 + ECMA-402 | wrong: got 01/01/1970, want 1/1/1970 | wrong: got 01/01/1970, want 1/1/1970 |
| `x.date.timezone-offset` | ES5 | yes | yes |
| `x.intl` | ECMA-402 | no: absent (undefined) | no: absent (undefined) |
| `x.intl.number-format` | ECMA-402 | no: absent (THROWS ReferenceError: Intl is not defined) | no: absent (THROWS ReferenceError: Intl is not defined) |
| `x.intl.date-time-format` | ECMA-402 | no: absent (THROWS ReferenceError: Intl is not defined) | no: absent (THROWS ReferenceError: Intl is not defined) |
| `x.intl.collator` | ECMA-402 | no: absent (THROWS ReferenceError: Intl is not defined) | no: absent (THROWS ReferenceError: Intl is not defined) |
| `x.intl.plural-rules` | ECMA-402 | no: absent (THROWS ReferenceError: Intl is not defined) | no: absent (THROWS ReferenceError: Intl is not defined) |
| `x.intl.relative-time-format` | ECMA-402 | no: absent (THROWS ReferenceError: Intl is not defined) | no: absent (THROWS ReferenceError: Intl is not defined) |
| `x.intl.list-format` | ECMA-402 | no: absent (THROWS ReferenceError: Intl is not defined) | no: absent (THROWS ReferenceError: Intl is not defined) |
| `x.intl.segmenter` | ECMA-402 | no: absent (THROWS ReferenceError: Intl is not defined) | no: absent (THROWS ReferenceError: Intl is not defined) |
| `x.intl.locale` | ECMA-402 | no: absent (THROWS ReferenceError: Intl is not defined) | no: absent (THROWS ReferenceError: Intl is not defined) |
| `x.intl.display-names` | ECMA-402 | no: absent (THROWS ReferenceError: Intl is not defined) | no: absent (THROWS ReferenceError: Intl is not defined) |
| `x.intl.get-canonical-locales` | ECMA-402 | no: absent (THROWS ReferenceError: Intl is not defined) | no: absent (THROWS ReferenceError: Intl is not defined) |
| `x.intl.supported-values-of` | ECMA-402 | no: absent (THROWS ReferenceError: Intl is not defined) | no: absent (THROWS ReferenceError: Intl is not defined) |

## diagnostics (why a check fails)

| Row | Edition | `primjs-4.2-lynx-4.2-android-mt` | `primjs-4.2-lynx-4.2-android-bg` |
| --- | --- | --- | --- |
| `why.object.assign.getter-defines` | - | wrong: got 3, want 1 | wrong: got 3, want 1 |
| `why.object.assign.symbols` | - | yes | yes |
| `why.object.assign.order` | - | yes | yes |
| `why.object.gopd.primitive` | - | wrong: got undefined, want {"value":"q","writable":false,"enumerabl… | wrong: got undefined, want {"value":"q","writable":false,"enumerabl… |
| `why.reflect.apply.no-args` | - | wrong: got no throw, want TypeError | wrong: got no throw, want TypeError |
| `why.string.match-all.non-global` | - | wrong: got no throw, want TypeError | wrong: got no throw, want TypeError |
| `why.string.replace.symbol-replace-object` | - | yes | yes |
| `why.string.replace.calls-exec` | - | yes | yes |
| `why.string.replace.named-groups-from-exec` | - | yes | yes |
| `why.string.replace.dollar-zero` | - | yes | yes |
| `why.string.replace.symbol-dollar-zero` | - | yes | yes |
| `why.promise.species` | - | yes | wrong: got THROWS TypeError: not a constructor, want true |
| `why.promise.species-getter` | - | yes | wrong: got false, want true |
| `why.promise.subclass` | - | yes | yes |
| `why.json.stringify.well-formed` | ES2019 | yes | yes |
| `why.json.stringify.symbol` | - | yes | yes |
| `why.json.parse.source` | after ES2025 | wrong: got undefined, want 9007199254740993 | wrong: got undefined, want 9007199254740993 |
| `why.nullish.new-function-param` | ES2020 | yes | yes |
| `why.nullish.eval` | ES2020 | yes | yes |
| `why.bigint.as-uint-n` | ES2020 | wrong: got 1\|-1, want 1\|18446744073709551615 | wrong: got 1\|-1, want 1\|18446744073709551615 |
| `why.bigint.as-int-n` | ES2020 | yes | yes |
| `why.error.cause.in-prototype` | ES2022 | yes | yes |
| `why.aggregate-error.cause` | ES2022 | wrong: got undefined, want 7 | wrong: got undefined, want 7 |

## syntax

| Row | Edition | `primjs-4.2-lynx-4.2-android-mt` | `primjs-4.2-lynx-4.2-android-bg` |
| --- | --- | --- | --- |
| `syn.let-const` | ES2015 | yes | yes |
| `syn.arrow` | ES2015 | yes | yes |
| `syn.class` | ES2015 | yes | yes |
| `syn.template` | ES2015 | yes | yes |
| `syn.tagged-template-raw` | ES2015 | yes | yes |
| `syn.destructuring` | ES2015 | yes | yes |
| `syn.default-rest-spread` | ES2015 | yes | yes |
| `syn.generators` | ES2015 | yes | yes |
| `syn.for-of` | ES2015 | yes | yes |
| `syn.computed-shorthand` | ES2015 | yes | yes |
| `syn.unicode-escape-braces` | ES2015 | yes | yes |
| `syn.regexp-sticky-unicode` | ES2015 | yes | yes |
| `syn.exponent` | ES2016 | yes | yes |
| `syn.async-await` | ES2017 | yes | yes |
| `syn.trailing-commas` | ES2017 | yes | yes |
| `syn.object-rest-spread` | ES2018 | yes | yes |
| `syn.async-generators` | ES2018 | yes | yes |
| `syn.regexp-named-groups` | ES2018 | yes | yes |
| `syn.regexp-lookbehind` | ES2018 | yes | yes |
| `syn.regexp-dotall` | ES2018 | yes | yes |
| `syn.regexp-unicode-property-literal` | ES2018 | no: SyntaxError at parse: invalid escape sequence in regular expression | no: SyntaxError at parse: invalid escape sequence in regular expression |
| `syn.regexp-unicode-property-ctor` | ES2018 | no: parses, then SyntaxError: invalid escape sequence in regular expression when run | no: parses, then SyntaxError: invalid escape sequence in regular expression when run |
| `syn.regexp-unicode-property-script` | ES2018 | no: SyntaxError at parse: invalid escape sequence in regular expression | no: SyntaxError at parse: invalid escape sequence in regular expression |
| `syn.optional-catch` | ES2019 | yes | yes |
| `syn.json-superset` | ES2019 | yes | yes |
| `syn.optional-chaining` | ES2020 | yes | yes |
| `syn.nullish` | ES2020 | yes | yes |
| `syn.nullish-undefined` | ES2020 | yes | yes |
| `syn.nullish-param` | ES2020 | yes | yes |
| `syn.nullish-keeps-falsy` | ES2020 | yes | yes |
| `syn.bigint-literal` | ES2020 | yes | yes |
| `syn.dynamic-import-parses` | ES2020 | yes | yes |
| `syn.numeric-separators` | ES2021 | yes | yes |
| `syn.logical-assign-nullish` | ES2021 | no: SyntaxError at parse: expecting ';' | no: SyntaxError at parse: expecting ';' |
| `syn.logical-assign-or` | ES2021 | no: SyntaxError at parse: unexpected token in expression: '=' | no: SyntaxError at parse: unexpected token in expression: '=' |
| `syn.logical-assign-and` | ES2021 | no: SyntaxError at parse: unexpected token in expression: '=' | no: SyntaxError at parse: unexpected token in expression: '=' |
| `syn.class-public-fields` | ES2022 | yes | yes |
| `syn.class-private-fields` | ES2022 | yes | yes |
| `syn.class-private-methods` | ES2022 | yes | yes |
| `syn.class-static-private` | ES2022 | yes | yes |
| `syn.class-private-in` | ES2022 | no: SyntaxError at parse: unexpected token in expression: '#x' | no: SyntaxError at parse: unexpected token in expression: '#x' |
| `syn.class-static-block` | ES2022 | no: SyntaxError at parse: invalid property name | no: SyntaxError at parse: invalid property name |
| `syn.regexp-d-literal` | ES2022 | no: SyntaxError at parse: invalid regular expression flags | no: SyntaxError at parse: invalid regular expression flags |
| `syn.regexp-d-ctor` | ES2022 | no: parses, then SyntaxError: invalid regular expression flags when run | no: parses, then SyntaxError: invalid regular expression flags when run |
| `syn.hashbang` | ES2023 | yes | yes |
| `syn.regexp-v-literal` | ES2024 | no: SyntaxError at parse: invalid regular expression flags | no: SyntaxError at parse: invalid regular expression flags |
| `syn.regexp-v-ctor` | ES2024 | no: parses, then SyntaxError: invalid regular expression flags when run | no: parses, then SyntaxError: invalid regular expression flags when run |
| `syn.regexp-v-ctor-simple` | ES2024 | no: parses, then SyntaxError: invalid regular expression flags when run | no: parses, then SyntaxError: invalid regular expression flags when run |
| `syn.regexp-modifiers-literal` | ES2025 | no: SyntaxError at parse: invalid group | no: SyntaxError at parse: invalid group |
| `syn.regexp-modifiers-ctor` | ES2025 | no: parses, then SyntaxError: invalid group when run | no: parses, then SyntaxError: invalid group when run |
| `syn.regexp-duplicate-named-groups-literal` | ES2025 | no: SyntaxError at parse: duplicate group name | no: SyntaxError at parse: duplicate group name |
| `syn.regexp-duplicate-named-groups-ctor` | ES2025 | no: parses, then SyntaxError: duplicate group name when run | no: parses, then SyntaxError: duplicate group name when run |
| `syn.using` | after ES2025 | no: SyntaxError at parse: expecting ';' | no: SyntaxError at parse: expecting ';' |
| `syn.await-using` | after ES2025 | no: SyntaxError at parse: expecting ';' | no: SyntaxError at parse: expecting ';' |

## web APIs

| Row | Edition | `primjs-4.2-lynx-4.2-android-mt` | `primjs-4.2-lynx-4.2-android-bg` |
| --- | --- | --- | --- |
| `URL` |  | no | wrong: href: https://a.example/p?q=1#h/ (want https://a.example/p?q=1#h); pathname: undefined (want /p); search: undefined (want ?q=1); host: undefined (want a.example:8080); protocol: undefined (want https:); relative: https://a.example/b/c/d/../x (want https://a.example/b/x); invalid-throws: no throw (want TypeError); searchParams: null (want 1); from-url: THROWS TypeError: (null) is not a function (want https://a.example/p); subclass: undefined (want /p); canParse: undefined (want function) |
| `URLSearchParams` |  | no | yes |
| `atob` |  | no | no |
| `btoa` |  | no | no |
| `TextEncoder` |  | no | no |
| `TextDecoder` |  | no: latin1-label = ReferenceError | no: latin1-label = ReferenceError |
| `TextCodecHelper` |  | no: keys = THROWS ReferenceError: TextCodecHelper is not defined; encode-kind = THROWS ReferenceError: TextCodecHelper is not defined | yes |
| `structuredClone` |  | no: engine lacks it; the binding's fill (bytecode, minified name: name="ed"); the fill fails function-throws: TypeError (want DataCloneError) | no: engine lacks it; the binding's fill (its source shows: js name="h" function h(e,t){var r,n,a,o,u=typeof e…); the fill fails function-throws: TypeError (want DataCloneError) |
| `DOMException` |  | no | no |
| `EventTarget` |  | no: engine lacks it; the binding's fill (bytecode, minified name: name="o"); the fill fails dispatch: THROWS ReferenceError: Event is not defined (want 1) | no: engine lacks it; the binding's fill (its source shows: js name="i" function i(){t.set(this,r(null))}); the fill fails dispatch: THROWS ReferenceError: Event is not defined (want 1) |
| `Event` |  | no | no |
| `CustomEvent` |  | no | no |
| `queueMicrotask` |  | no: engine lacks it; the binding's fill (bytecode, minified name: name="") | no: engine lacks it; the binding's fill (its source shows: js name="" e=>t.lynx.queueMicrotask(()=>{try{(0,y.…) |
| `performance` |  | no: mark = THROWS ReferenceError: performance is not defined | no: mark = THROWS ReferenceError: performance is not defined |
| `self` |  | no | no: a wrapper parameter bound to undefined: reading a member is a TypeError, not a ReferenceError |
| `navigator` |  | no: language = THROWS ReferenceError: navigator is not defined | no: a wrapper parameter bound to undefined: reading a member is a TypeError, not a ReferenceError. language = THROWS TypeError: cannot read property 'language' of undefined |
| `reportError` |  | no | no |
| `AbortController` |  | no | yes |
| `AbortSignal` |  | no | wrong: present but hollow: timeout: undefined (want function); any: undefined (want function); abort: undefined (want function); throwIfAborted: undefined (want function) |
| `fetch` |  | no | param: free name works, globalThis lacks it |
| `Headers` |  | no | wrong: case-insensitive-get: null (want x); case-insensitive-has: false (want true); set-merges-case: 2 (want 1); iterate-lowercase: [["X-A","1"]] (want [["x-a","1"]]) |
| `Request` |  | no | yes |
| `Response` |  | no: body = THROWS ReferenceError: Response is not defined | wrong: json-static: undefined (want function). body = [object Null] |
| `ReadableStream` |  | no | wrong: a stream made with new ReadableStream({ start(c) { c.enqueue('a'); c.close(); } }): getReader().read() never settles (see async.ReadableStream.read) |
| `WritableStream` |  | no | no |
| `TransformStream` |  | no | no |
| `TextEncoderStream` |  | no | no |
| `TextDecoderStream` |  | no | no |
| `CompressionStream` |  | no | no |
| `EventSource` |  | no | no |
| `lynx.EventSource` |  | no: lynx has no such member on this thread | wrong: against a standard text/event-stream server it opens, delivers no event, then errors: open, error error Error: errorStreamingMalformedResponse |
| `Blob` |  | no | no |
| `File` |  | no | no |
| `FormData` |  | no | no |
| `FileReader` |  | no | no |
| `WebSocket` |  | no | no |
| `__WebSocket__` |  | no | no: a wrapper parameter bound to undefined: reading a member is a TypeError, not a ReferenceError |
| `crypto` |  | no | no |
| `XMLHttpRequest` |  | no | no: a wrapper parameter bound to undefined: reading a member is a TypeError, not a ReferenceError |
| `MessageChannel` |  | no | no |
| `BroadcastChannel` |  | no | no |
| `URLPattern` |  | no | no |
| `localStorage` |  | no | no: a wrapper parameter bound to undefined: reading a member is a TypeError, not a ReferenceError |
| `sessionStorage` |  | no | no |
| `setImmediate` |  | no | no |
| `requestIdleCallback` |  | no | no |
| `WebAssembly` |  | no | wrong: present but hollow: instantiate: undefined (want function) |
| `setTimeout` |  | yes | param: free name works, globalThis lacks it |
| `clearTimeout` |  | yes | param: free name works, globalThis lacks it |
| `setInterval` |  | yes | param: free name works, globalThis lacks it. clear = number |
| `requestAnimationFrame` |  | yes | param: free name works, globalThis lacks it |
| `cancelAnimationFrame` |  | yes | param: free name works, globalThis lacks it |
| `console` |  | wrong: methods: trace,assert (want all) | wrong: methods: trace (want all) |
| `window` |  | no | no: a wrapper parameter bound to undefined: reading a member is a TypeError, not a ReferenceError |
| `document` |  | no | no: a wrapper parameter bound to undefined: reading a member is a TypeError, not a ReferenceError |
| `global` |  | yes: the bundler rewrites a free `global` to its own runtime global (__webpack_require__.g) | param: the bundler rewrites a free `global` to its own runtime global (__webpack_require__.g); free name works, globalThis lacks it. is-globalThis = true |
| `onerror` |  | no: typeof = undefined | no: typeof = undefined |
| `onunhandledrejection` |  | no: typeof = undefined | no: typeof = undefined |
| `addEventListener` |  | no | no |
| `matchMedia` |  | no | no |
| `Object.hasOwn` |  | no: call: THROWS TypeError: not a function (want true) | no: call: THROWS TypeError: Object.hasOwn is not a function (want true) |
| `String.prototype.replaceAll` |  | no: engine lacks it; the binding's fill (bytecode, minified name: name="ev") | no: engine lacks it; the binding's fill (its source shows: js name="g" function g(e,t){if(this===null\|\|void 0…) |
| `lynx.queueMicrotask` |  | no: lynx has no such member on this thread | yes |
| `lynx.performance` |  | yes: keys = _generatePipelineOptions,_onPipelineStart,_markTiming,_bindPipelineIDW… | yes: keys = _emitter,_generatePipelineOptions,_onPipelineStart,_markTiming,_profil… |
| `lynx.reportError` |  | yes | yes |
| `lynx.Promise` |  | no: lynx has no such member on this thread. is-bundle-Promise = false; is-global-Promise = false | yes: is-bundle-Promise = true; is-global-Promise = false |
| `Date#getTimezoneOffset` |  | yes: jan = -180; jul = -180; string = Wed Jul 15 2026 12:00:00 GMT+0300 | yes: jan = -180; jul = -180; string = Wed Jul 15 2026 12:00:00 GMT+0300 |
| `SystemInfo` |  | no: engine lacks it; the binding copies lynx.SystemInfo to the global. json = {"platform":"Android","pixelRatio":2.75,"pixelWidth":1080,"pixelHeight… | yes |
| `lynx.SystemInfo` |  | yes: json = {"platform":"Android","pixelRatio":2.75,"pixelWidth":1080,"pixelHeight… | no: lynx has no such member on this thread. json = undefined |
| `Intl` |  | no: keys = THROWS ReferenceError: Intl is not defined | no: keys = THROWS ReferenceError: Intl is not defined |

## async checks

| Row | Edition | `primjs-4.2-lynx-4.2-android-mt` | `primjs-4.2-lynx-4.2-android-bg` |
| --- | --- | --- | --- |
| `async.bundle.any` |  | yes: = 2 | no: THROWS TypeError: any is not a function |
| `async.bundle.allSettled` |  | yes: = rejected,fulfilled | yes: = rejected,fulfilled |
| `async.bundle.withResolvers` |  | no: THROWS TypeError: not a function | no: THROWS TypeError: t.withResolvers is not a function |
| `async.bundle.try` |  | no: THROWS TypeError: not a function | no: THROWS TypeError: t.try is not a function |
| `async.bundle.finally` |  | yes: = 5 | yes: = 5 |
| `async.bundle.all` |  | yes: = 1,2 | yes: = 1,2 |
| `async.bundle.race` |  | yes: = 6 | yes: = 6 |
| `async.global.any` |  | yes: = 2 | yes: = 2 |
| `async.global.allSettled` |  | yes: = rejected,fulfilled | yes: = rejected,fulfilled |
| `async.global.withResolvers` |  | no: THROWS TypeError: not a function | no: THROWS TypeError: t.withResolvers is not a function |
| `async.global.try` |  | no: THROWS TypeError: not a function | no: THROWS TypeError: t.try is not a function |
| `async.global.finally` |  | yes: = 5 | yes: = 5 |
| `async.global.all` |  | yes: = 1,2 | yes: = 1,2 |
| `async.global.race` |  | yes: = 6 | yes: = 6 |
| `async.queueMicrotask.order` |  | yes: = sync,queueMicrotask,promise,timeout | yes: = sync,queueMicrotask,promise,timeout |
| `async.lynx.queueMicrotask.order` |  | no: REJECTS TypeError: not a function | yes: = sync,lynx.queueMicrotask,timeout |
| `async.AbortSignal.timeout` |  | no: REJECTS ReferenceError: AbortSignal is not defined | no: REJECTS TypeError: AbortSignal.timeout is not a function |
| `async.AbortSignal.any` |  | no: THROWS ReferenceError: AbortController is not defined | no: THROWS TypeError: AbortSignal.any is not a function |
| `async.Response.text` |  | no: THROWS ReferenceError: Response is not defined | yes: = x |
| `async.Response.json-static` |  | no: THROWS ReferenceError: Response is not defined | no: THROWS TypeError: Response.json is not a function |
| `async.ReadableStream.read` |  | no: THROWS ReferenceError: ReadableStream is not defined | wrong: never settled within 2000 ms |

