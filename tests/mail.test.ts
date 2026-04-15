import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn();

vi.mock("resend", () => {
  function MockResend() {}
  MockResend.prototype.emails = { send: mockSend };
  return { Resend: MockResend };
});

const { sendConfirmationEmail, sendDigestEmail, sendDigestToAll } = await import(
  "../src/lib/mail"
);

function makeSub(overrides = {}) {
  return {
    id: "sub-1",
    email: "test@example.com",
    confirmedAt: new Date(),
    unsubscribedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeDigest(overrides = {}) {
  return {
    id: "digest-1",
    digestDate: "2026-04-15",
    slot: "morgen",
    publishedAt: new Date("2026-04-15T09:00:00+02:00"),
    title: "Test Digest",
    description: "Desc",
    summaryOfDay: "Day summary text",
    createdAt: new Date(),
    ...overrides,
  };
}

function makeStory(overrides = {}) {
  return {
    id: "story-1",
    digestId: "digest-1",
    position: 1,
    headlineDe: "Test Headline",
    headlineEn: "Test Headline EN",
    summary: "Summary text.",
    whyRelevant: "Relevant because.",
    hnUrl: "https://hn.com/1",
    sourceUrl: "https://example.com",
    tags: ["ai"],
    verificationStatus: "verified",
    verificationReason: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("mail.ts", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  describe("sendConfirmationEmail", () => {
    it("sends confirmation email with correct from/to/subject", async () => {
      mockSend.mockResolvedValueOnce({ id: "msg-1" });
      const sub = makeSub();

      await sendConfirmationEmail(sub);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.from).toContain("newsletter@flinkbase.com");
      expect(call.to).toBe("test@example.com");
      expect(call.subject).toContain("bestätige");
    });

    it("includes confirm URL with subscriber ID", async () => {
      mockSend.mockResolvedValueOnce({ id: "msg-1" });
      const sub = makeSub({ id: "my-id-123" });

      await sendConfirmationEmail(sub);

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("/api/confirm?id=my-id-123");
    });
  });

  describe("sendDigestEmail", () => {
    it("sends digest email with story content", async () => {
      mockSend.mockResolvedValueOnce({ id: "msg-2" });
      const sub = makeSub();
      const digest = makeDigest();
      const stories = [makeStory(), makeStory({ id: "story-2", position: 2, headlineDe: "Story 2" })];

      await sendDigestEmail(sub, digest, stories);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toBe("Test Digest");
      expect(call.html).toContain("Test Headline");
      expect(call.html).toContain("Story 2");
      expect(call.html).toContain("Day summary text");
    });

    it("includes unsubscribe link with subscriber ID", async () => {
      mockSend.mockResolvedValueOnce({ id: "msg-2" });

      await sendDigestEmail(makeSub({ id: "unsub-id" }), makeDigest(), [makeStory()]);

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("/api/unsubscribe?id=unsub-id");
    });

    it("handles story without sourceUrl", async () => {
      mockSend.mockResolvedValueOnce({ id: "msg-2" });

      await sendDigestEmail(makeSub(), makeDigest(), [makeStory({ sourceUrl: null })]);

      const html = mockSend.mock.calls[0][0].html;
      expect(html).toContain("HN-Diskussion");
      expect(html).not.toContain("Original");
    });

    it("handles digest without summaryOfDay", async () => {
      mockSend.mockResolvedValueOnce({ id: "msg-2" });

      await sendDigestEmail(makeSub(), makeDigest({ summaryOfDay: "" }), [makeStory()]);

      const html = mockSend.mock.calls[0][0].html;
      expect(html).not.toContain("Einordnung");
    });
  });

  describe("sendDigestToAll", () => {
    it("sends to all subscribers and returns count", async () => {
      mockSend.mockResolvedValue({ id: "msg" });
      const subs = [makeSub({ id: "s1" }), makeSub({ id: "s2", email: "b@b.com" })];

      const result = await sendDigestToAll(subs, makeDigest(), [makeStory()]);

      expect(result).toEqual({ sent: 2, failed: 0 });
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("counts failures and continues sending", async () => {
      mockSend
        .mockRejectedValueOnce(new Error("Send failed"))
        .mockResolvedValueOnce({ id: "msg" });
      const subs = [makeSub({ id: "s1" }), makeSub({ id: "s2", email: "b@b.com" })];

      const result = await sendDigestToAll(subs, makeDigest(), [makeStory()]);

      expect(result).toEqual({ sent: 1, failed: 1 });
    });

    it("returns zeros for empty subscriber list", async () => {
      const result = await sendDigestToAll([], makeDigest(), [makeStory()]);
      expect(result).toEqual({ sent: 0, failed: 0 });
    });
  });
});
