import { mkdir, writeFile } from 'node:fs/promises';

const username = process.env.GITHUB_ACTOR || 'OthmaneZ05';
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'OthmaneZ05-profile-readme',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

const api = async (path) => {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
};

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character]));

const document = (title, body, height) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="${height}" viewBox="0 0 420 ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">Generated from public GitHub data.</desc>
  <style>
    .title { font: 700 20px system-ui, sans-serif; fill: #70a5fd; }
    .label { font: 500 14px system-ui, sans-serif; fill: #a9b1d6; }
    .value { font: 700 15px system-ui, sans-serif; fill: #c0caf5; }
    .small { font: 500 12px system-ui, sans-serif; fill: #787c99; }
  </style>
  <rect width="420" height="${height}" rx="10" fill="#1a1b27" stroke="#292e42"/>
  ${body}
</svg>`;

const main = async () => {
  const [user, repositories] = await Promise.all([
    api(`/users/${username}`),
    api(`/users/${username}/repos?per_page=100&type=owner&sort=updated`),
  ]);

  const stars = repositories.reduce((total, repository) => total + repository.stargazers_count, 0);
  const languageResults = await Promise.all(repositories.map((repository) => api(`/repos/${username}/${repository.name}/languages`)));
  const languages = new Map();
  for (const result of languageResults) {
    for (const [language, bytes] of Object.entries(result)) {
      languages.set(language, (languages.get(language) || 0) + bytes);
    }
  }

  const stats = document(`${username}'s GitHub stats`, `
    <text x="28" y="42" class="title">GitHub Stats</text>
    <text x="28" y="78" class="label">Public repositories</text><text x="392" y="78" text-anchor="end" class="value">${user.public_repos}</text>
    <text x="28" y="108" class="label">Followers</text><text x="392" y="108" text-anchor="end" class="value">${user.followers}</text>
    <text x="28" y="138" class="label">Total stars</text><text x="392" y="138" text-anchor="end" class="value">${stars}</text>
    <text x="28" y="168" class="label">Following</text><text x="392" y="168" text-anchor="end" class="value">${user.following}</text>
    <text x="28" y="205" class="small">Updated daily from public GitHub data</text>`, 228);

  const palette = ['#7aa2f7', '#bb9af7', '#7dcfff', '#9ece6a', '#e0af68'];
  const entries = [...languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;
  const languageRows = entries.map(([language, bytes], index) => {
    const percentage = Math.round((bytes / total) * 100);
    const y = 82 + index * 31;
    return `<circle cx="32" cy="${y - 5}" r="5" fill="${palette[index]}"/>
      <text x="46" y="${y}" class="label">${escapeXml(language)}</text>
      <rect x="180" y="${y - 14}" width="190" height="9" rx="4.5" fill="#292e42"/>
      <rect x="180" y="${y - 14}" width="${Math.max(3, Math.round(190 * percentage / 100))}" height="9" rx="4.5" fill="${palette[index]}"/>
      <text x="392" y="${y}" text-anchor="end" class="value">${percentage}%</text>`;
  }).join('');
  const languageCard = document(`${username}'s top languages`, `
    <text x="28" y="42" class="title">Most Used Languages</text>
    ${languageRows}
    <text x="28" y="250" class="small">Based on bytes of public repositories</text>`, 273);

  await mkdir('assets', { recursive: true });
  await writeFile('assets/github-stats.svg', stats);
  await writeFile('assets/top-languages.svg', languageCard);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
