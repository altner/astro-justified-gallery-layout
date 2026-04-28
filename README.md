# astro-justified-gallery-layout

Monorepo for the [`@altner/astro-justified-gallery-layout`](packages/astro-justified-gallery-layout) npm package — a justified (Flickr-style) photo gallery for Astro with EXIF/IPTC/GPS extraction, LQIP placeholders, virtualized rendering for massive collections, and a drop-in modal lightbox.

## Structure

```
.
├── packages/
│   └── astro-justified-gallery-layout/  ← the published package
└── demo/                                 ← Astro app for development & testing
```

- **Package** — see [packages/astro-justified-gallery-layout/README.md](packages/astro-justified-gallery-layout/README.md) for installation, API, and recipes (this is what gets published to npm).
- **Demo** — see [demo/README.md](demo/README.md) for how to run the local Astro test app.

## Development

```sh
# Install all workspaces (Node ≥ 18)
npm install

# Run the demo against the live package source (changes pick up via HMR)
npm run dev -w demo
# → http://localhost:4321
```

Drop your own photos into [`demo/src/assets/photos/`](demo/src/assets/photos/) — that folder is `.gitignore`d so you bring your own collection. Subdirectories are scanned recursively; EXIF/IPTC/GPS metadata is read automatically and powers the year/month filter UI.

## Publishing

The package metadata lives in [packages/astro-justified-gallery-layout/package.json](packages/astro-justified-gallery-layout/package.json). To verify the tarball before publishing:

```sh
cd packages/astro-justified-gallery-layout
npm publish --dry-run
```

To actually publish (requires `npm login` with access to the `@altner` scope):

```sh
npm publish
```

`publishConfig.access: "public"` is already set in `package.json` so the scoped package goes public.

## License

[MIT](packages/astro-justified-gallery-layout/LICENSE) — Adrian Altner
