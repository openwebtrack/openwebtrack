export const generateVisitorName = (id: string) => {
	const adjectives = ['Happy', 'Lucky', 'Sunny', 'Clever', 'Brave', 'Calm', 'Eager', 'Fancy', 'Gentle', 'Jolly'];
	const animals = ['Panda', 'Tiger', 'Lion', 'Eagle', 'Dolphin', 'Fox', 'Wolf', 'Bear', 'Hawk', 'Owl'];
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = id.charCodeAt(i) + ((hash << 5) - hash);
	}
	const adj = adjectives[Math.abs(hash) % adjectives.length];
	const animal = animals[Math.abs(hash >> 5) % animals.length];
	return `${adj} ${animal}`;
};

export const generateAvatarUrl = (id: string) => {
	return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${id}`;
};
