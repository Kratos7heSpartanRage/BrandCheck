import { afterEach, describe, expect, it, vi } from "vitest";
import { runGroundedGeminiReview } from "./aiReview";
import {
  DEFAULT_GEMINI_MODEL,
  demoBody,
  seedSources,
  seedTerms,
} from "./model";

afterEach(() => vi.unstubAllGlobals());

describe("live Gemini transport", () => {
  it("keeps credentials out of the URL and sends a bounded JSON request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      findings: [],
                      assessment: {
                        riskLevel: "Low",
                        score: 90,
                        summary: "Test result",
                        claimRiskNote: "",
                        toneRiskNote: "",
                        suggestedRewrite: "Meet NovaDesk.",
                      },
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await runGroundedGeminiReview(
      demoBody,
      seedSources,
      seedTerms,
      [],
      "test-only-key",
    );
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`,
    );
    expect(url).not.toContain("test-only-key");
    expect(request.headers["x-goog-api-key"]).toBe("test-only-key");
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(request.body).generationConfig.responseMimeType).toBe(
      "application/json",
    );
    expect(result.isSimulated).toBe(false);
  });

  it("reports an API rejection as a fallback rather than a successful live review", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: "The selected model is unavailable for this account.",
            },
          }),
          { status: 404 },
        ),
      ),
    );
    const result = await runGroundedGeminiReview(
      demoBody,
      seedSources,
      seedTerms,
      [],
      "test-only-key",
    );
    expect(result.isSimulated).toBe(true);
    expect(result.error).toContain("unavailable");
  });
});
