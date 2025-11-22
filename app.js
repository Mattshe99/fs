const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;
const PROMPTS_PER_ROUND = 5;
const SOUNDS_PER_TURN = 6;
const POINTS_TO_WIN = 3;
const SOUND_GAP_MS = 100;
const PLAYER_GAP_MS = 1500;

const state = {
  stage: "loading",
  players: [],
  scores: {},
  judgeIndex: null,
  promptOptions: [],
  promptBag: [],
  promptLibrary: [],
  currentPrompt: null,
  promptTarget: null,
  pendingPlayers: [],
  activePlayer: null,
  activeSelection: [],
  soundOptions: [],
  audioLibrary: [],
  audioById: new Map(),
  submissions: [],
  playbackQueue: [],
  isPlaying: false,
  currentlyRevealedSounds: null,
  lastWinner: null,
  winner: null,
  errorMessage: "",
  loadingProgress: 0,
  totalAudioFiles: 0,
};

const appRoot = document.getElementById("app");
const connectionPill = document.getElementById("connection-pill");

init();

async function init() {
  handleConnectionChange();
  window.addEventListener("online", handleConnectionChange);
  window.addEventListener("offline", handleConnectionChange);

  try {
    const [audioRes, promptRes] = await Promise.all([
      fetch("data/audio.json"),
      fetch("data/prompts.json"),
    ]);

    state.audioLibrary = await audioRes.json();
    state.audioById = new Map(state.audioLibrary.map((item) => [item.id, item]));
    state.promptLibrary = await promptRes.json();
    rebuildPromptBag();
    
    // Preload all audio files
    state.totalAudioFiles = state.audioLibrary.length;
    state.loadingProgress = 0;
    render(); // Show loading screen with progress
    await preloadAllAudio();
    
    state.stage = "lobby";
  } catch (error) {
    console.error(error);
    state.stage = "error";
    state.errorMessage = "Unable to load local data files.";
  }

  render();
  registerServiceWorker();
}

function handleConnectionChange() {
  if (!connectionPill) return;
  const online = navigator.onLine;
  connectionPill.textContent = online ? "online" : "offline";
  connectionPill.className = `connection-pill ${online ? "online" : "offline"}`;
}

function render() {
  let markup = "";
  switch (state.stage) {
    case "loading":
      markup = renderLoading();
      break;
    case "error":
      markup = renderError();
      break;
    case "lobby":
      markup = renderLobby();
      break;
    case "promptSelection":
      markup = renderPromptSelection();
      break;
    case "submissionLobby":
      markup = renderSubmissionLobby();
      break;
    case "soundPicker":
      markup = renderSoundPicker();
      break;
    case "playback":
      markup = renderPlayback();
      break;
    case "judging":
      markup = renderJudging();
      break;
    case "winner":
      markup = renderWinner();
      break;
    default:
      markup = "<p>Unknown state.</p>";
  }
  appRoot.innerHTML = markup;
  attachHandlersForStage();
}

function renderLoading() {
  const progress = state.totalAudioFiles > 0 
    ? Math.round((state.loadingProgress / state.totalAudioFiles) * 100) 
    : 0;
  const loaded = state.loadingProgress;
  const total = state.totalAudioFiles;
  
  return `
    <section class="panel">
      <h2>Loading audio files…</h2>
      <p>Caching ${total} sounds for offline play</p>
      <div style="margin: 20px 0;">
        <div style="background: #374151; border-radius: 8px; height: 24px; overflow: hidden; position: relative;">
          <div style="background: #3b82f6; height: 100%; width: ${progress}%; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">
            ${progress}%
          </div>
        </div>
      </div>
      <p style="font-size: 14px; color: #9ca3af;">${loaded} / ${total} files loaded</p>
    </section>
  `;
}

function renderError() {
  return `
    <section class="panel">
      <h2>Load error</h2>
      <p>${state.errorMessage}</p>
      <button id="retry-load">Retry</button>
    </section>
  `;
}

function renderLobby() {
  const chips =
    state.players.length === 0
      ? `<p class="help-text">Add between ${MIN_PLAYERS} and ${MAX_PLAYERS} players.</p>`
      : state.players
          .map(
            (player) => `
        <span class="player-chip">
          ${player}
          <button type="button" data-remove="${player}" aria-label="Remove ${player}">×</button>
        </span>
      `,
          )
          .join("");

  const canStart = state.players.length >= MIN_PLAYERS;

  return `
    <section class="panel">
      <h2>Players</h2>
      <form id="player-form" class="input-row" autocomplete="off">
        <input type="text" name="playerName" placeholder="Enter player name" maxlength="18" required />
        <button type="submit">Add</button>
      </form>
      <div class="chips">${chips}</div>
      <div class="help-text">${state.players.length}/${MAX_PLAYERS} players added.</div>
      <button id="start-game" ${canStart ? "" : "disabled"}>Start</button>
    </section>
  `;
}

function renderPromptSelection() {
  const judgeName = getJudgeName();
  const promptButtons = state.promptOptions
    .map(
      (prompt) => {
        // Assign a target player to each prompt if it has <ANY> and doesn't have one yet
        if (prompt.name.includes("<ANY>") && !prompt.targetPlayer) {
          prompt.targetPlayer = pickPromptTarget();
        }
        const displayName = formatPrompt(prompt.name, prompt.targetPlayer);
        return `
      <button class="outline-button" data-prompt="${prompt.id}">
        ${displayName}
      </button>
    `;
      },
    )
    .join("");

  return `
    ${renderScoreboard()}
    <section class="panel">
      <div class="judge-pill">Judge: ${judgeName}</div>
      <h2>Pick a prompt</h2>
      <div class="grid">${promptButtons}</div>
    </section>
  `;
}

function renderSubmissionLobby() {
  const waitingButtons = state.pendingPlayers
    .map(
      (player) => `
        <button class="outline-button" data-player="${player}">
          ${player}
        </button>
      `,
    )
    .join("");

  return `
    ${renderScoreboard()}
    <section class="panel">
      <div class="prompt-card">${formatPrompt(state.currentPrompt.name, state.promptTarget)}</div>
      <p>Select whose turn it is to pick sounds.</p>
      <div class="grid">
        ${waitingButtons || "<p>Waiting for submissions…</p>"}
      </div>
    </section>
  `;
}

function renderSoundPicker() {
  const selectionNames = state.activeSelection.map((id) => state.audioById.get(id)?.name ?? id);
  const canSubmit = state.activeSelection.length === 2;

  const soundButtons = state.soundOptions
    .map((sound) => {
      const isSelected = state.activeSelection.includes(sound.id);
      const classes = ["outline-button", isSelected ? "selected" : ""].join(" ").trim();
      return `
        <button class="${classes}" data-sound="${sound.id}">
          ${sound.name}
        </button>
      `;
    })
    .join("");

  return `
    ${renderScoreboard()}
    <section class="panel">
      <div class="judge-pill">${state.activePlayer}'s turn</div>
      <div class="prompt-card">${formatPrompt(state.currentPrompt.name, state.promptTarget ?? state.activePlayer)}</div>
      <p>Choose two sounds in the order you want them to play.</p>
      <div class="grid">${soundButtons}</div>
      <div class="help-text">Selected: ${selectionNames.join(" → ") || "None"}</div>
      <div class="stack">
        <button id="reshuffle-sounds" class="outline-button">New sounds</button>
        <button id="clear-selection" class="outline-button">Clear picks</button>
        <button id="lock-picks" ${canSubmit ? "" : "disabled"}>Lock in</button>
      </div>
    </section>
  `;
}

function renderPlayback() {
  const revealed = state.currentlyRevealedSounds
    ? `<p>Now playing: <strong>${state.currentlyRevealedSounds.join(" → ")}</strong></p>`
    : "<p>The judge will hear each combo without knowing who picked it.</p>";

  return `
    ${renderScoreboard()}
    <section class="panel">
      <div class="prompt-card">${formatPrompt(state.currentPrompt.name, state.promptTarget, state.promptTarget ?? "???")}</div>
      <p>Hand the device to the judge. Audio will play each combo in random order.</p>
      ${revealed}
      <button id="play-submissions" ${state.isPlaying ? "disabled" : ""}>
        ${state.isPlaying ? "Playing…" : "Play submissions"}
      </button>
    </section>
  `;
}

function renderJudging() {
  const comboButtons = state.playbackQueue
    .map(
      (entry, index) => `
        <button class="outline-button" data-choice="${index}" ${state.isPlaying ? "disabled" : ""}>
          ${entry.sounds.map((sound) => sound.name).join(" + ")}
        </button>
      `,
    )
    .join("");

  const playingMessage = state.isPlaying ? "<p>Playing winning combo…</p>" : "";

  return `
    ${renderScoreboard()}
    <section class="panel">
      <div class="prompt-card">${formatPrompt(state.currentPrompt.name, state.promptTarget, state.promptTarget ?? "???")}</div>
      <h2>Judge, pick the winning combo</h2>
      ${playingMessage}
      <div class="stack">${comboButtons}</div>
    </section>
  `;
}

function renderWinner() {
  return `
    ${renderScoreboard()}
    <section class="panel">
      <h2>${state.winner} wins!</h2>
      <p>First to ${POINTS_TO_WIN} points.</p>
      <button id="play-again">Play another game</button>
    </section>
  `;
}

function renderScoreboard() {
  if (!state.players.length) {
    return "";
  }
  const pills = state.players
    .map((player) => `<span class="score-pill">${player}: ${state.scores[player] ?? 0}</span>`)
    .join("");
  return `<section class="scoreboard">${pills}</section>`;
}

function attachHandlersForStage() {
  switch (state.stage) {
    case "error": {
      document.getElementById("retry-load")?.addEventListener("click", () => {
        state.stage = "loading";
        render();
        init();
      });
      break;
    }
    case "lobby":
      wireLobbyHandlers();
      break;
    case "promptSelection":
      document.querySelectorAll("[data-prompt]").forEach((button) =>
        button.addEventListener("click", () => selectPrompt(Number(button.dataset.prompt))),
      );
      break;
    case "submissionLobby":
      document.querySelectorAll("[data-player]").forEach((button) =>
        button.addEventListener("click", () => beginPlayerTurn(button.dataset.player)),
      );
      break;
    case "soundPicker":
      document.querySelectorAll("[data-sound]").forEach((button) =>
        button.addEventListener("click", () => toggleSound(Number(button.dataset.sound))),
      );
      document.getElementById("reshuffle-sounds")?.addEventListener("click", reshuffleSounds);
      document.getElementById("clear-selection")?.addEventListener("click", clearSoundSelection);
      document.getElementById("lock-picks")?.addEventListener("click", submitSoundSelection);
      break;
    case "playback":
      document.getElementById("play-submissions")?.addEventListener("click", playSubmissionQueue);
      break;
    case "judging":
      document.querySelectorAll("[data-choice]").forEach((button) =>
        button.addEventListener("click", () => awardCombo(Number(button.dataset.choice))),
      );
      break;
    case "winner":
      document.getElementById("play-again")?.addEventListener("click", resetGame);
      break;
    default:
      break;
  }
}

function wireLobbyHandlers() {
  const form = document.getElementById("player-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = String(formData.get("playerName") || "").trim();
    if (!name) return;
    if (state.players.includes(name)) {
      alert("Player already added.");
      return;
    }
    if (state.players.length >= MAX_PLAYERS) {
      alert("Maximum players reached.");
      return;
    }
    state.players = [...state.players, name];
    state.scores[name] = state.scores[name] ?? 0;
    form.reset();
    render();
  });

  document.querySelectorAll("[data-remove]").forEach((button) =>
    button.addEventListener("click", () => {
      const name = button.dataset.remove;
      state.players = state.players.filter((player) => player !== name);
      delete state.scores[name];
      render();
    }),
  );

  document.getElementById("start-game")?.addEventListener("click", startGame);
}

function startGame() {
  if (state.players.length < MIN_PLAYERS) return;
  state.judgeIndex = Math.floor(Math.random() * state.players.length);
  state.players.forEach((name) => {
    state.scores[name] = state.scores[name] ?? 0;
  });
  startRound(false);
}

function startRound(advanceJudge = true) {
  if (state.players.length < MIN_PLAYERS) return;
  if (advanceJudge && state.judgeIndex !== null) {
    state.judgeIndex = (state.judgeIndex + 1) % state.players.length;
  }
  state.currentPrompt = null;
  state.promptTarget = null;
  state.promptOptions = drawPromptOptions();
  state.pendingPlayers = state.players.filter((_, index) => index !== state.judgeIndex);
  state.activePlayer = null;
  state.activeSelection = [];
  state.soundOptions = [];
  state.submissions = [];
  state.playbackQueue = [];
  state.isPlaying = false;
  state.currentlyRevealedSounds = null;
  state.stage = "promptSelection";
  render();
}

function rebuildPromptBag() {
  state.promptBag = [...state.promptLibrary];
  shuffle(state.promptBag);
}

function drawPromptOptions() {
  if (state.promptBag.length < PROMPTS_PER_ROUND) {
    rebuildPromptBag();
  }
  const options = state.promptBag.splice(0, PROMPTS_PER_ROUND);
  return options;
}

function selectPrompt(promptId) {
  const prompt = state.promptOptions.find((item) => item.id === promptId);
  if (!prompt) return;
  state.currentPrompt = prompt;
  // Use the target player that was assigned when displaying the prompt, or pick a new one
  state.promptTarget = prompt.targetPlayer || pickPromptTarget();
  
  // Read the prompt aloud
  const formattedPrompt = formatPrompt(prompt.name, state.promptTarget);
  speakText(formattedPrompt);
  
  state.stage = "submissionLobby";
  render();
}

function beginPlayerTurn(player) {
  state.activePlayer = player;
  state.activeSelection = [];
  state.soundOptions = drawRandomSounds();
  state.stage = "soundPicker";
  render();
}

function drawRandomSounds() {
  return pickRandomItems(state.audioLibrary, SOUNDS_PER_TURN);
}

function toggleSound(soundId) {
  const alreadySelected = state.activeSelection.includes(soundId);
  if (alreadySelected) {
    state.activeSelection = state.activeSelection.filter((id) => id !== soundId);
  } else if (state.activeSelection.length < 2) {
    state.activeSelection = [...state.activeSelection, soundId];
  }
  render();
}

function reshuffleSounds() {
  state.soundOptions = drawRandomSounds();
  state.activeSelection = [];
  render();
}

function clearSoundSelection() {
  state.activeSelection = [];
  render();
}

function submitSoundSelection() {
  if (state.activeSelection.length !== 2 || !state.activePlayer) return;
  const sounds = state.activeSelection
    .map((id) => state.audioById.get(id))
    .filter(Boolean);
  state.submissions.push({
    player: state.activePlayer,
    sounds,
  });
  state.pendingPlayers = state.pendingPlayers.filter((player) => player !== state.activePlayer);
  state.activePlayer = null;
  state.activeSelection = [];
  state.soundOptions = [];

  if (state.pendingPlayers.length === 0) {
    preparePlayback();
  } else {
    state.stage = "submissionLobby";
  }
  render();
}

function preparePlayback() {
  state.playbackQueue = shuffle([...state.submissions]);
  state.stage = "playback";
}

async function playSubmissionQueue() {
  if (state.isPlaying) return;
  state.isPlaying = true;
  render();
  
  // Read the prompt aloud before playing submissions
  if (state.currentPrompt) {
    const formattedPrompt = formatPrompt(state.currentPrompt.name, state.promptTarget);
    await speakText(formattedPrompt);
    // Small pause after speech before starting audio
    await wait(500);
  }
  
  for (let i = 0; i < state.playbackQueue.length; i++) {
    const entry = state.playbackQueue[i];
    state.currentlyRevealedSounds = entry.sounds.map((sound) => sound.name);
    render();
    
    try {
      // Play first sound
      if (entry.sounds[0]?.id) {
        await playSound(entry.sounds[0]?.id).catch((error) => {
          console.warn(`Failed to play first sound for player ${entry.player}:`, error);
        });
      }
      await wait(SOUND_GAP_MS);
      
      // Play second sound
      if (entry.sounds[1]?.id) {
        await playSound(entry.sounds[1]?.id).catch((error) => {
          console.warn(`Failed to play second sound for player ${entry.player}:`, error);
        });
      }
      
      // Wait before next player (unless it's the last one)
      // iOS needs longer delays between players
      if (i < state.playbackQueue.length - 1) {
        const delay = /iPad|iPhone|iPod/.test(navigator.userAgent) ? PLAYER_GAP_MS * 2 : PLAYER_GAP_MS;
        await wait(delay);
      }
    } catch (error) {
      console.error(`Error playing submission for ${entry.player}:`, error);
      // Continue to next player even if this one failed
      await wait(PLAYER_GAP_MS);
    }
  }
  state.isPlaying = false;
  state.currentlyRevealedSounds = null;
  state.stage = "judging";
  render();
}

// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

async function playSound(soundId) {
  if (!soundId) return wait(0);
  const source = getAudioSrc(soundId);
  const fullUrl = new URL(source, window.location.href).href;
  
  // iOS Safari works better with blob URLs, especially for cached content
  // Always use blob URLs on iOS for consistency
  let audioUrl = fullUrl;
  
  if ('caches' in window) {
    try {
      const cache = await caches.open('earwax-runtime-v2');
      const cachedResponse = await cache.match(fullUrl);
      
      if (cachedResponse) {
        // Convert cached response to blob URL for iOS compatibility
        const blob = await cachedResponse.blob();
        audioUrl = URL.createObjectURL(blob);
      } else if (isIOS && navigator.onLine) {
        // On iOS, even when online, fetch and convert to blob for consistency
        try {
          const response = await fetch(fullUrl);
          if (response.ok) {
            const blob = await response.blob();
            audioUrl = URL.createObjectURL(blob);
          }
        } catch (error) {
          console.warn("Failed to fetch for blob conversion:", error);
        }
      }
    } catch (error) {
      console.warn("Failed to get cached audio, using direct URL:", error);
    }
  }
  
  return new Promise((resolve) => {
    let resolved = false;
    let blobUrl = null;
    let timeoutId = null;
    let maxTimeoutId = null;
    
    const audio = new Audio();
    audio.preload = "auto";
    
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      
      // Clear all timeouts
      if (timeoutId) clearTimeout(timeoutId);
      if (maxTimeoutId) clearTimeout(maxTimeoutId);
      
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("canplaythrough", onCanPlay);
      audio.removeEventListener("loadeddata", onCanPlay);
      audio.removeEventListener("canplay", onCanPlay);
      // Clean up audio element
      audio.pause();
      audio.src = "";
      audio.load();
      // Clean up blob URL if we created one
      if (needsBlobCleanup && blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
      resolve();
    };
    
    const onEnded = () => {
      cleanup();
    };
    
    const onError = (e) => {
      console.error("Audio error:", e, "for", source, "URL:", audioUrl, "Online:", navigator.onLine);
      // Resolve after a short delay to allow error to be logged
      setTimeout(cleanup, 100);
    };
    
    let playAttempted = false;
    const attemptPlay = () => {
      if (resolved || playAttempted) return;
      playAttempted = true;
      
      // On iOS, ensure audio is fully loaded before playing
      if (isIOS && audio.readyState < 3) { // HAVE_FUTURE_DATA
        // Wait a bit more for iOS
        setTimeout(() => {
          if (resolved) return;
          doPlay();
        }, 100);
        return;
      }
      
      doPlay();
    };
    
    const doPlay = () => {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Playback started successfully, wait for it to end
            console.log("Audio playing:", source, "iOS:", isIOS);
          })
          .catch((error) => {
            console.warn("Audio play failed:", error, "for", source, "iOS:", isIOS);
            // On iOS, try once more after a delay
            if (isIOS && !resolved) {
              setTimeout(() => {
                if (!resolved) {
                  audio.play().catch(() => {
                    // Final attempt failed, resolve anyway
                    if (!resolved) {
                      console.warn("Final play attempt failed, resolving");
                      cleanup();
                    }
                  });
                }
              }, 200);
            } else {
              // If play fails, wait a bit then resolve anyway to not block
              setTimeout(() => {
                if (!resolved) {
                  console.warn("Resolving after play failure to prevent blocking");
                  cleanup();
                }
              }, 500);
            }
          });
      } else {
        // No promise returned, assume it's playing or will play
        setTimeout(() => {
          if (!resolved && audio.ended) {
            cleanup();
          }
        }, 100);
      }
    };
    
    const onCanPlay = () => {
      // Audio is ready, try to play
      if (resolved) return;
      attemptPlay();
    };
    
    // Add event listeners before setting source
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    // iOS needs canplaythrough for reliable playback
    if (isIOS) {
      audio.addEventListener("canplaythrough", onCanPlay, { once: true });
    } else {
      audio.addEventListener("canplaythrough", onCanPlay, { once: true });
      audio.addEventListener("loadeddata", onCanPlay, { once: true });
      audio.addEventListener("canplay", onCanPlay, { once: true });
    }
    
    // Set source and load
    blobUrl = audioUrl;
    audio.src = audioUrl;
    
    // On iOS, set volume explicitly and ensure proper loading
    if (isIOS) {
      audio.volume = 1.0;
    }
    
    audio.load();
    
    // On iOS, add a small delay after load to ensure it's ready
    // Note: Can't use await in Promise constructor, so we rely on event listeners
    
    // Fallback timeout in case events don't fire or audio is already ready
    // iOS needs more time to load
    const timeoutDelay = isIOS ? 3000 : 2000;
    timeoutId = setTimeout(() => {
      if (resolved) return;
      
      // On iOS, wait for HAVE_FUTURE_DATA (3) or HAVE_ENOUGH_DATA (4)
      const minReadyState = isIOS ? 3 : 2;
      if (audio.readyState >= minReadyState) {
        attemptPlay();
      } else {
        // Audio didn't load in time
        console.warn("Audio didn't load in time:", source, "readyState:", audio.readyState, "iOS:", isIOS, "Online:", navigator.onLine);
        // Try to play anyway - might work
        attemptPlay();
      }
    }, timeoutDelay);
    
    // Maximum timeout - force resolve after 10 seconds to prevent infinite hanging
    maxTimeoutId = setTimeout(() => {
      if (!resolved) {
        console.warn("Audio timeout - forcing resolve for:", source);
        cleanup();
      }
    }, 10000);
  });
}

async function awardCombo(index) {
  const entry = state.playbackQueue[index];
  if (!entry) return;
  
  // Play the winning sound combination
  state.isPlaying = true;
  render();
  await playSound(entry.sounds[0]?.id);
  await wait(SOUND_GAP_MS);
  await playSound(entry.sounds[1]?.id);
  await wait(PLAYER_GAP_MS);
  state.isPlaying = false;
  
  const player = entry.player;
  state.scores[player] = (state.scores[player] ?? 0) + 1;
  if (state.scores[player] >= POINTS_TO_WIN) {
    state.winner = player;
    state.stage = "winner";
  } else {
    startRound(true);
    return;
  }
  render();
}

function resetGame() {
  state.stage = "lobby";
  state.judgeIndex = null;
  state.currentPrompt = null;
  state.promptOptions = [];
  state.pendingPlayers = [];
  state.submissions = [];
  state.playbackQueue = [];
  state.isPlaying = false;
  state.winner = null;
  state.players.forEach((player) => {
    state.scores[player] = 0;
  });
  render();
}

function getJudgeName() {
  if (state.judgeIndex === null) return "Unknown";
  return state.players[state.judgeIndex];
}

function pickRandomItems(list, count) {
  if (list.length <= count) {
    return [...list];
  }
  const clone = [...list];
  shuffle(clone);
  return clone.slice(0, count);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function formatPrompt(promptName, replacementName, fallback = "___") {
  if (!promptName) return "";
  if (!promptName.includes("<ANY>")) return promptName;
  const replacement = replacementName ?? fallback;
  return promptName.replace(/<ANY>/g, replacement);
}

function getAudioSrc(id) {
  return `Audio/${id}.ogg`;
}

async function preloadAllAudio() {
  if (!state.audioLibrary || state.audioLibrary.length === 0) {
    return;
  }

  // Use cache API to preload all audio files
  try {
    const cache = await caches.open('earwax-runtime-v2');
    
    // Process in batches to avoid overwhelming the browser
    const BATCH_SIZE = 3; // Smaller batches for mobile
    
    for (let i = 0; i < state.audioLibrary.length; i += BATCH_SIZE) {
      const batch = state.audioLibrary.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      await Promise.all(
        batch.map(async (audio) => {
          const audioUrl = getAudioSrc(audio.id);
          const fullUrl = new URL(audioUrl, window.location.href).href;
          
          try {
            // Check if already cached
            const cached = await cache.match(fullUrl);
            if (!cached) {
              // Fetch and cache - service worker will also intercept this
              const response = await fetch(fullUrl, { 
                cache: 'no-cache' // Force network fetch, service worker will cache
              });
              if (response.ok) {
                // Clone response before caching
                const responseClone = response.clone();
                await cache.put(fullUrl, responseClone);
              } else {
                console.warn(`Failed to fetch audio ${audio.id}:`, response.status);
              }
            }
          } catch (error) {
            console.warn(`Failed to preload audio ${audio.id}:`, error);
          }
        })
      );
      
      // Update progress after each batch
      state.loadingProgress = Math.min(i + BATCH_SIZE, state.audioLibrary.length);
      render();
      
      // Small delay between batches to keep UI responsive and avoid blocking
      if (i + BATCH_SIZE < state.audioLibrary.length) {
        await wait(100); // Longer delay for mobile
      }
    }
    
    // Ensure we show 100%
    state.loadingProgress = state.audioLibrary.length;
    render();
    
    // Verify cache
    const cacheSize = await cache.keys();
    console.log(`Preloaded ${cacheSize.length} audio files into cache`);
    
    // Test a few cached files to ensure they're accessible
    if (cacheSize.length > 0) {
      const testFiles = cacheSize.slice(0, 3);
      for (const request of testFiles) {
        const cached = await cache.match(request);
        if (cached) {
          console.log(`✓ Verified cached: ${request.url}`);
        } else {
          console.warn(`✗ Failed to verify: ${request.url}`);
        }
      }
    }
  } catch (error) {
    console.error('Error preloading audio:', error);
    // Still mark as complete even if there were errors
    state.loadingProgress = state.audioLibrary.length;
    render();
  }
}

function pickPromptTarget() {
  const eligiblePlayers = state.players.filter((_, index) => index !== state.judgeIndex);
  if (!eligiblePlayers.length) {
    return state.pendingPlayers?.[0] ?? null;
  }
  const randomIndex = Math.floor(Math.random() * eligiblePlayers.length);
  return eligiblePlayers[randomIndex];
}

function wait(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    return Promise.resolve(); // Browser doesn't support speech synthesis
  }
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1;
    utterance.volume = 1;
    
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve(); // Resolve even on error to not block
    
    window.speechSynthesis.speak(utterance);
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers not supported");
    return;
  }
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./earwax-sw.js");
      console.log("Service worker registered:", registration.scope);
      
      // Check if service worker is active
      if (registration.active) {
        console.log("Service worker is active");
      } else if (registration.installing) {
        console.log("Service worker is installing");
        registration.installing.addEventListener("statechange", (e) => {
          console.log("Service worker state:", e.target.state);
        });
      } else if (registration.waiting) {
        console.log("Service worker is waiting");
      }
    } catch (error) {
      console.warn("Service worker registration failed", error);
    }
  });
}

