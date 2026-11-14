# Contributing

Thank you for improving Convert Image.

## Development workflow

1. Fork or clone the repository.
2. Create a focused branch:

   ```bash
   git checkout -b fix/short-description
   ```

3. Start a local static server:

   ```bash
   python3 -m http.server 8080
   ```

4. Test the affected converter with representative files in a current browser.
5. Check desktop and mobile layouts.
6. Confirm that generated files open correctly and use the expected format—not only the expected file extension.
7. Submit a pull request describing the problem, solution, pages tested, browser, and sample file characteristics.

## Contribution guidelines

- Keep changes focused and avoid unrelated formatting rewrites.
- Do not commit private files, confidential images, credentials, or analytics secrets.
- Preserve the existing static-site structure unless the change intentionally includes a migration plan.
- Use clear names for converter scripts and keep source/destination terminology consistent.
- Update the README, privacy information, sitemap, and affected page copy when behavior changes.
- Check the license before adding a third-party dependency or asset.
- Do not claim that a format, browser, or privacy behavior is supported unless it has been verified.

## Reporting bugs

Include:

- the converter URL or file path;
- source and destination formats;
- browser and operating system;
- approximate file size and relevant image dimensions or PDF page count;
- expected and actual behavior; and
- console errors, with private information removed.

Do not attach confidential source files to a public issue.
