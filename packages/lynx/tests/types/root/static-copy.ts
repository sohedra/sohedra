// Checked by `pnpm check`, not run. `createStaticCopy` copies a node or a list of nodes into a
// container node, with options; what it returns lists the copies and removes them.

import { createStaticCopy } from "@sohedra/lynx";
import type { StaticCopy, StaticCopyOptions } from "@sohedra/lynx";

type Node = Parameters<typeof createStaticCopy>[1];
declare const view: Node;
declare const text: Node;
declare const nodes: Node[];
declare const frozen: readonly Node[];

const copy: StaticCopy = createStaticCopy(view, text);
const first: Node | undefined = copy.nodes[0];
const removed: void = copy.remove();
void [first, removed];
createStaticCopy(nodes, view);
createStaticCopy(frozen, view, { keepIds: true });
createStaticCopy([view, text], view, {});
const options: StaticCopyOptions = { keepIds: false };
createStaticCopy(view, view, options);

// @ts-expect-error the container is required: it is the second argument.
createStaticCopy(view);
// @ts-expect-error the container is the second argument, not a field of the options.
createStaticCopy(view, { keepIds: true });
// @ts-expect-error the container is one node, not a list.
createStaticCopy(view, nodes);
// @ts-expect-error what is copied is a node or nodes, not a selector.
createStaticCopy("view", view);
// @ts-expect-error keepIds is a boolean.
createStaticCopy(view, view, { keepIds: "yes" });
// @ts-expect-error the copies are a list to read, not to change.
copy.nodes.push(view);
// @ts-expect-error remove takes no argument.
copy.remove(view);
