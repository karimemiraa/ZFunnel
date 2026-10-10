import { describe, expect, it } from "vitest";
import { toEmbed } from "./utils";

describe("toEmbed", () => {
  it("handles YouTube, Vimeo and files", () => {
    expect(toEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.src).toContain(
      "youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(toEmbed("https://youtu.be/dQw4w9WgXcQ")?.src).toContain("dQw4w9WgXcQ");
    expect(toEmbed("https://vimeo.com/76979871")?.src).toBe("https://player.vimeo.com/video/76979871?dnt=1");
    expect(toEmbed("https://cdn.example.com/a.mp4")).toEqual({ kind: "video", src: "https://cdn.example.com/a.mp4" });
  });
  it("rejects unsafe or empty input", () => {
    expect(toEmbed("")).toBeNull();
    expect(toEmbed("javascript:alert(1)")).toBeNull();
    expect(toEmbed("http://insecure.example.com")).toBeNull();
  });
});
