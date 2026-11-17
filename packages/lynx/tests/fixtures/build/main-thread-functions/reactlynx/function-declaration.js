// should_transform_fn_decl: an exported function declaration.
const x = 1;

export default function useExposure(exposureArgs) {
	"main thread";
	console.log("useExposure2");
	console.log(exposureArgs);
	return x;
}
