// "Catch me up": the story so far, one chapter at a time, only what the family has watched.
import type { ChapterView } from '../shared/protocol';

export function StoryTab({ chapters }: { chapters: ChapterView[] }) {
  if (chapters.length === 0) {
    return (
      <p className="empty">
        The story starts soon. Each part appears here once you have watched it.
      </p>
    );
  }
  return (
    <ol className="story" aria-label="The story so far">
      {chapters.map((chapter, i) => (
        <li key={chapter.atSec} className="chapter">
          {chapter.image && <img className="chapter__image" src={chapter.image} alt="" />}
          <div className="chapter__text">
            <p className="label">
              Part {i + 1}
              {i === chapters.length - 1 ? ' · just now' : ''}
            </p>
            <h2 className="title">{chapter.title}</h2>
            <p className="body">{chapter.summary}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
