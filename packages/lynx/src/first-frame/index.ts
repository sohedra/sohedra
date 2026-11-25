// The app's main-thread script: what the app's entries run on the main thread. Its main job is the
// first frame, which it records for the main-thread runtime to draw; it also holds the main-thread
// side of every public entry (`runOnBackground`, `mainThreadRef`, the stand-ins), which runs long
// after. A folder apart from `main-thread/` because it is a separate program: the two never import
// each other and share one global.

export {};
