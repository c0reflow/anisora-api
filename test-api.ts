import { buildApp } from './src/app';
import prisma from './src/db/prisma';

async function runTests() {
  console.log('--- Starting API Integration Tests ---');
  const app = await buildApp();
  await app.ready();

  // Test 1: Health Check
  console.log('\n[Test 1] Testing GET /health');
  const healthRes = await app.inject({ method: 'GET', url: '/health' });
  console.log('Status:', healthRes.statusCode);
  const healthBody = JSON.parse(healthRes.body);
  console.log('Health Body:', healthBody);
  if (healthRes.statusCode !== 200 || healthBody.database.status !== 'connected') {
    throw new Error('Health check failed');
  }

  // Test 2: Anime List with Pagination & Filter
  console.log('\n[Test 2] Testing GET /api/v1/anime?limit=3');
  const listRes = await app.inject({ method: 'GET', url: '/api/v1/anime?limit=3' });
  console.log('Status:', listRes.statusCode);
  const listBody = JSON.parse(listRes.body);
  console.log('Total anime:', listBody.pagination.total);
  console.log('Returned items count:', listBody.data.length);
  console.log('Sample anime title:', listBody.data[0]?.title);
  if (listRes.statusCode !== 200 || listBody.data.length !== 3) {
    throw new Error('List test failed');
  }

  // Test 3: Search anime by title
  console.log('\n[Test 3] Testing GET /api/v1/anime?q=Evangelion&limit=2');
  const searchRes = await app.inject({ method: 'GET', url: '/api/v1/anime?q=Evangelion&limit=2' });
  console.log('Status:', searchRes.statusCode);
  const searchBody = JSON.parse(searchRes.body);
  console.log('Found Evangelion matches:', searchBody.pagination.total);
  console.log('Match 1:', searchBody.data[0]?.title);
  if (searchRes.statusCode !== 200) {
    throw new Error('Search test failed');
  }

  // Test 4: Anime by AniSora ID
  const testId = listBody.data[0].anisora_id;
  console.log(`\n[Test 4] Testing GET /api/v1/anime/${testId}`);
  const detailRes = await app.inject({ method: 'GET', url: `/api/v1/anime/${testId}` });
  console.log('Status:', detailRes.statusCode);
  const detailBody = JSON.parse(detailRes.body);
  console.log('Detail Title:', detailBody.title);
  console.log('Synonyms count:', detailBody.synonyms.length);
  console.log('Studios:', detailBody.studios);
  console.log('Tags:', detailBody.tags);
  if (detailRes.statusCode !== 200 || detailBody.anisora_id !== testId) {
    throw new Error('Detail test failed');
  }

  // Test 5: External Provider Lookup (MAL)
  console.log('\n[Test 5] Testing GET /api/v1/anime/by-provider/mal/51478');
  const providerRes = await app.inject({ method: 'GET', url: '/api/v1/anime/by-provider/mal/51478' });
  console.log('Status:', providerRes.statusCode);
  const providerBody = JSON.parse(providerRes.body);
  console.log('Resolved Anime from MAL 51478:', providerBody.title);
  if (providerRes.statusCode !== 200) {
    throw new Error('Provider lookup failed');
  }

  // Test 6: Random Anime
  console.log('\n[Test 6] Testing GET /api/v1/anime/random');
  const randomRes = await app.inject({ method: 'GET', url: '/api/v1/anime/random' });
  console.log('Status:', randomRes.statusCode);
  const randomBody = JSON.parse(randomRes.body);
  console.log('Random anime chosen:', randomBody.title, `(${randomBody.type})`);
  if (randomRes.statusCode !== 200) {
    throw new Error('Random anime failed');
  }

  // Test 7: Metadata Tags
  console.log('\n[Test 7] Testing GET /api/v1/meta/tags?limit=5');
  const tagsRes = await app.inject({ method: 'GET', url: '/api/v1/meta/tags?limit=5' });
  console.log('Status:', tagsRes.statusCode);
  const tagsBody = JSON.parse(tagsRes.body);
  console.log('Top 5 tags:', tagsBody.data);
  if (tagsRes.statusCode !== 200 || tagsBody.data.length !== 5) {
    throw new Error('Meta tags failed');
  }

  // Test 8: Metadata Stats
  console.log('\n[Test 8] Testing GET /api/v1/meta/stats');
  const statsRes = await app.inject({ method: 'GET', url: '/api/v1/meta/stats' });
  console.log('Status:', statsRes.statusCode);
  const statsBody = JSON.parse(statsRes.body);
  console.log('Stats breakdown:', {
    total_anime: statsBody.total_anime,
    total_studios: statsBody.total_studios,
    total_producers: statsBody.total_producers,
    total_tags: statsBody.total_tags,
  });
  if (statsRes.statusCode !== 200) {
    throw new Error('Meta stats failed');
  }

  // Test 9: OpenAPI Swagger Docs
  console.log('\n[Test 9] Testing GET /docs/json (OpenAPI Schema)');
  const docsRes = await app.inject({ method: 'GET', url: '/docs/json' });
  console.log('Status:', docsRes.statusCode);
  const docsBody = JSON.parse(docsRes.body);
  console.log('OpenAPI Title:', docsBody.info.title);
  console.log('OpenAPI Version:', docsBody.openapi);
  console.log('Documented Paths count:', Object.keys(docsBody.paths).length);
  if (docsRes.statusCode !== 200 || !docsBody.openapi.startsWith('3.')) {
    throw new Error('OpenAPI docs failed');
  }

  // Test 10: Increment Anime Views & Likes
  console.log(`\n[Test 10] Testing POST /api/v1/anime/${testId}/view and /like`);
  const viewRes = await app.inject({ method: 'POST', url: `/api/v1/anime/${testId}/view` });
  console.log('View Status:', viewRes.statusCode, JSON.parse(viewRes.body));
  const likeRes = await app.inject({ method: 'POST', url: `/api/v1/anime/${testId}/like` });
  console.log('Like Status:', likeRes.statusCode, JSON.parse(likeRes.body));
  if (viewRes.statusCode !== 200 || likeRes.statusCode !== 200) {
    throw new Error('View or Like increment failed');
  }

  // Test 11: Create User
  console.log('\n[Test 11] Testing POST /api/v1/users (User Registration)');
  const randomEmail = `otaku_${Date.now()}@example.com`;
  const userRes = await app.inject({
    method: 'POST',
    url: '/api/v1/users',
    payload: {
      email: randomEmail,
      password: 'SuperSecretPassword123!',
      username: `otaku_${Date.now().toString().slice(-4)}`,
    },
  });
  console.log('User Status:', userRes.statusCode);
  const userBody = JSON.parse(userRes.body);
  console.log('Created User ID:', userBody.id, 'Email:', userBody.email);
  if (userRes.statusCode !== 201 || !userBody.id) {
    throw new Error('User creation failed');
  }

  // Test 12: Episode Comments with episode_id = animeid&ep=(int)
  const testEpisodeId = `${testId}&ep=1`;
  console.log(`\n[Test 12] Testing Comments for episode: ${testEpisodeId}`);
  
  // 12a: Post parent comment
  const commentRes1 = await app.inject({
    method: 'POST',
    url: '/api/v1/comments',
    payload: {
      episode_id: testEpisodeId,
      user_id: userBody.id,
      comment: 'Episode 1 animation was incredible!',
      type: 'parent',
    },
  });
  console.log('Parent Comment Status:', commentRes1.statusCode);
  const comment1 = JSON.parse(commentRes1.body);
  console.log('Created Parent Comment ID:', comment1.id);
  if (commentRes1.statusCode !== 201) throw new Error('Parent comment failed');

  // 12b: Post reply to parent comment
  const commentRes2 = await app.inject({
    method: 'POST',
    url: '/api/v1/comments',
    payload: {
      episode_id: testEpisodeId,
      user_id: userBody.id,
      comment: 'Agreed, the soundtrack was fire too!',
      type: 'reply',
      parent_comment_id: comment1.id,
    },
  });
  console.log('Reply Comment Status:', commentRes2.statusCode);
  const comment2 = JSON.parse(commentRes2.body);
  console.log('Created Reply Comment ID:', comment2.id);
  if (commentRes2.statusCode !== 201) throw new Error('Reply comment failed');

  // 12c: Fetch comments for this episode
  const fetchCommentsRes = await app.inject({
    method: 'GET',
    url: `/api/v1/comments/${encodeURIComponent(testEpisodeId)}`,
  });
  console.log('Fetch Comments Status:', fetchCommentsRes.statusCode);
  const commentsList = JSON.parse(fetchCommentsRes.body);
  console.log('Found comments for episode:', commentsList.pagination.total);
  if (fetchCommentsRes.statusCode !== 200 || commentsList.pagination.total < 2) {
    throw new Error('Fetch comments failed');
  }

  // 12d: Delete created comments (cleanup)
  await app.inject({ method: 'DELETE', url: `/api/v1/comments/${comment2.id}` });
  await app.inject({ method: 'DELETE', url: `/api/v1/comments/${comment1.id}` });
  console.log('Cleaned up test comments successfully.');

  // Test 13: Dedicated Search by Name with exact requested fields
  console.log('\n[Test 13] Testing GET /search?query=naruto&page=1');
  const searchNameRes = await app.inject({
    method: 'GET',
    url: '/search?query=naruto&page=1&limit=3',
  });
  console.log('Search Status:', searchNameRes.statusCode);
  const searchNameBody = JSON.parse(searchNameRes.body);
  console.log('Found matches:', searchNameBody.pagination.total);
  const sample = searchNameBody.data[0];
  console.log('Sample Search Item Structure:', {
    id: sample?.id,
    title: sample?.title,
    total_episodes: sample?.total_episodes,
    poster: sample?.poster ? `${sample.poster.slice(0, 35)}...` : null,
    description: sample?.description,
    type: sample?.type,
    duration: sample?.duration,
    score: sample?.score,
    tag: sample?.tag,
  });
  if (
    searchNameRes.statusCode !== 200 ||
    !sample ||
    !('total_episodes' in sample) ||
    !('type' in sample) ||
    !('duration' in sample) ||
    !('score' in sample) ||
    !('tag' in sample) ||
    (sample.type !== 'movie' && sample.type !== 'series')
  ) {
    throw new Error('Search by name failed or missing requested fields');
  }

  // Test 14: Top 5 Quick Search Suggestions
  console.log('\n[Test 14] Testing GET /searchsuggestion?query=naruto');
  const suggestRes = await app.inject({
    method: 'GET',
    url: '/searchsuggestion?query=naruto',
  });
  console.log('Suggestion Status:', suggestRes.statusCode);
  const suggestBody = JSON.parse(suggestRes.body);
  console.log(`Returned ${suggestBody.suggestions.length} suggestions (max 5):`);
  suggestBody.suggestions.forEach((s: any, idx: number) => {
    console.log(`  ${idx + 1}. [${s.type.toUpperCase()}] ${s.title} (${s.year ?? 'N/A'}) - Score: ${s.score}`);
  });
  if (suggestRes.statusCode !== 200 || suggestBody.suggestions.length > 5) {
    throw new Error('Search suggestions failed');
  }

  // Test 15: /trending and /tranding (AniList resolved in our DB)
  console.log('\n[Test 15] Testing GET /trending and GET /tranding');
  const trendingRes = await app.inject({ method: 'GET', url: '/trending?limit=3' });
  console.log('Trending Status:', trendingRes.statusCode);
  const trendingBody = JSON.parse(trendingRes.body);
  console.log('Trending count:', trendingBody.data.length, 'Source:', trendingBody.source);
  console.log('Trending #1:', trendingBody.data[0]?.title);
  const trandingAliasRes = await app.inject({ method: 'GET', url: '/tranding?limit=1' });
  console.log('Tranding alias Status:', trandingAliasRes.statusCode);
  if (trendingRes.statusCode !== 200 || trandingAliasRes.statusCode !== 200) {
    throw new Error('Trending endpoints failed');
  }

  // Test 16: Top Airing
  console.log('\n[Test 16] Testing GET /top-airing?limit=3');
  const airingRes = await app.inject({ method: 'GET', url: '/top-airing?limit=3' });
  console.log('Top Airing Status:', airingRes.statusCode);
  const airingBody = JSON.parse(airingRes.body);
  console.log('Top Airing #1:', airingBody.data[0]?.title, 'Status:', airingBody.data[0]?.status);
  if (airingRes.statusCode !== 200 || airingBody.data.length === 0) {
    throw new Error('Top airing failed');
  }

  // Test 17: Most Popular & Most Favorite
  console.log('\n[Test 17] Testing GET /most-popular & /most-favorite');
  const popRes = await app.inject({ method: 'GET', url: '/most-popular?limit=2' });
  const favRes = await app.inject({ method: 'GET', url: '/most-favorite?limit=2' });
  console.log('Most Popular Status:', popRes.statusCode, 'Top:', JSON.parse(popRes.body).data[0]?.title);
  console.log('Most Favorite Status:', favRes.statusCode, 'Top:', JSON.parse(favRes.body).data[0]?.title);
  if (popRes.statusCode !== 200 || favRes.statusCode !== 200) {
    throw new Error('Most Popular / Favorite failed');
  }

  // Test 18: Latest Completed & Top Upcoming
  console.log('\n[Test 18] Testing GET /latest-completed & /top-upcoming');
  const completedRes = await app.inject({ method: 'GET', url: '/latest-completed?limit=2' });
  const upcomingRes = await app.inject({ method: 'GET', url: '/top-upcoming?limit=2' });
  console.log('Latest Completed Status:', completedRes.statusCode, 'Sample:', JSON.parse(completedRes.body).data[0]?.title);
  console.log('Top Upcoming Status:', upcomingRes.statusCode, 'Sample:', JSON.parse(upcomingRes.body).data[0]?.title);
  if (completedRes.statusCode !== 200 || upcomingRes.statusCode !== 200) {
    throw new Error('Latest Completed / Upcoming failed');
  }

  // Test 19: Top 10 Leaderboard (week, month, year)
  console.log('\n[Test 19] Testing GET /top-ten?period=week and GET /top-10?period=month');
  const topTenRes = await app.inject({ method: 'GET', url: '/top-ten?period=week' });
  console.log('Top 10 Status:', topTenRes.statusCode);
  const topTenBody = JSON.parse(topTenRes.body);
  console.log(`Top 10 (${topTenBody.period}) rank 1:`, topTenBody.data[0]?.title, `(Rank: ${topTenBody.data[0]?.rank})`);
  const top10Res = await app.inject({ method: 'GET', url: '/top-10?period=month' });
  if (topTenRes.statusCode !== 200 || top10Res.statusCode !== 200 || topTenBody.data.length === 0) {
    throw new Error('Top 10 failed');
  }

  // Test 20: Latest Episodes (with AnisoraId&ep=int)
  console.log('\n[Test 20] Testing GET /latest-episodes');
  const latestEpRes = await app.inject({ method: 'GET', url: '/latest-episodes?limit=3' });
  console.log('Latest Episodes Status:', latestEpRes.statusCode);
  const latestEpBody = JSON.parse(latestEpRes.body);
  const firstEpisode = latestEpBody.data[0];
  console.log('Latest Ep #1:', {
    title: firstEpisode?.title,
    episode_number: firstEpisode?.episode_number,
    episode_id: firstEpisode?.episode_id,
  });
  if (
    latestEpRes.statusCode !== 200 ||
    !firstEpisode ||
    !firstEpisode.episode_id.includes('&ep=')
  ) {
    throw new Error('Latest episodes failed or episode_id format is invalid');
  }

  // Test 21: Estimated Schedule
  console.log('\n[Test 21] Testing GET /schedule');
  const scheduleRes = await app.inject({ method: 'GET', url: '/schedule' });
  console.log('Schedule Status:', scheduleRes.statusCode);
  const scheduleBody = JSON.parse(scheduleRes.body);
  console.log('Schedule date:', scheduleBody.date, 'Total scheduled airing:', scheduleBody.data.length);
  if (scheduleRes.statusCode !== 200) {
    throw new Error('Schedule failed');
  }

  // Test 22: A-Z List & Genres
  console.log('\n[Test 22] Testing GET /az-list?letter=A and GET /genres');
  const azRes = await app.inject({ method: 'GET', url: '/az-list?letter=A&limit=2' });
  const genresRes = await app.inject({ method: 'GET', url: '/genres?limit=3' });
  const genreFilterRes = await app.inject({ method: 'GET', url: '/genre/action?limit=2' });
  console.log('A-Z List Status:', azRes.statusCode, 'A-Z Item:', JSON.parse(azRes.body).data[0]?.title);
  console.log('Genres List Status:', genresRes.statusCode, 'Top Genre:', JSON.parse(genresRes.body).data[0]?.name);
  console.log('Genre Filter Status:', genreFilterRes.statusCode, 'Action Anime:', JSON.parse(genreFilterRes.body).data[0]?.title);
  if (azRes.statusCode !== 200 || genresRes.statusCode !== 200 || genreFilterRes.statusCode !== 200) {
    throw new Error('A-Z or Genre routes failed');
  }

  // Test 23: Direct Formats (without AniList: /movie, /ova, /ona, /special)
  console.log('\n[Test 23] Testing GET /movie, /ova, /ona, /special');
  const movieRes = await app.inject({ method: 'GET', url: '/movie?limit=2' });
  const ovaRes = await app.inject({ method: 'GET', url: '/ova?limit=2' });
  const onaRes = await app.inject({ method: 'GET', url: '/ona?limit=2' });
  const specialRes = await app.inject({ method: 'GET', url: '/special?limit=2' });
  console.log('Movie Status:', movieRes.statusCode, 'Type:', JSON.parse(movieRes.body).data[0]?.type);
  console.log('OVA Status:', ovaRes.statusCode, 'Type:', JSON.parse(ovaRes.body).data[0]?.type);
  console.log('ONA Status:', onaRes.statusCode, 'Type:', JSON.parse(onaRes.body).data[0]?.type);
  console.log('Special Status:', specialRes.statusCode, 'Type:', JSON.parse(specialRes.body).data[0]?.type);
  if (movieRes.statusCode !== 200 || ovaRes.statusCode !== 200 || onaRes.statusCode !== 200 || specialRes.statusCode !== 200) {
    throw new Error('Format routes failed');
  }

  // Test 24: Get Episodes by Anisora ID
  console.log(`\n[Test 24] Testing GET /episodes/${testId}`);
  const epRes = await app.inject({ method: 'GET', url: `/episodes/${testId}` });
  console.log('Episodes Status:', epRes.statusCode);
  const epBody = JSON.parse(epRes.body);
  console.log(`Anime: ${epBody.title} has ${epBody.total_episodes} episodes`);
  console.log('Sample Episode 1 ID:', epBody.episodes[0]?.episode_id);
  if (epRes.statusCode !== 200 || epBody.episodes[0]?.episode_id !== `${testId}&ep=1`) {
    throw new Error('Get episodes by ID failed');
  }

  console.log('\n=== ALL 24 API INTEGRATION TESTS PASSED SUCCESSFULLY! ===\n');

  await app.close();
  await prisma.$disconnect();
}

runTests().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
