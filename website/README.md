# Project website

Static public website for Nosana Adapter Foundry.

## Local preview

```bash
python3 -m http.server 4173 --directory website
```

## Vercel

Import the repository into Vercel and set **Root Directory** to `website`. Use
the **Other** framework preset. No build command or environment variables are
required.

After the public GitHub repository exists, set `GITHUB_URL` in `app.js` to its
URL before deploying.
