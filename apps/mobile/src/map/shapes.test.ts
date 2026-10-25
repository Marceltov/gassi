import { expect, test } from "vitest";
import { routeShapes } from "./shapes";

test("routeShapes: a route as a line in MapLibre's [lon, lat], a one-point route as a point, an empty one not at all", () => {
  expect(
    routeShapes([
      [
        [48.1, 11.5],
        [48.2, 11.4],
      ],
      [[48.0, 11.6]],
      [],
    ]),
  ).toEqual({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [11.5, 48.1],
            [11.4, 48.2],
          ],
        },
      },
      { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [11.6, 48.0] } },
    ],
  });
});
