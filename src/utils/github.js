const USERNAME = "LoveshPurswani18"

export async function fetchGithubEvents() {
  const res = await fetch(
    `https://api.github.com/users/${USERNAME}/events?per_page=100`
  )

  if (!res.ok) {
    throw new Error("Failed to fetch GitHub events")
  }

  return res.json()
}

// https://api.github.com/users/LoveshPurswani18/events?per_page=100