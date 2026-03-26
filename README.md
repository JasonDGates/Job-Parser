# Gmail Job Sheet CLI

Local TypeScript CLI that scans Gmail for job emails from:
- LinkedIn
- Welcome to the Jungle

It extracts:
- Date MM-DD-YYYY
- Job Title
- Company
- Location
- Link to the application

Then appends only new rows into Google Sheets by deduplicating on normalized application link.

## Project Structure

- `src/index.ts` CLI entrypoint
- `src/cli.ts` argument parsing
- `src/config/env.ts` environment loading/validation
- `src/google/auth.ts` OAuth flow and token storage
- `src/google/gmailClient.ts` Gmail list/get helpers
- `src/google/sheetsClient.ts` Sheets read/append/header validation
- `src/parsers/linkedinParser.ts` LinkedIn parser
- `src/parsers/wttjParser.ts` Welcome to the Jungle parser
- `src/parsers/shared.ts` shared text/link normalization
- `src/scan/dateRanges.ts` mode/date calculations
- `src/scan/gmailQueries.ts` Gmail query builders
- `src/scan/runner.ts` orchestration + dedupe + write
- `src/types/job.ts` types
- `src/errors/appErrors.ts` typed app errors
- `src/lib/logger.ts` logging

## Prerequisites

- Node.js 20+
- pnpm
- A Google account with Gmail and Google Sheets access

## Google Cloud Setup

1. Create a Google Cloud project:
   - Open [Google Cloud Console](https://console.cloud.google.com/).
   - Create a new project (or choose an existing one).
2. Enable APIs:
   - Gmail API
   - Google Sheets API
3. Configure OAuth consent screen:
   - User type: External (or Internal if in Workspace domain).
   - Fill required app details.
   - Add your Google account as a test user if app is not published.
4. Create OAuth Client ID credentials:
   - Credentials -> Create Credentials -> OAuth client ID.
   - Application type: Desktop app.
   - Download JSON and save as `credentials.json` in project root (or another path).

## Required OAuth Scopes

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/spreadsheets`

These are requested automatically during first CLI auth.

## Local Auth Flow

On first run:
- CLI opens browser for Google OAuth.
- After consent, access/refresh token is saved to `token.json` (configurable).
- Next runs reuse token for non-interactive execution.

## Google Sheet Setup

1. Create/open your target spreadsheet.
2. Create a worksheet tab (example: `Applications`).
3. Ensure header row exists in row 1, exact order:
   - `Date MM-DD-YYYY`
   - `Job Title`
   - `Company`
   - `Location`
   - `Link to the application`
4. If row 1 is blank, CLI auto-writes this exact header set.
5. Share/edit access:
   - Since this is OAuth user auth, the authenticated user must have edit access.

### How Spreadsheet/Worksheet Are Selected

- Spreadsheet via `GOOGLE_SPREADSHEET_ID`
- Worksheet tab via `GOOGLE_WORKSHEET_NAME`

## Installation

```bash
pnpm install
```

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Fill values in `.env`.

## Environment Variables

- `GOOGLE_OAUTH_CREDENTIALS_PATH` path to downloaded OAuth desktop credentials JSON
- `GOOGLE_OAUTH_TOKEN_PATH` path for token cache file (default: `token.json`)
- `GOOGLE_SPREADSHEET_ID` spreadsheet ID from sheet URL
- `GOOGLE_WORKSHEET_NAME` worksheet tab name (for example `Applications`)
- `GMAIL_USER_ID` Gmail user ID (`me` recommended)
- `DEBUG` set `1` for debug logs

## CLI Usage

```bash
pnpm start -- --mode <full|30d|daily|custom> [--start YYYY-MM-DD --end YYYY-MM-DD]
```

### Scan Modes

1. Full scan (June 1, 2025 to now):

```bash
pnpm start -- --mode full
```

2. Last 30 days:

```bash
pnpm start -- --mode 30d
```

3. Daily (today + yesterday):

```bash
pnpm start -- --mode daily
```

4. Custom inclusive range:

```bash
pnpm start -- --mode custom --start 2026-01-01 --end 2026-01-31
```

## Duplicate Detection

- Reads existing links in sheet column E (`Link to the application`).
- Normalizes links before comparison:
  - Decodes escaped entities
  - Removes known tracking params
  - Removes fragments
  - Canonicalizes LinkedIn `.../jobs/view/<id>` links
- Skips insertion when normalized link already exists.
- Also deduplicates within the current run for idempotency.

## Parsing Notes and Assumptions

- LinkedIn:
  - Extracts job card links, title text, and adjacent company/location summary.
  - Uses canonical `https://www.linkedin.com/jobs/view/<id>` when possible.
- Welcome to the Jungle:
  - Extracts title from `<strong>`, location from adjacent `<em>`, company from nearest logo alt text (`<Company> logo`), and link from card anchor.
  - In provided sample, links are SendGrid tracking URLs; direct canonical job URL is not clearly present in raw HTML. The tool therefore normalizes tracked links for dedupe instead of inventing canonical URLs.
- Date field uses Gmail message date formatted as `MM-DD-YYYY`.
- If `Location` is missing, it is stored as blank.

## Error Handling

The CLI handles and logs:
- OAuth authentication failures
- Missing/invalid sheet access
- Gmail API and rate-limit failures (retry on retryable status)
- Malformed message parse failures (skip and continue)
- Missing required extracted fields (skip where necessary)
- Duplicate rows (skip)

## Daily Automation

After first interactive auth, schedule daily runs:

- Windows Task Scheduler:
  - Program: `pnpm`
  - Arguments: `start -- --mode daily`
  - Start in: project folder
- Linux/macOS cron example:
  - `0 8 * * * cd /path/to/project && pnpm start -- --mode daily`

Because token is cached, scheduled runs are usually non-interactive.

## Future Improvements

- Add more job sources (Indeed, Greenhouse emails, Lever emails)
- Add CSV/JSON export mode
- Add checkpointing by Gmail history ID for faster incremental scans
- Add dry-run mode and parser diagnostics
# Job Parser

A simple Python script to extract job information from LinkedIn job alert HTML emails and save them to a CSV file.

## Features

- Extracts job title, company name, location, salary, and job link from HTML emails
- Saves data to CSV with headers: Date, Job Name, Company Name, Location, Salary, Link
- Appends new jobs to existing CSV file (doesn't overwrite)
- Easy to use with interactive prompts

## Installation

1. Make sure you have Python 3.7 or higher installed on your system.

2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

Or if you're using `pip3`:

```bash
pip3 install -r requirements.txt
```

## Usage

### Basic Usage

1. Save your HTML email content to a file (e.g., `example.html`)

2. Run the script:

```bash
python parse_jobs.py
```

Or if you're using `python3`:

```bash
python3 parse_jobs.py
```

3. Follow the prompts:
   - Enter the path to your HTML file (or press Enter to use `example.html`)
   - Review the found jobs
   - Enter the CSV file name (or press Enter to use `jobs.csv`)

### Example Workflow

1. **First time using the script:**
   ```bash
   python parse_jobs.py
   ```
   - Enter HTML file path: `email1.html`
   - CSV file name: `jobs.csv` (or just press Enter)
   - This creates a new `jobs.csv` file with the jobs from `email1.html`

2. **Adding more jobs from another email:**
   ```bash
   python parse_jobs.py
   ```
   - Enter HTML file path: `email2.html`
   - CSV file name: `jobs.csv` (or just press Enter)
   - This appends the new jobs to the existing `jobs.csv` file

### Getting HTML from Email

To get the HTML from your email:

1. **Gmail:**
   - Open the email
   - Click the three dots menu (⋮) in the top right
   - Select "Show original"
   - Copy all the HTML content
   - Save it to a `.html` file

2. **Outlook:**
   - Open the email
   - Right-click on the email body
   - Select "View Source" or "View Page Source"
   - Copy the HTML content
   - Save it to a `.html` file

3. **Other Email Clients:**
   - Look for options like "View Source", "Show Original", or "View HTML"
   - Copy the HTML content
   - Save it to a `.html` file

## Output Format

The CSV file will have the following columns:

- **Date**: The date when the script was run (YYYY-MM-DD format)
- **Job Name**: The job title
- **Company Name**: The company name
- **Location**: The job location (city, state, and work type if available)
- **Salary**: The salary range (if available)
- **Link**: The LinkedIn job posting URL

## Troubleshooting

### "No jobs found in the HTML file"

This could happen if:
- The HTML structure is different from expected
- The email format has changed
- The HTML file is corrupted or incomplete

**Solution:** Make sure you copied the complete HTML from the email, including all the `<table>`, `<div>`, and other HTML tags.

### "ModuleNotFoundError: No module named 'bs4'"

This means BeautifulSoup4 is not installed.

**Solution:** Run `pip install -r requirements.txt` to install the required dependencies.

### Jobs are duplicated

The script tries to prevent duplicates by tracking job URLs, but if the same job appears with different URLs, it may be added multiple times.

**Solution:** You can manually remove duplicates from the CSV file, or use Excel/Google Sheets to remove duplicates.

## Notes

- The script automatically adds the current date to each job entry
- If a job doesn't have a salary listed, the Salary column will be empty
- The script preserves existing data in the CSV file when appending new jobs
- Job links are cleaned to remove tracking parameters and use the standard LinkedIn job URL format

## Requirements

- Python 3.7+
- beautifulsoup4
- lxml







