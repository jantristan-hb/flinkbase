const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";

export interface HNStory {
  id: number;
  title: string;
  url: string | null;
  score: number;
  descendants: number;
  hnUrl: string;
}

export async function fetchTopStoryIds(limit: number = 60): Promise<number[]> {
  const res = await fetch(`${HN_API_BASE}/topstories.json`);
  if (!res.ok) throw new Error(`HN API error: ${res.status}`);
  const ids: number[] = await res.json();
  return ids.slice(0, limit);
}

export async function fetchStoryDetails(id: number): Promise<HNStory> {
  const res = await fetch(`${HN_API_BASE}/item/${id}.json`);
  if (!res.ok) throw new Error(`HN API error for item ${id}: ${res.status}`);
  const data = await res.json();
  return {
    id: data.id,
    title: data.title,
    url: data.url ?? null,
    score: data.score ?? 0,
    descendants: data.descendants ?? 0,
    hnUrl: `https://news.ycombinator.com/item?id=${data.id}`,
  };
}

export async function fetchTopStories(limit: number = 60): Promise<HNStory[]> {
  const ids = await fetchTopStoryIds(limit);
  const stories = await Promise.all(ids.map(fetchStoryDetails));
  return stories;
}
