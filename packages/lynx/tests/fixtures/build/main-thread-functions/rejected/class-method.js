// should_transform_in_class: a class method, and `this` inside it.
class Component {}

export class App extends Component {
	a = 1;

	onTap(event) {
		"main thread";
		console.log(event, this.a);
	}
}
