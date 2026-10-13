import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';

// Avatars are stored as api.dicebear.com URLs. Loading many of them at once hits the
// public API rate limit and some images fail, so render them locally instead.
const cache = new Map<string, string>();

const DICEBEAR_ADVENTURER = /^https:\/\/api\.dicebear\.com\/[^/]+\/adventurer\/svg\?/;

/** True for avatar URLs OpenWebTrack generates itself; anything else is untrusted. */
export const isGeneratedAvatar = (avatar: string) => DICEBEAR_ADVENTURER.test(avatar);

export const avatarSrc = (avatar: string | null | undefined, fallbackSeed?: string) => {
	let seed: string | null = null;
	if (avatar && DICEBEAR_ADVENTURER.test(avatar)) {
		seed = new URL(avatar).searchParams.get('seed');
	} else if (avatar) {
		return avatar;
	} else if (fallbackSeed) {
		seed = fallbackSeed;
	}
	if (seed === null) return '';

	let src = cache.get(seed);
	if (!src) {
		src = createAvatar(adventurer, { seed }).toDataUri();
		cache.set(seed, src);
	}
	return src;
};
