// should_transform_arrow_function
const y1 = [1, 2, 3];
const y2 = 0;

export const X = (event) => {
	"main thread";
	console.log(event, y1[y2 + 1]);
};
