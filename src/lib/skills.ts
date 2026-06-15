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

export function getResumeParseStatus(text: string, extractedSkills: string[]) {
  if (!text.trim()) {
    return "not_parsed" as const;
  }

  return extractedSkills.length > 0 ? ("parsed" as const) : ("partial" as const);
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

function cleanExtractedText(text: string) {
  return text
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFallbackPdfText(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const literalStrings = Array.from(raw.matchAll(/\(([^()]{2,})\)/g), (match) => match[1]);
  const hexStrings = Array.from(raw.matchAll(/<([0-9a-fA-F\s]{8,})>/g), (match) => {
    const hex = match[1].replace(/\s+/g, "");
    const bytes = hex.match(/.{1,2}/g) ?? [];

    return bytes
      .map((byte) => String.fromCharCode(Number.parseInt(byte, 16)))
      .join("");
  });

  return cleanExtractedText([...literalStrings, ...hexStrings].join(" "));
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
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      const text = cleanExtractedText(result.text);

      if (!text) {
        const fallbackText = extractFallbackPdfText(buffer);

        return {
          text: fallbackText,
          parseStatus: fallbackText ? ("partial" as const) : ("not_parsed" as const),
        };
      }

      return {
        text,
        parseStatus: "parsed" as const,
      };
    } catch {
      const fallbackText = extractFallbackPdfText(buffer);

      return {
        text: fallbackText,
        parseStatus: fallbackText ? ("partial" as const) : ("not_parsed" as const),
      };
    }
  }

  return { text: "", parseStatus: "not_parsed" as const };
}
