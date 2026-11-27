# Games

Browser games and playable pages, free to play: https://games.flisk.si

## Add a game

Open a pull request that adds one entry to [`public/catalog.json`](public/catalog.json) and one 16:9 image to `public/thumbs/`.

| Field | Meaning |
| --- | --- |
| `id` | Lowercase letters, digits and dashes. The page is `/play/<id>`. |
| `title`, `author`, `description` | Plain text. |
| `url` | The game's `https` address. You host it. |
| `thumb` | `/thumbs/<name>.png`, `.jpg` or `.webp`. |
| `category` | One word or two. Each category becomes a filter. |
| `added` | `YYYY-MM-DD`. |
| `embed` | `true` to play inside Games. Use `false` if your site blocks framing (`x-frame-options` or CSP `frame-ancestors`); to allow it, add `https://games.flisk.si` to `frame-ancestors`. |

## Sign-in

GitHub sign-in goes through [flisk-sh/login](https://github.com/flisk-sh/login). This repo holds no secrets: it checks the login token with a public key and keeps sessions in Cloudflare KV. Saved games stay in the visitor's browser.

## Run, test, deploy

```bash
bun run dev
```

```bash
bun test
```

```bash
bun run deploy
```

## License

MIT. Each game belongs to its author.
