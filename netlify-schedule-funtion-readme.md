Yes. Use Netlify’s local dev server and invoke the function manually (scheduled functions don’t auto‑run locally).
Quick local test
Ensure NETLIFY_DATABASE_URL is set in .env.local (or .env).
Install Netlify CLI if you don’t have it:
npm install -g netlify-cli (or use npx netlify-cli)
Start Netlify dev server:
netlify dev
Call the function manually:
http://localhost:8888/.netlify/functions/scrape-regattas
Alternative invocation (no browser)
netlify functions:invoke scrape-regattas
Notes
The schedule() trigger won’t fire locally; you have to invoke it yourself.
If you want, I can add a small test harness to run a single regatta URL without Netlify CLI.