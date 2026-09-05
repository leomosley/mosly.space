# mosly.space

A bare-bones vanilla HTML, CSS, and JavaScript site deployed to Nekoweb.

## Structure

```text
public/
  index.html
  not_found.html
  styles.css
  script.js
  elements.css
```

Everything in `public/` is uploaded to the root of the site.

## Local development

Install the development dependency:

```sh
bun install
```

Start the development server:

```sh
bun run dev
```

Open <http://localhost:3000>. Changes inside `public/` automatically reload the page.

In VS Code, you can also run **Tasks: Run Build Task** or press `Ctrl+Shift+B` to start the server.

## Deployment

1. Create the site in Nekoweb and configure `mosly.space` in its domain settings.
2. Configure the DNS records shown by Nekoweb with your DNS provider.
3. Generate an API key at <https://nekoweb.org/api>.
4. In the GitHub repository, open **Settings > Secrets and variables > Actions**.
5. Add a repository secret named `NEKOWEB_API_KEY` containing that API key.
6. Push to `main`.

The workflow in `.github/workflows/deploy.yml` deploys `public/` after every push to `main`. It can also be run manually from the repository's **Actions** tab.
