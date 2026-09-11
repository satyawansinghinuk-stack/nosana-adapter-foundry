# Project website

Static public website for Nosana Adapter Foundry.

Live: https://nosana-adapter-foundry.vercel.app/

## Local preview

```bash
python3 -m http.server 4173 --directory website
```

## Vercel

Deployed as its own Vercel project, `nosana-adapter-foundry`, with **Root
Directory** set to `website` and the **Other** framework preset. No build
command or environment variables are required. This project is separate from
any other Vercel project in the same account; deploying it does not affect
them.

`GITHUB_URL` in `app.js` already points at the public repository.
