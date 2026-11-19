// ESTree nodes, with TypeScript's where the script has types, walked by shape: the walkers read
// whichever fields a node type has.

// oxlint-disable-next-line typescript/no-explicit-any -- AST nodes are walked by shape; every field read would need a cast
export type Node = any;
