import { getMethodologySourceById } from "@pv-methodology/registry";
import { describe, expect, it } from "vitest";
import { EV_METHODOLOGY_SOURCE_IDS } from "../src/index";

describe("EV v1 methodology registry", () => {
  it("registers every EV source id used by the package", () => {
    expect(EV_METHODOLOGY_SOURCE_IDS).toHaveLength(8);
    for (const id of EV_METHODOLOGY_SOURCE_IDS) {
      const source = getMethodologySourceById(id);
      expect(source, id).toBeDefined();
      expect(source?.category).toBe("load_profiles");
      expect(source?.url).toBeNull();
      expect(source?.sourceType).toBe("methodology");
      expect(source?.version).toBe("EV v1");
    }
  });
});
