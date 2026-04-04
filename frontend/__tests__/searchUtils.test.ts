import { buildSearchTags, filterSearchEntries } from "../src/screens/search/searchUtils";

describe("searchUtils", () => {
  const entries = [
    {
      _id: "entry-1",
      title: "Mood: Okay",
      content: "Feeling okay today after a quiet morning.",
      type: "mood-checkin",
      aiPrompt: null,
      images: [],
      tags: ["mood-checkin"],
      isFavorite: false,
      createdAt: "2026-04-01T08:00:00.000Z",
      updatedAt: "2026-04-01T08:00:00.000Z",
    },
    {
      _id: "entry-2",
      title: "Morning Reflections",
      content: "Went for a walk and wrote down a few gratitude notes.",
      type: "journal",
      aiPrompt: null,
      images: [],
      tags: ["gratitude", "morning"],
      isFavorite: true,
      createdAt: "2026-04-02T08:00:00.000Z",
      updatedAt: "2026-04-02T08:00:00.000Z",
    },
  ];

  test("filters by query, tags, and favorites", () => {
    expect(
      filterSearchEntries(entries, {
        query: "reflections",
        selectedTags: [],
        favoritesOnly: false,
      }).map(entry => entry._id)
    ).toEqual(["entry-2"]);

    expect(
      filterSearchEntries(entries, {
        query: "",
        selectedTags: ["gratitude"],
        favoritesOnly: true,
      }).map(entry => entry._id)
    ).toEqual(["entry-2"]);
  });

  test("builds a unique tag list that includes existing entry tags", () => {
    const tags = buildSearchTags(entries);

    expect(tags).toContain("gratitude");
    expect(tags).toContain("morning");
    expect(tags).toContain("work");
    expect(tags.filter(tag => tag === "gratitude")).toHaveLength(1);
  });
});
