export function randomPhrase() {
  const randomIndex = Math.floor(Math.random() * responses.length);
  return responses[randomIndex];
}

const responses = [
  "That's an interesting point.",
  "I'll need to think about that.",
  "Tell me more.",
  "I understand your perspective.",
  "That's a valid concern.",
  "Can you elaborate on that?",
  "I see what you mean.",
  "That's a good question.",
  "Let's explore that further.",
  "I appreciate your input.",
  "That's something to consider.",
  "I'll take that into account.",
  "That's a great observation.",
  "I hadn't thought of it that way.",
  "That's a compelling argument.",
  "I'll need to look into that.",
  "That's a fair point.",
  "I can see why you think that.",
  "That's an important issue.",
  "I'll make a note of that.",
  "That's a thoughtful comment.",
  "I value your perspective.",
  "That's a noteworthy point.",
  "I'll consider that carefully.",
  "That's a reasonable suggestion.",
];
