// should_transform_function_expr
const y1 = [1, 2, 3];
const y2 = 0;

export const X = function (event) {
	"main thread";
	console.log(event, y1[y2 + 1]);
};
