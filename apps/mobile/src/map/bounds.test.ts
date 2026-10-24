import { expect, test } from "vitest";
import { routeBounds } from "./bounds";

test("routeBounds", () => {
  expect(routeBounds([])).toBeNull();
  expect(routeBounds([[]])).toBeNull();
  expect(routeBounds([[[48.1, 11.5]]])).toEqual({ ne: [11.5, 48.1], sw: [11.5, 48.1] });
  expect(
    routeBounds([
      [
        [48.1, 11.5],
        [48.2, 11.4],
      ],
      [[48.0, 11.6]],
    ]),
  ).toEqual({ ne: [11.6, 48.2], sw: [11.4, 48.0] });
});
