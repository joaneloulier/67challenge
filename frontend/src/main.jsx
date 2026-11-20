// React page: name + character form, the Canvas game, saving the score and
// the leaderboard. The game itself (frames, keys, rules) stays in canvas.js / game.js.
import {StrictMode, useCallback, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {fetchScores, saveScore} from './api.js';
import {CHARACTERS, loadPictures, mountGame, picturePath} from './canvas.js';
import {HEIGHT, WIDTH} from './game.js';
import './style.css';

// Mounts the Canvas game. A new `key` from the parent gives a brand-new game.
function Game({character, onState}) {
  const canvas = useRef(null);
  // Keep the latest callback in a ref: a new onState must not restart the game.
  const latestOnState = useRef(onState);
  latestOnState.current = onState;
  useEffect(() => {
    const game = mountGame(canvas.current, {
      onState: state => latestOnState.current(state),
      view: {character, pictures: loadPictures(character)},
    });
    return () => game.destroy(); // stop the loop and remove the key listener
  }, [character]);
  return (
    <canvas ref={canvas} width={WIDTH} height={HEIGHT} tabIndex={0}
      aria-label="Zone de jeu. Touches 6 et 7 en alternance." />
  );
}

function CharacterChoice({value, onChange}) {
  return (
    <fieldset className="characters">
      <legend>Personnage</legend>
      {Object.entries(CHARACTERS).map(([id, {label, color}]) => (
        <label key={id} className={value === id ? 'card selected' : 'card'} style={{'--accent': color}}>
          <input type="radio" name="character" value={id} checked={value === id} onChange={() => onChange(id)} />
          <img src={picturePath(id, '7')} alt="" onError={event => { event.currentTarget.hidden = true; }} />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Leaderboard({scores, error, highlight}) {
  return (
    <section className="leaderboard" aria-live="polite">
      <h2>Meilleurs scores</h2>
      {error && <p className="error">{error}</p>}
      {!error && scores.length === 0 && <p>Aucun score pour l’instant.</p>}
      {scores.length > 0 && (
        <ol>
          {scores.map(score => (
            <li key={score.id} className={score.id === highlight ? 'mine' : ''}>
              <span className="name">{score.player}</span>
              <span className="who">{CHARACTERS[score.character]?.label ?? score.character}</span>
              <span className="points">{score.points}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function App() {
  const [player, setPlayer] = useState('');
  const [character, setCharacter] = useState('gazmou');
  const [started, setStarted] = useState(false);
  const [gameKey, setGameKey] = useState(0);        // changes → new game
  const [result, setResult] = useState(null);       // final state when the game is over
  const [save, setSave] = useState({status: 'idle'}); // idle | saving | saved | error
  const [scores, setScores] = useState([]);
  const [scoresError, setScoresError] = useState('');
  const savedGame = useRef(-1); // which gameKey was already sent, to never send it twice

  const loadScores = useCallback(async () => {
    try {
      setScores(await fetchScores());
      setScoresError('');
    } catch (error) {
      setScoresError(error.message);
    }
  }, []);

  useEffect(() => { loadScores(); }, [loadScores]);

  const send = useCallback(async (points) => {
    setSave({status: 'saving'});
    try {
      const saved = await saveScore({player: player.trim(), character, points});
      setSave({status: 'saved', id: saved.id});
      await loadScores();
    } catch (error) {
      setSave({status: 'error', message: error.message});
    }
  }, [player, character, loadScores]);

  // Called by the game on each status change. At game over, save automatically.
  const onState = useCallback(state => {
    if (state.status !== 'over') { setResult(null); return; }
    setResult(state);
    if (savedGame.current !== gameKey) {
      savedGame.current = gameKey;
      send(state.score);
    }
  }, [gameKey, send]);

  function start(event) {
    event.preventDefault();
    if (!player.trim()) return;
    setStarted(true);
    replay();
  }

  function replay() {
    setResult(null);
    setSave({status: 'idle'});
    setGameKey(key => key + 1);
  }

  return (
    <main>
      <p className="eyebrow">ECM · WEB 101</p>
      <h1>67 Challenge</h1>
      <p>Tape 6 puis 7, encore et encore. Chaque « 67 » rapporte 1 point. 30 secondes, et deux 6 ou deux 7 de suite font perdre.</p>

      <div className="layout">
        <div className="play">
          {!started ? (
            <form className="setup" onSubmit={start}>
              <label className="name">
                Ton nom
                <input value={player} onChange={event => setPlayer(event.target.value)}
                  maxLength={20} required autoFocus placeholder="Samira" />
              </label>
              <CharacterChoice value={character} onChange={setCharacter} />
              <button type="submit" disabled={!player.trim()}>Jouer</button>
            </form>
          ) : (
            <>
              <p className="who-plays">{player.trim()} joue avec {CHARACTERS[character].label}</p>
              <Game key={gameKey} character={character} onState={onState} />
              <div className="controls">
                {result && <button onClick={replay}>Rejouer</button>}
                <button className="secondary" onClick={() => { setStarted(false); setResult(null); }}>
                  Changer de joueur
                </button>
              </div>
              <p id="status" role="status">
                {result && `Partie terminée : ${result.score} × 67. `}
                {save.status === 'saving' && 'Enregistrement du score…'}
                {save.status === 'saved' && 'Score enregistré !'}
              </p>
              {save.status === 'error' && (
                <p className="error">
                  {save.message}{' '}
                  <button onClick={() => send(result.score)}>Réessayer</button>
                </p>
              )}
            </>
          )}
        </div>
        <Leaderboard scores={scores} error={scoresError} highlight={save.id} />
      </div>
    </main>
  );
}

createRoot(document.querySelector('#root')).render(<StrictMode><App /></StrictMode>);
