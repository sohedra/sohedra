// A library as svelte-package leaves it: JavaScript, main-thread functions, and a package that says
// it has no side effects. A module of its own for each function, as a bundler may leave one out.
export { quadruple } from "./quadruple.js";
export { triple } from "./triple.js";
export { widen } from "./widen.js";
