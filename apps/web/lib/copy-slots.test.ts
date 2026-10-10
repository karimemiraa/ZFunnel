import { describe, expect, it } from "vitest";
import { applyCopy, collectCopy } from "./copy-slots";

const page = {
  root: { props: { title: "Root title is not copy here" } },
  content: [
    {
      type: "Section",
      props: {
        id: "s1",
        content: [
          { type: "Heading", props: { id: "h", text: "Old headline", level: "h1" } },
          { type: "Text", props: { id: "t", text: "<p>Old body</p>" } },
          { type: "Faq", props: { id: "f", items: [{ question: "Q1?", answer: "A1" }] } },
          { type: "CustomHtml", props: { id: "c", html: "<b>keep</b>", text: "skip me" } },
        ],
      },
    },
  ],
};

describe("copy slots", () => {
  it("collects editable copy including nested slots and array items, skipping code blocks", () => {
    const slots = collectCopy(page);
    expect(slots.map((s) => s.text)).toEqual(["Old headline", "<p>Old body</p>", "Q1?", "A1"]);
    expect(slots[1]!.html).toBe(true);
  });

  it("applies replacements by path without touching anything else", () => {
    const slots = collectCopy(page);
    const out = applyCopy(page, [
      { id: slots[0]!.id, text: "New headline" },
      { id: slots[2]!.id, text: "New Q?" },
      {
        id: "content.0.props.id",
        text: "should-not-change-non-copy? (it is a string, so path guard is the caller's job)",
      },
      { id: "content.9.props.text", text: "ignored" },
    ]);
    const sec = (out.content[0] as (typeof page.content)[0]).props.content;
    expect(sec[0]!.props.text).toBe("New headline");
    expect((sec[2]!.props as { items: { question: string }[] }).items[0]!.question).toBe("New Q?");
    expect(page.content[0]!.props.content[0]!.props.text).toBe("Old headline");
  });
});
