// Page styles a test needs: a stylesheet put in the document head and removed when the test ends.
import { onTestFinished } from "vitest";

/** Adds a `<style>` holding `css` to the document head until the test ends. */
export function injectStyle(css: string): HTMLStyleElement {
	const style = document.head.appendChild(document.createElement("style"));
	style.textContent = css;
	onTestFinished(() => style.remove());
	return style;
}
