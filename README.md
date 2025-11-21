# Earwax Offline

A party game PWA for assembling soundboards offline. Players take turns creating sound combinations to match prompts, and a judge picks the winner.

## How to Play

1. Add 3-8 players
2. Each round, a judge picks a prompt
3. Non-judge players select 2 sounds to match the prompt
4. Judge listens to all combinations and picks the winner
5. First player to 3 points wins!

## Deployment

This app is designed to work offline as a Progressive Web App (PWA).

### Local Development

```cmd
cd earwax-pwa
py -m http.server 8000
```

Then open http://localhost:8000

### GitHub Pages

The app is configured to deploy from the `earwax-pwa` folder. See DEPLOY.md for detailed instructions.

## Features

- Offline-first PWA
- Text-to-speech for prompts
- Works on mobile devices
- Installable to home screen

