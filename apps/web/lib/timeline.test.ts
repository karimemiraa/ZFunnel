import { describe, expect, it } from "vitest";
import { buildTimeline, timelineCounts, type TimelineSources } from "./timeline";

const at = (s: string) => new Date(`2026-05-0${s}T10:00:00Z`);

function sources(over: Partial<TimelineSources> = {}): TimelineSources {
  return {
    ws: "acme",
    orders: [],
    forms: [],
    emails: [],
    bookings: [],
    courses: [],
    chats: [],
    deals: [],
    activities: [],
    ...over,
  };
}

describe("buildTimeline", () => {
  it("merges every source newest first, each linking to its record", () => {
    const items = buildTimeline(
      sources({
        orders: [
          {
            id: "o1",
            number: 1042,
            status: "paid",
            total: 4900,
            currency: "usd",
            createdAt: at("3"),
            items: ["Course"],
          },
        ],
        forms: [{ id: "f1", stepId: "s1", blockId: "quiz 1", formName: "Quiz", createdAt: at("2") }],
        emails: [
          {
            id: "e1",
            subject: "Welcome",
            sentAt: at("4"),
            createdAt: at("4"),
            openedAt: at("5"),
            clickedAt: null,
            broadcastId: null,
            workflowId: "w1",
            status: "sent",
          },
        ],
        bookings: [
          {
            id: "b1",
            calendarId: "c1",
            calendarName: "Intro call",
            startAt: at("9"),
            createdAt: at("1"),
            status: "confirmed",
          },
        ],
      }),
    );
    expect(items.map((i) => i.kind)).toEqual(["email", "order", "form", "booking"]);
    expect(items[0]).toMatchObject({ title: "Welcome", detail: "opened", href: "/automation/acme/w1" });
    expect(items[1]).toMatchObject({
      title: "#1042",
      href: "/acme/orders/o1",
      money: { amount: 4900, currency: "usd" },
    });
    expect(items[2]!.href).toBe("/acme/forms/s1/quiz%201");
    expect(items[3]!.href).toBe("/acme/calendars/c1");
  });

  it("drops logged activities that a record already shows, keeps the rest", () => {
    const items = buildTimeline(
      sources({
        activities: [
          { id: "a1", type: "purchase", body: "Course", actor: null, createdAt: at("1") },
          { id: "a2", type: "email_opened", body: "Welcome", actor: null, createdAt: at("1") },
          { id: "a3", type: "note", body: "Called her", actor: "Sam", createdAt: at("2") },
          { id: "a4", type: "tag_added", body: "vip", actor: "Sam", createdAt: at("3") },
          { id: "a5", type: "something_new", body: null, actor: null, createdAt: at("4") },
        ],
      }),
    );
    expect(items.map((i) => i.kind)).toEqual(["tag_added", "note"]);
    expect(items[1]).toMatchObject({ body: "Called her", actor: "Sam", title: "" });
    expect(items[0]!.title).toBe("vip");
  });

  it("skips emails that were never sent and caps the length", () => {
    const emails = Array.from({ length: 5 }, (_, i) => ({
      id: `e${i}`,
      subject: `S${i}`,
      sentAt: i === 0 ? null : at("1"),
      createdAt: at("1"),
      openedAt: null,
      clickedAt: null,
      broadcastId: "b1",
      status: i === 0 ? "queued" : "sent",
    }));
    const items = buildTimeline(sources({ emails }), 3);
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.href === "/acme/email/b1")).toBe(true);
    expect(timelineCounts(buildTimeline(sources({ emails })))).toEqual({ email: 4 });
  });
});
