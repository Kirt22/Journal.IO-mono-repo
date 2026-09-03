// The 30-day demo dataset. Data only — no I/O, so it can be diffed and reviewed
// on its own, and imported by both the seed script and its checks.
//
// Voice rules the answers follow: lowercase, conversational, 5-20 words, an
// occasional typo or emoji, never polished, length varies from three words to two
// sentences. Nothing identifying — no names, employers, products or places.
//
// TIMESTAMPS. `at` is wall-clock local time in Asia/Dubai (UTC+4), the timezone of
// both this machine and the device. It is deliberately NOT always the same
// calendar date as `date`:
//
//   insights.getDateKey (insights.service.ts:363) buckets by toISOString() — UTC —
//   and the streak, activity7d and daily counts all derive from that map. Meanwhile
//   the weekly AI report is fed journal.createdAt.getHours() in server-local time
//   (insights.service.ts:2163), which is what makes a 1am entry legible as a late
//   night to the model.
//
//   Those two pull apart after midnight: 01:22 local is 21:22 UTC on the PREVIOUS
//   day. So the two after-1am entries carry the following calendar date in `at`,
//   which lands them in the UTC bucket of the day they belong to. The streak stays
//   30/30 and the model still sees hour 1. The visible cost, accepted deliberately:
//   in the local-date entry list those two nights stack onto the next morning.
//
// TOPICS. detectedTopics is merged with tags into insights.tagCounts by
// getJournalAnalysisTags, so leaving it to the heuristic scorer swamps the five
// intended categories roughly 5:1 (a first run came back Focus 28% / Work 22% /
// Motivation 20% / Overwhelm 18% / Productivity 12%). Setting it explicitly, with
// no value used more than 3 times — under the smallest category count — keeps
// every one of them out of the top 5, so the Topic Snapshot shows the five
// intended labels at the intended ratios. It also gives each entry card a varied,
// plausible topic chip, since getEntryDisplayTags renders detectedTopics.
//
// TAGS drive the Topic Snapshot. getJournalAnalysisTags merges tags + detectedTopics
// into insights.tagCounts, which buildPopularTopics ranks and buildThemeBreakdown
// renders. Tags are not shown on entry cards (getEntryDisplayTags renders
// detectedTopics instead), so they stay invisible in screenshots.
// 31 instances: work 9 (29%), growth 7 (23%), gratitude 6 (19%), exercise 5 (16%),
// relationships 4 (13%).

export const GUIDED_QUESTIONS = [
  { questionId: "good_exciting", question: "What was one good or exciting thing that happened today?" },
  { questionId: "hurdle", question: "What was one hurdle or stressful moment you faced today?" },
  { questionId: "carry_tomorrow", question: "What would you like to carry into tomorrow?" },
];

// Authored replies for the "Going deeper:" exchange. The question above each is
// generated live by the model, so only our half is fixed.
export const DAYS = [
  {
    day: 1, date: "2026-07-23", at: "2026-07-23T22:14:00",
    mood: "okay", tags: ["work"],
    topics: ["productivity"],
    good: "shipped the onboarding fix, 3 taps now instead of 6",
    hurdle: "an hour lost to a bug that was just a typo 🙃",
    carry: "start with the hard thing first, not the easy one",
  },
  {
    day: 2, date: "2026-07-24", at: "2026-07-24T21:47:00",
    mood: "okay", tags: ["growth"],
    topics: ["goals"],
    good: "manager said the deck read really clean, felt good",
    hurdle: "meant to write the project update tonight, opened the doc and closed it",
    carry: "just get the first two lines down, doesnt have to be good",
  },
  {
    day: 3, date: "2026-07-25", at: "2026-07-25T23:02:00",
    mood: "good", tags: ["exercise"],
    topics: ["fitness"],
    good: "ran 5k without stopping, first time in months",
    hurdle: "nothing much, slow day",
    carry: "this. more saturdays like this",
  },
  {
    day: 4, date: "2026-07-26", at: "2026-07-26T21:30:00",
    mood: "okay", tags: ["work"],
    topics: ["decision-making"],
    good: "14 people signed up from the post, kept refreshing to check",
    hurdle: "update still not sent, told myself sunday and then it was 9pm",
    carry: "put it on the calendar instead of just remembering it",
    deeper: "i think i want it to be further along before anyone looks at it",
  },
  {
    day: 5, date: "2026-07-27", at: "2026-07-27T22:41:00",
    mood: "okay", tags: ["work"],
    topics: ["focus"],
    good: "fixed the sync thing thats been broken for 2 weeks",
    hurdle: "felt torn between work tickets and my own thing all day, kept switching",
    carry: "one block for each, no jumping",
  },
  {
    day: 6, date: "2026-07-28", at: "2026-07-28T07:20:00",
    mood: "okay", tags: ["gratitude"],
    topics: ["calm"],
    good: "quiet morning before anyone was awake, coffee outside ☕",
    hurdle: "writing this instead of the update i keep saying ill send",
    carry: "send it before i open anything else",
  },
  {
    day: 7, date: "2026-07-29", at: "2026-07-29T23:18:00",
    mood: "good", tags: ["gratitude"],
    topics: ["hope"],
    good: "someone i dont know replied to the thread saying theyd use it",
    hurdle: "refreshed the analytics like 20 times today, not a great use of a day",
    carry: "check numbers once, at the end",
  },
  {
    // after 1am — stamped on the following calendar date so the UTC bucket is Jul 30
    day: 8, date: "2026-07-30", at: "2026-07-31T01:22:00",
    mood: "okay", tags: ["work"], lateNight: true,
    topics: ["energy"],
    good: "got the export working, its 1am but it works",
    hurdle: "told myself id stop at 11 and then didnt",
    carry: "actually stop at 11 tomorrow",
  },
  {
    day: 9, date: "2026-07-31", at: "2026-07-31T22:05:00",
    mood: "bad", tags: ["work"],
    topics: ["focus"],
    good: "honestly not much. made it through",
    hurdle: "couldnt hold a thought all day, reread the same paragraph 4 times. update untouched again",
    carry: "sleep. thats it",
    deeper: "i was up till 2 the night before, probably that",
  },
  {
    day: 10, date: "2026-08-01", at: "2026-08-01T23:36:00",
    mood: "okay", tags: ["relationships"],
    topics: ["rest"],
    good: "dinner with friends, laughed a lot, didnt talk about work once",
    hurdle: "felt behind the whole time, kept thinking about the build",
    carry: "let saturday be saturday",
  },
  {
    day: 11, date: "2026-08-02", at: "2026-08-02T21:12:00",
    mood: "okay", tags: ["growth"],
    topics: ["creativity"],
    good: "rewrote the landing copy, 3rd version is way better",
    hurdle: "the update is now officially 2 weeks late, i keep moving it",
    carry: "monday morning, first thing, before slack",
  },
  {
    day: 12, date: "2026-08-03", at: "2026-08-03T22:58:00",
    mood: "good", tags: ["work"],
    topics: ["confidence"],
    good: "40 new visits today after someone shared it, best day so far",
    hurdle: "my manager asked for the update in standup and i said \"almost done\" 😐",
    carry: "almost done needs to become done",
    deeper: "saying almost done out loud made it worse somehow",
  },
  {
    day: 13, date: "2026-08-04", at: "2026-08-04T08:05:00",
    mood: "okay", tags: ["exercise"],
    topics: ["routines"],
    good: "gym before work, empty at 6am, kind of love it",
    hurdle: "nothing yet, day hasnt started",
    carry: "keep the morning slot, its the only hour nobody wants",
  },
  {
    day: 14, date: "2026-08-05", at: "2026-08-05T22:27:00",
    mood: "okay", tags: ["work"],
    topics: ["consistency"],
    good: "cleaned up the settings screen, it stopped flickering finally",
    hurdle: "opened the update doc, wrote one line, closed it. again.",
    carry: "one line is still one line. add two more tomorrow",
  },
  {
    day: 15, date: "2026-08-06", at: "2026-08-06T23:44:00",
    mood: "okay", tags: ["growth"],
    topics: ["creativity"],
    good: "figured out why the caching was wrong, it was obvious in hindsight",
    hurdle: "unsure if any of this matters, hard to tell from inside it",
    carry: "keep going even when i cant tell",
  },
  {
    day: 16, date: "2026-08-07", at: "2026-08-07T21:55:00",
    mood: "good", tags: ["relationships"],
    topics: ["family"],
    good: "my sister called just to ask how the thing was going, that landed",
    hurdle: "slow day at work, nothing really",
    carry: "call her back properly this weekend",
  },
  {
    day: 17, date: "2026-08-08", at: "2026-08-08T22:33:00",
    mood: "okay", tags: ["gratitude"],
    topics: ["discipline"],
    good: "whole saturday on the app, best stretch in a while",
    hurdle: "could have sent the update in 20 min of that. didnt.",
    carry: "20 minutes. before anything fun",
  },
  {
    day: 18, date: "2026-08-09", at: "2026-08-09T21:08:00",
    mood: "okay", tags: ["growth"],
    topics: ["identity"],
    good: "two hours went by and i didnt look at the clock once",
    hurdle: "hard to stop, felt weird going to bed",
    carry: "notice when it feels like that. thats the signal",
    deeper: "i didnt check the numbers today and didnt miss it",
  },
  {
    // after 1am — stamped on the following calendar date so the UTC bucket is Aug 10
    day: 19, date: "2026-08-10", at: "2026-08-11T01:41:00",
    mood: "okay", tags: ["growth"], lateNight: true,
    topics: ["creativity"],
    good: "the animation finally feels right, took ages but it feels right",
    hurdle: "didnt notice it was 1am, again",
    carry: "set an actual alarm for stopping",
  },
  {
    day: 20, date: "2026-08-11", at: "2026-08-11T22:19:00",
    mood: "bad", tags: ["work"],
    topics: ["focus"],
    good: "got through the standup, thats about it",
    hurdle: "brain wouldnt settle, kept losing the thread mid sentence. no update sent",
    carry: "early night. no laptop after 10",
  },
  {
    day: 21, date: "2026-08-12", at: "2026-08-12T21:38:00",
    mood: "bad", tags: ["growth"],
    topics: ["identity"],
    good: "cant think of one today honestly",
    hurdle: "felt flat and slow, doubted the whole thing for a bit",
    carry: "flat days are still days. dont read too much into one",
    deeper: "two bad nights in a row and everything looks worse, i know that",
  },
  {
    // the standout — understated, and the thread the weekly read can pull on
    day: 22, date: "2026-08-13", at: "2026-08-13T23:07:00",
    mood: "good", tags: ["relationships", "gratitude"], standout: true,
    topics: ["confidence"],
    good: "someone at work described the app to me not knowing i made it. said it helped them.",
    hurdle: "didnt know what to say so i just said \"oh nice\", still thinking about it",
    carry: "remember this on the days it feels pointless",
    deeper: "i keep replaying it. not the compliment, the fact that it was just useful to someone",
  },
  {
    day: 23, date: "2026-08-14", at: "2026-08-14T07:45:00",
    mood: "okay", tags: ["exercise"],
    topics: ["routines"],
    good: "ran before work, empty streets, felt like a head start",
    hurdle: "the update is on the list. its been on the list.",
    carry: "do the list top down, no picking",
  },
  {
    day: 24, date: "2026-08-15", at: "2026-08-15T22:50:00",
    mood: "good", tags: ["exercise"],
    topics: ["calm"],
    good: "long walk, no podcast, just walked. head felt clearer after",
    hurdle: "none really",
    carry: "more of the quiet version of this",
  },
  {
    day: 25, date: "2026-08-16", at: "2026-08-16T21:26:00",
    mood: "okay", tags: ["growth"],
    topics: ["identity"],
    good: "refactored the messy part, its readable now. felt good to fix properly",
    hurdle: "still havent sent it. i think im scared its not far enough along",
    carry: "send it as is. thats the point of an update",
    deeper: "waiting for it to be good enough is just a nicer word for not sending it",
  },
  {
    day: 26, date: "2026-08-17", at: "2026-08-17T22:12:00",
    mood: "good", tags: ["work"],
    topics: ["decision-making"],
    good: "sent the update. took 18 minutes. eighteen. 🙂",
    hurdle: "annoyed at myself for how long that sat there",
    carry: "the thing i avoid is usually smaller than the avoiding",
    deeper: "three weeks of carrying it around for eighteen minutes of work",
  },
  {
    day: 27, date: "2026-08-18", at: "2026-08-18T23:21:00",
    mood: "okay", tags: ["relationships"],
    topics: ["confidence"],
    good: "got a reply already, they had questions which means they read it",
    hurdle: "felt oddly exposed after sending, took a while to settle",
    carry: "showing unfinished work is a skill, keep practicing it",
  },
  {
    day: 28, date: "2026-08-19", at: "2026-08-19T21:49:00",
    mood: "okay", tags: ["exercise"],
    topics: ["fitness"],
    good: "back to the gym after skipping a week, went easy on purpose",
    hurdle: "wanted to push and didnt. felt like cheating",
    carry: "easy sessions count. showing up is the whole thing",
  },
  {
    day: 29, date: "2026-08-20", at: "2026-08-20T22:36:00",
    mood: "okay", tags: ["gratitude"],
    topics: ["joy"],
    good: "spent the evening on one small detail and enjoyed every minute",
    hurdle: "probably wasnt the most important thing to work on",
    carry: "some of it is allowed to just be for me",
  },
  {
    day: 30, date: "2026-08-21", at: "2026-08-21T23:11:00",
    mood: "good", tags: ["gratitude"],
    topics: ["hope"],
    good: "looked back at the first version from july, its not the same app anymore",
    hurdle: "nothing heavy. just tired in a normal way",
    carry: "keep the pace. dont rush the next bit",
  },
];
