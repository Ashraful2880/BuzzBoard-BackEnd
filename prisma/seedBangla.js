require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SERIES_DATA = {
  title: "প্রোডাকশন ফুল-স্ট্যাক আর্কিটেকচার",
  slug: "production-full-stack-architecture-bn",
  description:
    "রিয়েল-ওয়ার্ল্ড SaaS, PostgreSQL অপ্টিমাইজেশন, React কোড স্প্লিটিং এবং ডিরেক্ট স্পনসরশিপ সিস্টেম নিয়ে বাংলায় প্র্যাকটিক্যাল গাইড।",
  category: "Technology",
  status: "ongoing",
};

const POSTS_DATA = [
  {
    title: "PostgreSQL ও Prisma ORM-এ N+1 Query এবং Race Condition সমাধানের উপায়",
    slug: "postgresql-prisma-n-plus-1-race-condition-bn",
    category: "Technology",
    tags: ["postgresql", "prisma", "nodejs", "backend", "performance"],
    excerpt:
      "লুপের ভেতর আলাদা UPDATE কুয়েরি বাদ দিয়ে অ্যাটমিক increment এবং Composite Index ব্যবহার করে কীভাবে API পারফরম্যান্স স্কেল করবেন।",
    readingTime: 4,
    isAdSafe: true,
    content: `একটি প্রোডাকশন কনটেন্ট বা অ্যাড-টেক প্ল্যাটফর্ম স্কেল করার সময় বেশিরভাগ পারফরম্যান্স সমস্যা আসে **N+1 Query** এবং **Read-Then-Write Race Condition** থেকে।

### ১. লুপ-ভিত্তিক আপডেটের সমস্যা
অনেক সময় আমরা অ্যাক্টিভ অ্যাড বা পোস্ট লিস্ট এনে লুপের ভেতরে প্রতিটি আইটেমের জন্য আলাদা \`UPDATE\` কুয়েরি চালাই। একসাথে ১০০ জন ইউজার রিকোয়েস্ট পাঠালে ডাটাবেজে ৫০০+ রাউন্ড-ট্রিপ তৈরি হয়।

এর সমাধান হলো Prisma-র \`updateMany\` এবং অ্যাটমিক \`{ increment: 1 }\` ব্যবহার করা:
- একটি সিঙ্গেল কুয়েরিতেই সব রো আপডেট হয়
- কনকারেন্ট রিকোয়েস্টে কোনো কাউন্ট মিস হয় না

### ২. Composite Indexing কেন জরুরি?
শুধু প্রাইমারি কি-তে ইনডেক্স রাখলে টেবিল বড় হওয়ার সাথে সাথে কুয়েরি স্লো হয়ে যায়। আমাদের হট পাথগুলোর জন্য নিচের কম্পোজিট ইনডেক্সগুলো অপরিহার্য:
- \`@@index([status, scheduledAt])\` — শিডিউলড পোস্ট পাবলিশ করার জন্য
- \`@@index([seriesId, seriesOrder])\` — সিরিজের চ্যাপ্টারগুলো অর্ডার অনুযায়ী লোড করার জন্য
- \`@@index([status, placement, endDate])\` — অ্যাক্টিভ অ্যাড ফিল্টার করার জন্য

### ৩. Read Endpoint-এ Write থ্রটলিং
প্রতিবার \`GET /posts\` কল হলে যদি ব্যাকগ্রাউন্ড আপডেট চলে, তবে রিড ট্র্যাফিক রাইট লোড বাড়িয়ে দেয়। ৬০ সেকেন্ডের একটি কুলডাউন গার্ড যোগ করলে ডাটাবেজ চাপমুক্ত থাকে।`,
  },
  {
    title: "React 19 ও RTK Query দিয়ে ফাস্ট SaaS ফ্রন্টএন্ড আর্কিটেকচার",
    slug: "react-19-rtk-query-code-splitting-bn",
    category: "Education",
    tags: ["react", "typescript", "vite", "rtk-query", "frontend"],
    excerpt:
      "Route-based Code Splitting (React.lazy), 401-মুক্ত Auth Gating এবং ট্যাগ-ভিত্তিক ক্যাশ ইনভ্যালিডেশন ব্যবহারের প্র্যাকটিক্যাল গাইড।",
    readingTime: 3,
    isAdSafe: true,
    content: `একটি বড় SaaS অ্যাপ্লিকেশনে ল্যান্ডিং পেজের সাথেই এডিটোরিয়াল স্টুডিও, এনালিটিক্স এবং প্রোফাইল পেজের জাভাস্ক্রিপ্ট একসাথে লোড করলে ইনিশিয়াল লোড টাইম অনেক বেড়ে যায়।

### ১. Route-Based Code Splitting
\`React.lazy\` এবং \`Suspense\` ব্যবহার করে সেকেন্ডারি রুটগুলো (\`/studio\`, \`/analytics\`, \`/profile\`, \`/posts/:id\`) আলাদা চাঙ্কে ভাগ করলে হোমপেজ অনেক দ্রুত লোড হয়।

### ২. অপ্রয়োজনীয় 401 এরর বন্ধ করা
লগইন না করা অবস্থায় \`/notifications\` বা \`/users/bookmarks\` কল করলে নেটওয়ার্ক ট্যাবে \`401\` এরর দেখা যায়। RTK Query-তে \`{ skip: !token }\` ব্যবহার করলে অপ্রয়োজনীয় নেটওয়ার্ক রিকোয়েস্ট পুরোপুরি বন্ধ হয়।

### ৩. ডিক্লারেটিভ Cache Invalidation
\`Profile\`, \`Post\`, এবং \`Bookmark\` ট্যাগ ব্যবহার করলে প্রোফাইল ছবি বা নাম আপডেট করার সাথে সাথেই Navbar ও ফিডে পরিবর্তন প্রতিফলিত হয়।`,
  },
  {
    title: "টেকনিক্যাল পাবলিকেশনের জন্য প্রাইভেসি-ফার্স্ট ডিরেক্ট স্পনসরশিপ ইঞ্জিন",
    slug: "privacy-first-direct-sponsorship-engine-bn",
    category: "Business",
    tags: ["saas", "adtech", "monetization", "architecture"],
    excerpt:
      "থার্ড-পার্টি অ্যাড নেটওয়ার্কের ভারী স্ক্রিপ্ট ছাড়াই কীভাবে নিজস্ব ব্র্যান্ড-সেফ স্পনসরশিপ এবং CTR ট্র্যাকিং সিস্টেম তৈরি করবেন।",
    readingTime: 3,
    isAdSafe: true,
    content: `থার্ড-পার্টি অ্যাড নেটওয়ার্কগুলো সাধারণত ভারী ট্র্যাকিং স্ক্রিপ্ট ও পপআপের মাধ্যমে রিডিং এক্সপেরিয়েন্স নষ্ট করে এবং পেজ স্পিড কমিয়ে দেয়। ডেভেলপার-কেন্দ্রিক প্ল্যাটফর্মে **ডিরেক্ট স্পনসরশিপ** অনেক বেশি কার্যকর।

### ১. Native Placement ও Category Targeting
হোমপেজ ও আর্টিকেলের ভেতরে \`in_article\` এবং \`sidebar\` স্লট রাখলে ডিজাইনের সাথে মানানসইভাবে স্পনসরড কনটেন্ট দেখানো যায়।

### ২. Pre-Publish Brand Safety
আর্টিকেল পাবলিশ হওয়ার আগেই AI ও পলিসি মডারেশন চেক করে \`isAdSafe\` স্ট্যাটাস নিশ্চিত করলে স্পনসরদের ব্র্যান্ড নিরাপত্তা বজায় থাকে।

### ৩. অ্যাটমিক Impression ও CTR ট্র্যাকিং
তৃতীয় পক্ষের কুকি ছাড়াই সার্ভারে অ্যাটমিকভাবে **Impressions**, **Clicks**, এবং **CTR** হিসাব করলে স্পনসররা স্বচ্ছ ROI রিপোর্ট পান।`,
  },
];

async function main() {
  const author = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!author) {
    console.error("No user found in database. Please sign in once on the app first.");
    process.exit(1);
  }

  console.log(`Seeding Bangla series & posts for author: ${author.name} (${author.email})`);

  const series = await prisma.series.upsert({
    where: { slug: SERIES_DATA.slug },
    update: {
      title: SERIES_DATA.title,
      description: SERIES_DATA.description,
      category: SERIES_DATA.category,
      status: SERIES_DATA.status,
    },
    create: {
      ...SERIES_DATA,
      authorId: author.id,
    },
  });

  console.log(`Series ready: ${series.title} (${series.id})`);

  for (let i = 0; i < POSTS_DATA.length; i++) {
    const p = POSTS_DATA[i];
    const post = await prisma.post.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        content: p.content,
        excerpt: p.excerpt,
        category: p.category,
        tags: p.tags,
        readingTime: p.readingTime,
        isAdSafe: p.isAdSafe,
        status: "published",
        seriesId: series.id,
        seriesOrder: i + 1,
      },
      create: {
        title: p.title,
        slug: p.slug,
        content: p.content,
        excerpt: p.excerpt,
        category: p.category,
        tags: p.tags,
        readingTime: p.readingTime,
        isAdSafe: p.isAdSafe,
        status: "published",
        authorId: author.id,
        seriesId: series.id,
        seriesOrder: i + 1,
      },
    });
    console.log(`Post #${i + 1} ready: ${post.title}`);
  }

  console.log("Done! Bangla series and 3 posts seeded successfully.");
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
