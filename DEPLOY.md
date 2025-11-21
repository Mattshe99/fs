# Deploying to GitHub Pages

## Step 1: Create GitHub Repository

1. **Create a new GitHub repository**
   - Go to https://github.com/new
   - Name it (e.g., "earwax-offline")
   - Make it **public** (required for free GitHub Pages)
   - Don't initialize with README

## Step 2: Copy Audio Folder (Required for GitHub Pages)

GitHub Pages needs the actual Audio files, not a junction. Copy the Audio folder:

**What this does:** Copies all the .ogg audio files from the `Audio` folder into `earwax-pwa\Audio` so GitHub Pages can serve them.

**Run this command in Command Prompt:**
```cmd
cd C:\Users\matts\Downloads\fakinIt
xcopy /E /I Audio earwax-pwa\Audio
```

**Or use File Explorer:**
1. Open File Explorer
2. Go to `C:\Users\matts\Downloads\fakinIt\Audio`
3. Select all files (Ctrl+A)
4. Copy (Ctrl+C)
5. Go to `C:\Users\matts\Downloads\fakinIt\earwax-pwa`
6. Create a new folder called `Audio` (if it doesn't exist)
7. Paste the files (Ctrl+V)

## Step 3: Install Git (If You Don't Have It)

You need Git to upload files to GitHub. Choose one option:

### Option A: GitHub Desktop (Easiest - Recommended)
1. Download from: https://desktop.github.com/
2. Install and sign in with your GitHub account
3. Skip to "Step 4: Upload Files" below

### Option B: Git for Windows (Command Line)
1. Download from: https://git-scm.com/download/win
2. Install with default options
3. Use the commands in "Step 4: Upload Files" below

### Option C: Upload via Web (No Git Needed)
1. Create repository on GitHub.com (see Step 1)
2. Click "uploading an existing file" or drag and drop
3. Upload the entire `earwax-pwa` folder contents
4. Skip to Step 5 (Enable GitHub Pages)

## Step 4: Upload Files to GitHub

### If Using GitHub Desktop:
1. Open GitHub Desktop
2. Click **File → Add Local Repository**
3. Browse to `C:\Users\matts\Downloads\fakinIt`
4. Click **Publish repository** (make it public)
5. Wait for upload to complete

### If Using Command Line:
Open Command Prompt and run:

```cmd
cd C:\Users\matts\Downloads\fakinIt
git init
git add .
git commit -m "Initial commit - Earwax Offline game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

**Replace:**
- `YOUR_USERNAME` with your GitHub username
- `YOUR_REPO_NAME` with your repository name

**Note:** The first push might take a while since it includes all the audio files.

## Step 4: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll to **Pages** section (left sidebar)
4. Under **Source**, select:
   - Branch: `main`
   - Folder: `/earwax-pwa`
5. Click **Save**

Your site will be available at:
`https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

**Note:** It may take 1-2 minutes for the site to be available after first deployment.

## Step 5: Test on Phone

1. **Open the URL on your phone's browser:**
   - `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

2. **First visit:**
   - The app will load and cache files for offline use
   - Wait a moment for all assets to load

3. **Install to Home Screen (Optional):**
   - **iOS:** Tap Share → Add to Home Screen
   - **Android:** Tap menu → Add to Home Screen / Install App

4. **Test offline:**
   - After first visit, turn on airplane mode
   - The app should still work!

## Troubleshooting

- **Service worker not working?** Make sure you're using HTTPS (GitHub Pages provides this automatically)
- **Audio not playing?** Check browser console for errors
- **Changes not showing?** Hard refresh (Ctrl+Shift+R or Cmd+Shift+R) or clear cache

## Notes

- The app is configured to work from the `/earwax-pwa` subdirectory
- All audio files are included in the repository
- The service worker caches everything for offline use
- HTTPS is required for service workers (GitHub Pages provides this)

