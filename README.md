# Online-Volunteer-Portal

## Admin saving
The “Save to GitHub” button uses a GitHub Personal Access Token stored in your browser session. Set the token in sessionStorage under the key `gh_admin_token` (matches `GITHUB_TOKEN_STORAGE_KEY` in `script.js`) before saving. If the token is missing or invalid, saving will be blocked.

Example (run in the browser console):
`sessionStorage.setItem('gh_admin_token', 'your-token-here')`
