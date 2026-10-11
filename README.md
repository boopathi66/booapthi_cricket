# CricScout

Career records and scouting notes on international cricketers. It is a plain website: no build step, no framework.

## What each file does

| File | Job |
| --- | --- |
| `index.html` | The structure of the page: headings, the table, the forms. |
| `style.css` | How it looks: colours, fonts, spacing. Colours are at the top of the file. |
| `script.js` | How it behaves: search, filters, player pages, the chart, the login. |
| `data.json` | The players. Edit this file to add or change a player. |
| `config.js` | Login settings (empty until you turn the login on). |
| `players.sql` | Only needed for the login setup below. |

## See it on your computer

Opening `index.html` by double-clicking won't load `data.json` (browsers block that). Use a small local server instead:

- **VS Code:** install the "Live Server" extension, right-click `index.html`, choose "Open with Live Server".
- **Or in a terminal**, inside this folder: `python3 -m http.server 8000`, then open http://localhost:8000

## Put it online (free)

1. Upload all the files to your GitHub repository (replace the old ones).
2. In the repository: Settings, then Pages, then pick the `main` branch and the root folder, and save.
3. After a minute your site is at `https://<your-username>.github.io/<repo-name>/`.

## Add a player

Open `data.json`, copy a whole player block (from `{` to its closing `}`), paste it after the last player, and put a comma between the two blocks. Then change the values. Rules that catch most beginners:

- Text goes in double quotes. Numbers don't.
- Every item in a list needs a comma after it except the last one.
- `category` must be exactly `Batter`, `Bowler` or `All-Rounder` (the filter uses it).
- `id` is lower-case with dashes. It becomes the page address (`#virat-kohli`).
- Batters have `runs` and `strikeRate`. Bowlers have `wickets` and `economy`.
- For the chart, add `"phaseStrikeRates": { "powerplay": 0, "middle": 0, "death": 0 }`, or `"phaseEconomy"` for a bowler. If neither is there, the page says the figures aren't added yet.

If the page goes blank, paste your file into https://jsonlint.com. It points to the line with the mistake.

## Turning on the login

Why this needs a service: a website made only of files on GitHub Pages has no server, so it cannot check a password safely. Any password check written in `script.js` can be read and skipped by anyone who opens the browser tools. (The first version of this site stored passwords as plain text in the browser for that reason.) The safe way is to let a service that does only this job handle accounts. These steps use Supabase, which has a free plan.

1. Create a free project at https://supabase.com.
2. Go to Authentication and look at the Email settings. Keep "Confirm email" switched on and set the minimum password length to 8 or more. (Menu names change now and then; look for the closest match.)
3. Under Authentication, find URL Configuration. Set the Site URL to your GitHub Pages address.
4. Go to Project Settings, then API. Copy the Project URL and the `anon` public key into `config.js`. The anon key is meant to be public. **Never** put the `service_role` key anywhere in this site.
5. Go to the SQL Editor, paste everything from `players.sql`, and run it. This creates a `players` table with a rule that only signed-in people can read it.
6. Open your site and create an account. Confirm the email, then sign in.
7. Once you can see the players after signing in, **delete `data.json` from the repository.** If it stays, anyone can still open it directly and the login protects nothing.

From then on, add or change players in the Supabase Table Editor (the `data` column holds the same JSON as `data.json`).

Still to add later: a "forgot password" flow. Supabase supports it (`resetPasswordForEmail`), but it needs one more screen.

## Security checklist

- Passwords are never stored by this site. Supabase hashes them.
- The site must be served over https (GitHub Pages does this).
- The data is protected by the database rule in step 5, not by hiding the page.
- Keep email confirmation on and passwords at 8+ characters.
- Never commit secret keys to GitHub. Only the public `anon` key goes in `config.js`.
