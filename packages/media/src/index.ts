export const supportedInputExtensions = [
  ".mp4",
  ".mkv",
  ".mov",
  ".wav",
  ".mp3",
  ".m4a",
] as const;

export type SupportedInputExtension = (typeof supportedInputExtensions)[number];

export function isSupportedInput(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  return supportedInputExtensions.some((extension) =>
    normalizedPath.endsWith(extension),
  );
}

export function buildFfprobeMetadataArgs(inputPath: string): string[] {
  return [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size:stream=codec_name,avg_frame_rate,width,height",
    "-of",
    "json",
    inputPath,
  ];
}

export function buildAudioExtractionArgs(
  inputPath: string,
  outputPath: string,
): string[] {
  return [
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "48000",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ];
}

export function buildSilenceDetectionArgs(inputPath: string): string[] {
  return [
    "-i",
    inputPath,
    "-af",
    "silencedetect=n=-38dB:d=0.5",
    "-f",
    "null",
    "-",
  ];
}
