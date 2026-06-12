export const KNOWN_SKILLS = [
  "html",
  "css",
  "javascript",
  "typescript",
  "react",
  "next.js",
  "node.js",
  "express",
  "mongodb",
  "postgresql",
  "mysql",
  "supabase",
  "firebase",
  "python",
  "java",
  "c++",
  "c#",
  "php",
  "laravel",
  "django",
  "flask",
  "tailwind",
  "bootstrap",
  "git",
  "github",
  "docker",
  "aws",
  "azure",
  "figma",
  "rest api",
  "graphql",
  "machine learning",
  "data structures",
  "algorithms",
];

export function parseSkillList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((skill) => skill.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function extractSkillsFromText(text: string) {
  const normalizedText = text.toLowerCase().replace(/\s+/g, " ");

  return KNOWN_SKILLS.filter((skill) => normalizedText.includes(skill));
}

export function calculateMatchScore(requiredSkills: string[], resumeSkills: string[]) {
  if (requiredSkills.length === 0) {
    return 0;
  }

  const resumeSkillSet = new Set(resumeSkills.map((skill) => skill.toLowerCase()));
  const matchedCount = requiredSkills.filter((skill) =>
    resumeSkillSet.has(skill.toLowerCase()),
  ).length;

  return Math.round((matchedCount / requiredSkills.length) * 100);
}

export async function extractTextFromResume(file: File) {
  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
    return file.text();
  }

  const buffer = await file.arrayBuffer();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const raw = decoder.decode(buffer);

  return raw
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 20000);
}
