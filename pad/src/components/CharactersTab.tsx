// "Who's who": a card for each character the family has met, with what they know so far.
import { initialOf } from '../lib/format';
import type { CharacterView } from '../shared/protocol';

export function CharactersTab({ characters }: { characters: CharacterView[] }) {
  if (characters.length === 0) {
    return <p className="empty">Characters appear here as you meet them in the film.</p>;
  }
  return (
    <ul className="cast" aria-label="Who's who">
      {characters.map((character) => (
        <li key={character.id} className="cast__card">
          {character.image ? (
            <img className="cast__image" src={character.image} alt="" />
          ) : (
            <span className="cast__image cast__image--empty" aria-hidden="true">
              {initialOf(character.name.replace(/^The /, ''))}
            </span>
          )}
          <div className="cast__text">
            <h2 className="title">{character.name}</h2>
            <ul className="cast__facts">
              {character.facts.map((fact, i) => (
                <li
                  key={fact}
                  className={i === character.facts.length - 1 ? 'is-latest' : undefined}
                >
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}
