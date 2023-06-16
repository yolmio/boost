export interface Profile {
  db: string;
  user?: string;
}

export type Profiles = {
  default: Profile;
} & Record<string, Profile>;

export function createProfiles(
  profiles: Record<string, Partial<Profile>>,
) {
  const computedProfile: Record<string, Profile> = {
    default: {
      db: "data/dev",
      ...profiles.default,
    },
  };
  for (const [name, profile] of Object.entries(profiles)) {
    if (name === "default") {
      continue;
    }
    computedProfile[name] = {
      db: "data/dev",
      ...profile,
    };
  }
  return computedProfile;
}
