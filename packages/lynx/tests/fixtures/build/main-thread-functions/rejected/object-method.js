// should_transform_object_methods: a method of an object literal.
const base = 1;

export const valueType = {
	type: "@test/value",
	create(initialValue) {
		"main thread";
		return initialValue + base;
	},
};
