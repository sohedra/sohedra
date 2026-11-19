// should_transform_in_class_js_capture_values and its static form: class
// methods that capture a value of the file.
const a = 1;
class Component {}

export class App extends Component {
	onTap(event) {
		"main thread";
		console.log(event, a);
	}

	static onStatic(event) {
		"main thread";
		console.log(event, a);
	}
}
