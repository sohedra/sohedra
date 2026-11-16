# Sohedra

Svelte for the web and for native apps.

- **UI components:** headless, accessible components for Svelte and SvelteKit.
- **Router:** a typed router for client-side Svelte apps.
- **Native apps:** a framework for iOS and Android apps in Svelte, built on the two above, rendering
  real native views through [Lynx](https://lynxjs.org).

The components and the router keep one API on the web and in native apps.

> **Status: early development.** Nothing is published yet.

## Roadmap

1. **Now:** the Svelte binding for Lynx (`@sohedra/lynx`) moves into this repository, with its
   playground.
2. **UI components** for the web and for Lynx move in, and the web set reaches parity, including
   Combobox and Autocomplete.
3. **The native framework:** app config, the app template, `prebuild`, running on iOS and Android,
   and a first native module (haptics).
4. **The router,** then a development client and over-the-air updates.

The first npm release waits for Svelte's custom-renderer pull request
([#18042](https://github.com/sveltejs/svelte/pull/18042)). Planned breaking changes are announced in
[Discussions](https://github.com/sohedra/sohedra/discussions/categories/announcements).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Everyone taking part follows the
[Code of Conduct](https://github.com/sohedra/.github/blob/main/CODE_OF_CONDUCT.md). To report a
vulnerability, see the [security policy](https://github.com/sohedra/.github/blob/main/SECURITY.md).

## License

[Apache-2.0](./LICENSE), unless a package's own license says otherwise.
