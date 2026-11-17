// should_not_capture_globals: names the engine provides are not captured.
export function Y() {
	"main thread";
	console.log(111);
	setTimeout(() => {});
	lynx.querySelector(".x");
	return SystemInfo.version;
}
