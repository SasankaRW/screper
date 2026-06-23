export type FbGroup = {
  id: string;
  name: string;
  url: string;
  addedAt: string;
};

export type Post = {
  id: string;
  groupId: string;
  groupName: string;
  author: string;
  text: string;
  permalink: string;
  postedAt: string;
  priceLkr?: number;
};

export type SearchProfile = {
  locations: string[];
  keywords: string[];
  groupIds: string[];
};

export type MatchedPost = Post & {
  matchedLocations: string[];
  matchedKeywords: string[];
};
