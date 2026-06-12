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

const SUPPORTED_PARSE_EXTENSIONS = [".txt", ".rtf", ".pdf", ".docx"];

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

function getExtension(fileName: string) {
  const lowerName = fileName.toLowerCase();
  const dotIndex = lowerName.lastIndexOf(".");

  return dotIndex >= 0 ? lowerName.slice(dotIndex) : "";
}

function stripRtf(text: string) {
  return text
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, " ")
    .replace(/\s+/g, " ");
}

export function isParseSupported(fileName: string) {
  return SUPPORTED_PARSE_EXTENSIONS.includes(getExtension(fileName));
}

export async function extractTextFromResume(file: File) {
  const extension = getExtension(file.name);

  if (file.type === "text/plain" || extension === ".txt") {
    const text = await file.text();

    return { text, parseStatus: "parsed" as const };
  }

  if (extension === ".rtf") {
    const text = stripRtf(await file.text());

    return {
      text,
      parseStatus: text.trim() ? ("partial" as const) : ("not_parsed" as const),
    };
  }

  if (extension === ".docx") {
    try {
      const mammoth = await import("mammoth");
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });

      return {
        text: result.value,
        parseStatus: result.value.trim() ? ("parsed" as const) : ("not_parsed" as const),
      };
    } catch {
      return { text: "", parseStatus: "not_parsed" as const };
    }
  }

  if (extension === ".pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const buffer = Buffer.from(await file.arrayBuffer());
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();

      return {
        text: result.text,
        parseStatus: result.text.trim() ? ("parsed" as const) : ("not_parsed" as const),
      };
    } catch {
      return { text: "", parseStatus: "not_parsed" as const };
    }
  }

  return { text: "", parseStatus: "not_parsed" as const };
}
