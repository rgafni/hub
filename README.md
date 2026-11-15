# Roni

One front door for Roni's apps: Home (Gafni House), Work (Recruiting), TTG (TTG Ops), Calls (Katya Calls) and Steady.

- Every tile opens the app at its own link. Nothing is merged. Steady and Katya Calls stay standalone apps.
- One personal link (`#home=..&work=..&ttg=..&calls=..`) signs this browser in to all four, saving each key where that app already keeps it. Every app's own server still checks every request.
- A link that is not Roni's only sees "This link only opens Home". It fails closed.
- Steady is never read. Its notes stay on the phone, so its tile has no count.
- No keys or data live in this repo.
