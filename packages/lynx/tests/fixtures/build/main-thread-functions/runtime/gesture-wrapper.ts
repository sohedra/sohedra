// The shape of a gesture builder's wrapper: a main-thread arrow made inside another function, with a
// class declared in its body, that captures the function's parameters.

interface Native {
	__SetGestureState(element: unknown, id: number, state: number): unknown;
}

type Callback = (event: { currentTarget: unknown }, state: { active(): unknown }) => void;

export function wrapCallback(callback: Callback, id: number): Callback {
	return ((event: { currentTarget: unknown }, native: Native) => {
		"main thread";
		class GestureStateManager {
			gestureId: number;
			native: Native;
			element: unknown;

			constructor(gestureId: number, native: Native, element: unknown) {
				this.gestureId = gestureId;
				this.native = native;
				this.element = element;
			}

			active() {
				return this.native.__SetGestureState(this.element, this.gestureId, 1);
			}
		}
		return callback(event, new GestureStateManager(id, native, event.currentTarget));
	}) as unknown as Callback;
}
