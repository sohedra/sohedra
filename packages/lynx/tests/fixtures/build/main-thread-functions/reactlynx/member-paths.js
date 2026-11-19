// should_extract_member_expr: only the members a body reads are captured,
// each object as deep as it is read.
const aaaa = { bbbb: {} };
const cccc = { dddd: "key" };
const hhhh = { iiii: { current: { jjjj: 1 } } };
const llll = { mmmm: { nnnn: 1 } };
const oooo = { pppp: { qqqq: 1 }, qqqq: 2 };
const rrrr = { ssss: { tttt: 1 } };
const uuuu = { "__??__": 1 };
const enabled = true;
const handlers = { start() {} };
const vvvv = { wwww: { xxxx: 1 } };

export function onTap() {
	"main thread";
	console.log(aaaa.bbbb[cccc.dddd].eeee);
	console.log(aaaa.bbbb[cccc.dddd].eeee);
	console.log(hhhh.iiii.current.jjjj);
	console.log(hhhh.iiii.current.jjjj);
	console.log(llll.mmmm.nnnn, llll.mmmm, llll);
	console.log(oooo.pppp.qqqq, oooo.pppp, oooo.qqqq);
	console.log(rrrr, rrrr.ssss, rrrr.ssss.tttt);
	console.log(uuuu["__??__"]);
	if (enabled && handlers?.start) handlers.start();
	return vvvv?.wwww?.xxxx;
}
