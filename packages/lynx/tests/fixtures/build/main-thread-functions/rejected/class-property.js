// should_transform_in_class_property: an arrow in a class property, with a
// captured value and `this`.
const a = 1;
class Component {}

export class App extends Component {
	onTap = (event) => {
		"main thread";
		console.log(event, a);
		console.log(this.a);
	};
}
