import { round, score } from './score.js';

const bust = `?cache=${Date.now()}`;

export async function fetchList() {
    try {
        const listResult = await fetch(`./data/_list.json${bust}`);
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                try {
                    const levelResult = await fetch(`./data/${path}.json${bust}`);
                    const level = await levelResult.json();
                    // Returns an inner array element to satisfy the template framework
                    return [
                        {
                            ...level,
                            path,
                            records: level.records.sort(
                                (a, b) => b.percent - a.percent,
                            ),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load level #${rank + 1} (${path}).`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error('Failed to load list.');
        // Must return an empty array instead of null to prevent component crashes
        return [];
    }
}

export async function fetchLeaderboard() {
    const list = await fetchList();
    if (!list || list.length === 0) return [];

    const scoreMap = {};
    let errCount = 0;

    for (const [level, err] of list) {
        if (err) {
            errCount++;
            continue;
        }

        const rank = list.indexOf(list.find(([l]) => l && l.path === level.path)) + 1 - errCount;
        const verifier = level.verifier;

        if (!(verifier in scoreMap)) {
            scoreMap[verifier] = {
                verified: [],
                completed: [],
                progressed: [],
            };
        }
        scoreMap[verifier].verified.push(rank);

        for (const record of level.records) {
            const user = record.user;
            if (!(user in scoreMap)) {
                scoreMap[user] = {
                    verified: [],
                    completed: [],
                    progressed: [],
                };
            }

            if (record.percent === 100) {
                scoreMap[user].completed.push(rank);
            } else if (record.percent >= level.percentToQualify) {
                scoreMap[user].progressed.push({
                    rank,
                    percent: record.percent,
                });
            }
        }
    }

    const leaderboard = [];
    for (const user in scoreMap) {
        let totalScore = 0;
        for (const rank of scoreMap[user].verified) {
            totalScore += score(rank, 100, list.length);
        }
        for (const rank of scoreMap[user].completed) {
            totalScore += score(rank, 100, list.length);
        }
        for (const progress of scoreMap[user].progressed) {
            totalScore += score(progress.rank, progress.percent, list.length);
        }

        if (totalScore > 0) {
            leaderboard.push({
                user,
                score: round(totalScore),
                ...scoreMap[user],
            });
        }
    }

    return leaderboard.sort((a, b) => b.score - a.score);
}

export async function fetchEditors() {
    try {
        const editorsResults = await fetch(`./data/_editors.json${bust}`);
        const editors = await editorsResults.json();
        return editors;
    } catch {
        return [];
    }
}
