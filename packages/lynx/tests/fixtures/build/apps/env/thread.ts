import { background, mainThread } from "@sohedra/lynx/environment";

// Read in another module than the one that branches on it: the bundler decides the branch there.
export const onMainThread: boolean = mainThread;
export const onBackground: boolean = background;
