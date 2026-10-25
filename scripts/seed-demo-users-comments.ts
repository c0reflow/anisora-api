import prisma from '../src/db/prisma';
import { catalogService } from '../src/services/catalog.service';
import { homeService } from '../src/services/home.service';

const DEMO_USERS = [
  { username: 'GojoSatoru', email: 'gojo_satoru@anisora.net', role: 'user' },
  { username: 'TanjiroKamado', email: 'tanjiro_kamado@anisora.net', role: 'user' },
  { username: 'CaptainLevi', email: 'levi_ackerman@anisora.net', role: 'user' },
  { username: 'FrierenTheSlayer', email: 'frieren_mage@anisora.net', role: 'user' },
  { username: 'ZoroLostAgain', email: 'zoro_swordsman@anisora.net', role: 'user' },
  { username: 'NezukoChan', email: 'nezuko_chan@anisora.net', role: 'user' },
  { username: 'YujiItadori', email: 'itadori_yuji@anisora.net', role: 'user' },
  { username: 'MakimaWoof', email: 'makima_control@anisora.net', role: 'user' },
  { username: 'DenjiChainsaw', email: 'denji_chainsaw@anisora.net', role: 'user' },
  { username: 'MonkeyDLuffy', email: 'luffy_pirate_king@anisora.net', role: 'user' },
  { username: 'NarutoUzumaki', email: 'naruto_hokage@anisora.net', role: 'user' },
  { username: 'KingOfCurses', email: 'sukuna_curse@anisora.net', role: 'user' },
  { username: 'FernMage', email: 'fern_staff@anisora.net', role: 'user' },
  { username: 'AstaClover', email: 'asta_clover@anisora.net', role: 'user' },
  { username: 'MikasaAckerman', email: 'mikasa_scarf@anisora.net', role: 'user' },
  { username: 'KakashiSensei', email: 'kakashi_copy@anisora.net', role: 'user' },
];

const PARENT_COMMENTS = [
  'This episode was absolute peak fiction! The animation during the climax was breathtaking 🔥',
  'Wait, so that is who was behind the incident all along?! My jaw literally dropped.',
  'The soundtrack and voice acting during that confrontation gave me pure chills.',
  'Easily the best episode of the entire season so far. The pacing was flawless.',
  'I love how much depth and character development we are getting this arc.',
  'That cliffhanger is illegal! How am I supposed to wait another whole week for the next episode?!',
  'The direction in this sequence felt like a theatrical movie release. Hats off to the studio.',
  'I was not expecting to cry today, but that flashback scene completely broke me 😭',
  'The fight choreography was so fluid and creative, every single frame was perfection.',
  'Can we appreciate how faithful this adaptation has been to the source material?',
  'The visual metaphors and cinematography in the second half were masterclass.',
  'This scene alone cemented this series as one of my all-time favorites.',
  'The tension built up throughout this episode was insane. I could barely breathe!',
  'That opening sequence set the mood perfectly. Peak storytelling from start to finish.',
  'I did not see that revelation coming from a mile away! Completely re-contextualizes episode 1.',
  'The villain is honestly so well-written and terrifying. You can feel their presence in every scene.',
  '10/10 episode! The animation team deserves a massive bonus for this work.',
  'Rewatching this scene immediately. The subtle details in the background are unbelievable.',
  'That emotional payoff was so earned after everything the characters went through.',
  'One of the most satisfying conclusions to an arc I have witnessed in years!',
];

const REPLY_COMMENTS = [
  'Totally agreed! I rewatched that sequence three times already.',
  'Wait until you see what happens next episode, manga readers know what is coming!',
  'The sound design with good headphones makes it ten times more immersive.',
  'Same reaction here, my heart was racing the entire time!',
  'The voice actor truly put their whole soul into that delivery.',
  'Spot on! The subtle foreshadowing was there all along if you look closely.',
  'I had goosebumps during the entire transition, phenomenal work.',
  'Could not agree more, definitely anime of the season contender.',
  'Next week is going to blow everyone away, trust me!',
  'Yes! Finally someone points out the background details, so good.',
];

async function seed() {
  console.log('--- Seeding Demo Users and Comments ---');

  // Ensure DB connection with retries (wakes up Neon if suspended)
  let connected = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      connected = true;
      console.log('Database connected successfully.');
      break;
    } catch (e: any) {
      console.log(`Connection attempt ${attempt} failed: ${e.message}. Retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!connected) {
    throw new Error('Failed to connect to Neon database after 5 attempts.');
  }

  // 1. Create or upsert demo users
  console.log('\n[1/4] Upserting demo users...');
  const userRecords = [];
  for (const u of DEMO_USERS) {
    const user = await prisma.users.upsert({
      where: { email: u.email },
      update: { username: u.username, role: u.role, status: 'active' },
      create: {
        email: u.email,
        username: u.username,
        password_hash: '$2b$10$demoHashedPasswordPlaceholderStringForTesting00000',
        role: u.role,
        status: 'active',
        email_verified_at: new Date(),
      },
    });
    userRecords.push(user);
  }
  console.log(`Created/verified ${userRecords.length} demo users.`);

  // 2. Fetch trending anime from CatalogService
  console.log('\n[2/4] Fetching trending anime...');
  const trendingResult = await catalogService.getTrending(1, 10);
  let trendingAnime = trendingResult.data;

  if (!trendingAnime || trendingAnime.length === 0) {
    console.log('No trending returned from external, falling back to top local anime...');
    const fallbackItems = await prisma.anime.findMany({
      take: 10,
      orderBy: [{ views: 'desc' }, { score_mean: { sort: 'desc', nulls: 'last' } }],
      select: { anisora_id: true, title: true, episodes: true },
    });
    trendingAnime = fallbackItems.map((a) => ({
      id: a.anisora_id.toString(),
      title: a.title,
      total_episodes: a.episodes || 12,
      poster: null,
      description: null,
      type: 'series' as const,
      duration: '24m',
      score: 8.5,
      tag: 'action',
    }));
  }

  console.log(`Selected ${trendingAnime.length} trending anime:`);
  trendingAnime.forEach((a, i) => console.log(`  ${i + 1}. [${a.id}] ${a.title}`));

  // 3. Create 50+ comments and replies across trending anime
  console.log('\n[3/4] Creating 60+ comments and replies...');
  let totalCommentsCreated = 0;
  const now = Date.now();

  for (let aIdx = 0; aIdx < trendingAnime.length; aIdx++) {
    const anime = trendingAnime[aIdx];
    const anisoraId = anime.id;
    const maxEp = Math.min(anime.total_episodes || 12, 10);

    // Pick 2-4 episodes per anime
    const epNums = [1, 2, Math.max(3, Math.min(maxEp, 5))];

    for (const epNum of epNums) {
      const episodeId = `${anisoraId}&ep=${epNum}`;

      // Create 2 parent comments for this episode
      for (let p = 0; p < 2; p++) {
        const user = userRecords[(aIdx * 3 + p) % userRecords.length];
        const commentText = PARENT_COMMENTS[(aIdx * 4 + p * 2) % PARENT_COMMENTS.length];
        // Stagger createdAt between 2 hours and 5 days ago
        const timeOffset = (aIdx * 7 + p * 3 + 2) * 3600 * 1000;
        const createdAt = new Date(now - timeOffset);

        const parent = await prisma.anime_comments.create({
          data: {
            episode_id: episodeId,
            user_id: user.id,
            comment: commentText,
            type: 'parent',
            created_at: createdAt,
            updated_at: createdAt,
          },
        });
        totalCommentsCreated++;

        // Add 1 or 2 replies to this parent comment
        const replyUser = userRecords[(aIdx * 5 + p + 1) % userRecords.length];
        const replyText = REPLY_COMMENTS[(aIdx * 3 + p) % REPLY_COMMENTS.length];
        const replyCreatedAt = new Date(createdAt.getTime() + 15 * 60 * 1000); // 15 mins later

        await prisma.anime_comments.create({
          data: {
            episode_id: episodeId,
            user_id: replyUser.id,
            comment: replyText,
            type: 'reply',
            parent_comment_id: parent.id,
            created_at: replyCreatedAt,
            updated_at: replyCreatedAt,
          },
        });
        totalCommentsCreated++;
      }
    }
  }

  console.log(`Successfully inserted ${totalCommentsCreated} comments into anime_comments!`);

  // 4. Resync /home table so latest_comments is populated
  console.log('\n[4/4] Resyncing /home cache with fresh comments...');
  const homeData = await homeService.syncHomeData();
  console.log(`Home sync complete! Cached ${homeData.latest_comments?.length || 0} latest comments:`);
  homeData.latest_comments?.slice(0, 5).forEach((c, i) => {
    console.log(`  ${i + 1}. [${c.anime_title}] @${c.user.username}: "${c.comment.slice(0, 60)}..."`);
  });

  console.log('\n=== Demo Users & Comments Seeding Completed Successfully! ===');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
