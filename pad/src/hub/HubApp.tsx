// The Command Center (/hub): what Pip is, knows and does right now, on the household's own screen.
// Read-only, refreshed every few seconds from GET /api/hub, which answers only on this machine.
// Anything not built yet says "Planned"; simulated devices say "Simulated".
import { useEffect, useState } from 'react';
import { Pip } from '../components/Pip';
import type { HubFact, HubSnapshot } from '../shared/protocol';

const REFRESH_MS = 3000;

const PAGES = ['Overview', 'Library', 'Memory', 'Devices', 'Automations', 'Settings'] as const;
type Page = (typeof PAGES)[number];

type Load =
  | { state: 'loading' }
  | { state: 'local-only' }
  | { state: 'down' }
  | { state: 'ok'; hub: HubSnapshot };

export function HubApp() {
  const [page, setPage] = useState<Page>('Overview');
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch('/api/hub');
        if (cancelled) return;
        if (res.status === 403) setLoad({ state: 'local-only' });
        else if (!res.ok) setLoad({ state: 'down' });
        else setLoad({ state: 'ok', hub: (await res.json()) as HubSnapshot });
      } catch {
        if (!cancelled) setLoad({ state: 'down' });
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="hub">
      <aside className="hub-nav">
        <div className="hub-brand">
          <Pip state="idle" size={40} />
          <div>
            <strong>Pip</strong>
            <span className="muted">Command Center</span>
          </div>
        </div>
        <nav>
          {PAGES.map((p) => (
            <button
              key={p}
              type="button"
              className={p === page ? 'hub-link is-on' : 'hub-link'}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
        </nav>
        <p className="muted hub-foot">Read-only. Everything here stays on this machine.</p>
      </aside>
      <main className="hub-main">
        <h1>{page}</h1>
        {load.state === 'loading' && <p className="muted">Connecting to Pip…</p>}
        {load.state === 'down' && (
          <p className="notice">
            The Pip server is not answering. Start it with npm start in server/.
          </p>
        )}
        {load.state === 'local-only' && (
          <p className="notice">
            The Command Center opens only on the Mac running Pip, so the household&apos;s data never
            goes through the tunnel. Open http://localhost:8787/hub there.
          </p>
        )}
        {load.state === 'ok' && <PageView page={page} hub={load.hub} />}
      </main>
    </div>
  );
}

function PageView({ page, hub }: { page: Page; hub: HubSnapshot }) {
  switch (page) {
    case 'Overview':
      return <Overview hub={hub} />;
    case 'Library':
      return <Library hub={hub} />;
    case 'Memory':
      return <Memory hub={hub} />;
    case 'Devices':
      return <Devices hub={hub} />;
    case 'Automations':
      return <Automations hub={hub} />;
    case 'Settings':
      return <Settings hub={hub} />;
  }
}

function clock(sec: number | null): string {
  if (sec === null) return '–';
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Status({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <span className={`status status--${ok === null ? 'idle' : ok ? 'ok' : 'bad'}`}>
      <span className="status__dot" />
      {label}
    </span>
  );
}

function Overview({ hub }: { hub: HubSnapshot }) {
  const live = hub.sessions.find((s) => s.tvOnline) ?? hub.sessions[0] ?? null;
  const probes = hub.library.reduce((n, f) => n + (f.benchmark?.probes ?? 0), 0);
  const leaks = hub.library.reduce((n, f) => n + (f.benchmark?.leaks ?? 0), 0);
  return (
    <div className="grid">
      <section className="card">
        <h2>Brain</h2>
        <p className="big">{hub.brain.model}</p>
        <Status
          ok={hub.brain.reachable}
          label={
            hub.brain.provider === 'ollama'
              ? hub.brain.reachable
                ? `On this machine · ${hub.brain.latencyMs ?? '?'} ms`
                : 'Ollama is not answering'
              : 'Amazon Bedrock (not verified)'
          }
        />
        <p className="muted">
          Answers come from{' '}
          {hub.brain.timelineReview === 'accepted' ? 'reviewed' : 'draft and reviewed'} facts only.
          Controls never wait for the model.
        </p>
      </section>
      <section className="card">
        <h2>Now</h2>
        {live ? (
          <>
            <p className="big">{live.film ?? 'On the home screen'}</p>
            <Status
              ok={live.tvOnline}
              label={`${live.tvOnline ? 'TV online' : 'TV offline'} · code ${live.code}${
                live.film ? ` · ${clock(live.positionSec)}${live.paused ? ' paused' : ''}` : ''
              }`}
            />
            <p className="muted">
              {live.players.filter((p) => p.online).length} of {live.players.length} pads online
            </p>
          </>
        ) : (
          <p className="muted">No TV has connected yet. Open /tv or the Vega app.</p>
        )}
      </section>
      <section className="card">
        <h2>Spoiler safety</h2>
        <p className="big">
          {leaks} leaks in {probes}
        </p>
        <p className="muted">Spoiler probes across the library, from the latest benchmark run.</p>
      </section>
      <section className="card">
        <h2>Today</h2>
        <p className="big">{hub.memory.eventsToday} events</p>
        <p className="muted">
          {hub.memory.journalOn
            ? Object.entries(hub.memory.byType)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([type, n]) => `${type} ${n}`)
                .join(' · ') || 'Nothing yet'
            : 'The journal is off (JOURNAL=false).'}
        </p>
      </section>
      <section className="card card--wide">
        <h2>What Pip can do</h2>
        <ul className="capabilities">
          <li>
            <strong>Ask without spoilers.</strong> Who is that, what just happened, why: from what
            the film has shown, never further.
          </li>
          <li>
            <strong>While you were away.</strong> A private recap for whoever stepped out; the film
            keeps playing.
          </li>
          <li>
            <strong>Parallel Stories.</strong> “What if…?” splits the film where you asked; Pip
            writes its own version, labelled, and never sees the film past the split.
          </li>
          <li>
            <strong>Control without the remote.</strong> Pip Pad, voice, the TV remote, and webcam
            gestures (experiment), all through one router the TV confirms.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Library({ hub }: { hub: HubSnapshot }) {
  const [open, setOpen] = useState<string | null>(null);
  const [facts, setFacts] = useState<HubFact[] | null>(null);
  const reveal = async (id: string) => {
    if (open === id) return setOpen(null);
    setOpen(id);
    setFacts(null);
    const res = await fetch(`/api/hub/films/${id}/facts`);
    setFacts(res.ok ? ((await res.json()) as HubFact[]) : []);
  };
  return (
    <div className="stack">
      {hub.library.map((film) => (
        <section key={film.id} className="card film">
          {film.poster && <img className="film__poster" src={film.poster} alt="" />}
          <div className="film__body">
            <h2>{film.title}</h2>
            <p className="muted">
              {Math.round(film.durationSec / 60)} min · {film.tags.join(' · ')}
            </p>
            <p className="muted small">{film.credit}</p>
            <div className="stats">
              <span>
                <strong>{film.facts}</strong> reviewed facts
              </span>
              <span>
                <strong>{film.characters}</strong> characters
              </span>
              <span>
                <strong>{film.scenes}</strong> scenes
              </span>
              {film.benchmark && (
                <span>
                  <strong>
                    {film.benchmark.leaks}/{film.benchmark.probes}
                  </strong>{' '}
                  leaks ·{' '}
                  <strong>
                    {Math.round(
                      (film.benchmark.answered / Math.max(1, film.benchmark.answerable)) * 100,
                    )}
                    %
                  </strong>{' '}
                  answered
                </span>
              )}
            </div>
            <button type="button" className="hub-button" onClick={() => void reveal(film.id)}>
              {open === film.id ? 'Hide' : 'Show what Pip knows (spoilers)'}
            </button>
            {open === film.id && (
              <ol className="facts">
                {(facts ?? []).map((f) => (
                  <li key={`${f.atSec}-${f.text}`}>
                    <span className="facts__time">{clock(f.atSec)}</span>
                    <span>{f.text}</span>
                    <span className="muted small">
                      known from {clock(f.revealSec)} · {f.review}
                    </span>
                  </li>
                ))}
                {facts === null && <li className="muted">Loading…</li>}
              </ol>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function Memory({ hub }: { hub: HubSnapshot }) {
  return (
    <div className="stack">
      <section className="card">
        <h2>What Pip keeps</h2>
        <ul className="capabilities">
          <li>Events with a pseudonymous id: what happened, from which input, in which film.</li>
          <li>Never names, question text, voice recordings or camera images.</li>
          <li>Sessions live in memory and end when everyone has gone for 6 hours.</li>
        </ul>
        <Status
          ok={hub.memory.journalOn}
          label={hub.memory.journalOn ? 'Journal on' : 'Journal off'}
        />
      </section>
      <section className="card">
        <h2>Today: {hub.memory.eventsToday} events</h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>From</th>
              <th>Film</th>
            </tr>
          </thead>
          <tbody>
            {hub.memory.recent.map((e, i) => (
              <tr key={`${e.at}-${i}`}>
                <td>{new Date(e.at).toLocaleTimeString()}</td>
                <td>{e.type}</td>
                <td>{e.source}</td>
                <td>{e.film ?? '–'}</td>
              </tr>
            ))}
            {hub.memory.recent.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Nothing recorded today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Devices({ hub }: { hub: HubSnapshot }) {
  const sources = [...new Set(hub.memory.recent.map((e) => e.source))];
  if (hub.sessions.length === 0) return <p className="muted">No TV has connected yet.</p>;
  return (
    <div className="stack">
      {hub.sessions.map((s) => (
        <section key={s.code} className="card">
          <h2>TV {s.code}</h2>
          <div className="devices">
            <div>
              <h3>Screen</h3>
              <Status ok={s.tvOnline} label={s.tvOnline ? 'Online' : 'Offline'} />
              <p className="muted">
                {s.film ? `${s.film} · ${clock(s.positionSec)}` : 'Home screen'}
              </p>
            </div>
            <div>
              <h3>Pip Pads</h3>
              {s.players.map((p) => (
                <Status
                  key={p.name}
                  ok={p.online}
                  label={`${p.name}${p.isHost ? ' (host)' : ''}`}
                />
              ))}
              {s.players.length === 0 && <p className="muted">Nobody has joined.</p>}
            </div>
            <div>
              <h3>Picture and sound</h3>
              <Meter label="Volume" value={s.device.volume} />
              <Meter label="Brightness" value={s.device.brightness} />
            </div>
            <div>
              <h3>Lights</h3>
              <p className="big">{s.device.ambient}</p>
              <p className="muted small">Simulated: no smart lights are connected.</p>
            </div>
          </div>
        </section>
      ))}
      <section className="card">
        <h2>Inputs seen today</h2>
        <p className="muted">{sources.length ? sources.join(' · ') : 'None yet.'}</p>
      </section>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="meter">
      <span className="muted small">{label}</span>
      <div className="meter__track">
        <div className="meter__fill" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

function Automations({ hub }: { hub: HubSnapshot }) {
  const kids = hub.sessions.some((s) => s.kidsMode);
  const rules: {
    name: string;
    when: string;
    status: 'Active' | 'Opt-in' | 'Planned';
    note: string;
  }[] = [
    {
      name: 'Quiet during the film',
      when: 'A film is playing',
      status: 'Active',
      note: 'Pip stays hidden on the TV until someone asks.',
    },
    {
      name: 'Pip on pause',
      when: 'The film is paused',
      status: 'Active',
      note: 'A small Pip with a hint appears on the TV.',
    },
    {
      name: 'While you were away',
      when: 'A pad comes back, or someone joins late',
      status: 'Active',
      note: 'A private recap up to now, no model call.',
    },
    {
      name: 'Kids games',
      when: 'The host turns them on',
      status: 'Opt-in',
      note: kids ? 'On in a session now.' : 'Off in every session.',
    },
    {
      name: 'Pause when everyone leaves',
      when: 'The camera sees an empty room',
      status: 'Planned',
      note: 'Counting people, never recognising them. Not built.',
    },
    {
      name: 'Movie lights',
      when: 'A film starts',
      status: 'Planned',
      note: 'The lights are simulated today.',
    },
  ];
  return (
    <div className="stack">
      {rules.map((r) => (
        <section key={r.name} className="card rule">
          <div>
            <h2>{r.name}</h2>
            <p className="muted">
              When: {r.when}. {r.note}
            </p>
          </div>
          <span className={`pill pill--${r.status.toLowerCase().replace('-', '')}`}>
            {r.status}
          </span>
        </section>
      ))}
    </div>
  );
}

function Settings({ hub }: { hub: HubSnapshot }) {
  return (
    <section className="card">
      <table>
        <tbody>
          {Object.entries(hub.settings).map(([key, value]) => (
            <tr key={key}>
              <td className="mono">{key}</td>
              <td className="mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        Change these in server/.env and restart the server. No keys are shown here.
      </p>
    </section>
  );
}
