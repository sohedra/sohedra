// What `import "background-only"` resolves to. It exports nothing: the build finds the import in
// a module, and on the main thread replaces that module with a stub that has the same exports.

export {};
