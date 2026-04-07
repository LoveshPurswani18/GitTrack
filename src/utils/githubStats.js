export async function groupCommitsByDay(events) {
  const map = {}

  for (const event of events) {
    if (event.type !== "PushEvent") continue

    const date = event.created_at.split("T")[0]

    let commitCount = 0

    // case 1: commits available
    if (event.payload?.commits) {
      commitCount = event.payload.commits.length
    }

    // case 2: commits missing → fetch manually
    else {
      try {
        const repo = event.repo.name
        const res = await fetch(
          `https://api.github.com/repos/${repo}/commits?per_page=10`
        )

        const commits = await res.json()

        commitCount = commits.length
      } catch {
        commitCount = 1
      }
    }

    map[date] = (map[date] || 0) + commitCount
  }

  return map
}

export function build30DayData(commitMap) {
  const days = []

  for (let i = 29; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)

    const key = date.toISOString().split("T")[0]

    days.push({
      date: key,
      commits: commitMap[key] || 0,
      formattedDate: date.toDateString()
    })
  }

  return days
}

export function calculateStreak(commitMap) {
  let streak = 0

  const today = new Date()

  while (true) {
    const key = today.toISOString().split("T")[0]

    if (!commitMap[key]) break

    streak++
    today.setDate(today.getDate() - 1)
  }

  return streak
}

