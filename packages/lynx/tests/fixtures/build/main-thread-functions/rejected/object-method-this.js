// An object method that reads `this`.
export const counter = {
	count: 0,
	add(by) {
		"main thread";
		this.count += by;
		return this.count;
	},
};
